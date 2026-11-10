import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton.jsx';
import TrackRow from '../components/TrackRow.jsx';
import { BackIcon, PlusIcon } from '../components/icons.jsx';
import { getAllPlaylists } from '../services/catalog.js';
import { searchTracks } from '../services/itunes.js';
import { deleteCustom, listCustom, saveCustom } from '../services/playlists.js';
import { useSettings } from '../state/SettingsContext.jsx';
import { useScreenActive } from '../state/ScreenActive.js';
import {
  addTrack,
  duplicatePlaylist,
  hasTrack,
  plural,
  removeTrackAt,
  searchErrorMessage,
  shortPlaylistNote,
} from './playlistEdit.js';
import styles from './PlaylistDetail.module.css';

const SEARCH_DELAY = 400;
const PREVIEW_MS = 3000;
const MIN_TERM = 2;

/** One shared <audio> for 3s previews: starting one stops the last. */
function usePreview(volume, active) {
  const audio = useRef(null);
  const timer = useRef(0);
  const [playingId, setPlayingId] = useState(null);

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    const a = audio.current;
    if (a) {
      a.pause();
      a.removeAttribute('src');
      a.load?.();
    }
    setPlayingId(null);
  }, []);

  const toggle = useCallback(
    (track) => {
      if (playingId === track.id) {
        stop();
        return;
      }
      stop();
      if (!audio.current) audio.current = new Audio();
      const a = audio.current;
      a.src = track.previewUrl;
      a.volume = Math.min(1, Math.max(0, volume ?? 0.8));
      setPlayingId(track.id);
      a.play().catch(() => setPlayingId(null));
      timer.current = setTimeout(stop, PREVIEW_MS);
    },
    [playingId, stop, volume]
  );

  // leaving the route (cross-fade marks the screen inactive) or unmounting stops it
  useEffect(() => {
    if (!active) stop();
  }, [active, stop]);
  useEffect(() => stop, [stop]);

  return { playingId, toggle };
}

function initialState(id) {
  if (id === 'new') return { kind: 'edit', playlist: null };
  const custom = listCustom().find((p) => p.id === id);
  if (custom) return { kind: 'edit', playlist: custom };
  const house = getAllPlaylists().find((p) => !p.custom && p.id === id);
  return house ? { kind: 'house', playlist: house } : { kind: 'missing', playlist: null };
}

/** The playlist editor: name, iTunes search, the track list, delete. */
export default function PlaylistDetail({ navigate, params }) {
  const [initial] = useState(() => initialState(params.id));
  if (initial.kind === 'edit') return <Editor navigate={navigate} initial={initial.playlist} />;
  return <NotEditable navigate={navigate} kind={initial.kind} playlist={initial.playlist} />;
}

function Header({ navigate, children }) {
  return (
    <header className={styles.top}>
      <ArcadeButton variant="neutral" size="sm" icon={<BackIcon />} onClick={() => navigate('/playlists')}>
        Back
      </ArcadeButton>
      <h1 className={styles.title} data-screen-heading>
        {children}
      </h1>
    </header>
  );
}

function NotEditable({ navigate, kind, playlist }) {
  const [error, setError] = useState(null);
  const duplicate = () => {
    const saved = duplicatePlaylist(playlist, getAllPlaylists());
    if (!saved) setError('Couldn’t save — storage full?');
    else navigate(`/playlists/${encodeURIComponent(saved.id)}`);
  };
  return (
    <div className={styles.screen}>
      <Header navigate={navigate}>{kind === 'house' ? playlist.name : 'Playlist not found'}</Header>
      {kind === 'house' ? (
        <>
          <p className={styles.note}>
            House playlists are fixed. Duplicate this one to change it — {plural(playlist.tracks.length, 'song')}.
          </p>
          <div>
            <ArcadeButton variant="pink" size="sm" onClick={duplicate}>
              Duplicate
            </ArcadeButton>
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
        </>
      ) : (
        <p className={styles.note}>This playlist doesn’t exist any more.</p>
      )}
    </div>
  );
}

function Editor({ navigate, initial }) {
  const [settings] = useSettings();
  const active = useScreenActive();
  const uid = useId();
  const base = useRef(initial ?? { color: 'pink' });
  const [id, setId] = useState(initial?.id ?? null);
  const [name, setName] = useState(initial?.name ?? '');
  const [tracks, setTracks] = useState(initial?.tracks ?? []);
  const [saveState, setSaveState] = useState(null); // null | 'saved' | 'failed'

  const persist = (next) => {
    const saved = saveCustom({ ...base.current, id: id ?? undefined, name: next.name, tracks: next.tracks });
    if (!saved) {
      setSaveState('failed');
      return;
    }
    base.current = saved;
    setSaveState('saved');
    if (!id) {
      setId(saved.id);
      // Swap '#/playlists/new' for the real id without a hashchange: a route
      // change would remount this screen mid-typing and drop focus.
      window.history.replaceState(window.history.state, '', `#/playlists/${encodeURIComponent(saved.id)}`);
    }
  };

  const rename = (value) => {
    setName(value);
    persist({ name: value, tracks });
  };
  const changeTracks = (next) => {
    if (next === tracks) return;
    setTracks(next);
    persist({ name, tracks: next });
  };

  // ---- search ----
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const term = query.trim();

  useEffect(() => {
    if (term.length < MIN_TERM || !active) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return undefined;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const found = await searchTracks(term, { country: settings.country, limit: 15, signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        setResults(found.slice(0, 15));
        setSearchError(null);
      } catch (err) {
        const msg = searchErrorMessage(err);
        if (msg === null) return; // superseded by a newer search
        setResults([]);
        setSearchError(msg);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, SEARCH_DELAY);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term, settings.country, active]);

  const { playingId, toggle } = usePreview(settings.volume, active);

  // ---- delete (two-step) ----
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef(null);
  const deleteRef = useRef(null);
  const wasConfirming = useRef(false);
  useEffect(() => {
    if (confirming) confirmRef.current?.querySelector('button')?.focus();
    else if (wasConfirming.current) deleteRef.current?.focus();
    wasConfirming.current = confirming;
  }, [confirming]);

  const remove = () => {
    deleteCustom(id);
    navigate('/playlists');
  };

  const status = useMemo(() => {
    if (term.length < MIN_TERM) return '';
    if (searching) return 'Searching…';
    if (searchError) return '';
    return results.length ? `${plural(results.length, 'result')}` : 'No songs found';
  }, [term, searching, searchError, results]);

  const displayName = name.trim() || 'Untitled playlist';
  // album and artist playlists arrive complete, so a short one is worth a warning
  const shortNote = base.current.source ? shortPlaylistNote(tracks.length, settings.minPlayableSongs) : null;

  return (
    <div className={styles.screen}>
      <Header navigate={navigate}>{id ? 'Edit playlist' : 'New playlist'}</Header>

      <div className={styles.nameRow}>
        <label className={styles.label} htmlFor={`${uid}-name`}>
          Name
        </label>
        <input
          id={`${uid}-name`}
          className={styles.input}
          value={name}
          maxLength={60}
          placeholder="Untitled playlist"
          autoComplete="off"
          onChange={(e) => rename(e.target.value)}
        />
        <p className={saveState === 'failed' ? styles.saveFailed : styles.saved} role="status">
          {saveState === 'saved' ? 'Saved' : saveState === 'failed' ? 'Couldn’t save — storage full?' : ''}
        </p>
      </div>

      {/* ---- search ---- */}
      <section className={styles.group} aria-labelledby={`${uid}-find`}>
        <h2 className={styles.groupTitle} id={`${uid}-find`}>
          Add songs
        </h2>
        <label className="visually-hidden" htmlFor={`${uid}-q`}>
          Search iTunes for a song or artist
        </label>
        <input
          id={`${uid}-q`}
          className={styles.input}
          type="search"
          value={query}
          placeholder="Search a song or artist"
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className={styles.status} role="status" aria-live="polite">
          {status}
        </p>
        {searchError ? (
          <p className={styles.error} role="alert">
            {searchError}
          </p>
        ) : null}
        {results.length ? (
          <ul className={styles.rows} aria-label="Search results">
            {results.map((t) => {
              const added = hasTrack(tracks, t.id);
              return (
                <li key={t.id}>
                  <TrackRow
                    track={t}
                    playing={playingId === t.id}
                    onPreview={() => toggle(t)}
                    action={
                      <ArcadeButton
                        variant="pink"
                        size="sm"
                        icon={added ? null : <PlusIcon />}
                        className={added ? styles.added : undefined}
                        aria-disabled={added || undefined}
                        aria-label={added ? `${t.title} added` : `Add ${t.title} by ${t.artist}`}
                        onClick={() => !added && changeTracks(addTrack(tracks, t))}
                      >
                        {added ? 'Added' : 'Add'}
                      </ArcadeButton>
                    }
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {/* ---- current tracks ---- */}
      <section className={styles.group} aria-labelledby={`${uid}-list`}>
        <h2 className={styles.groupTitle} id={`${uid}-list`}>
          In this playlist <span className={styles.count}>{plural(tracks.length, 'song')}</span>
        </h2>
        {shortNote ? <p className={styles.note}>{shortNote}</p> : null}
        {tracks.length ? (
          <ol className={styles.rows}>
            {tracks.map((t, i) => (
              <li key={`${t.id ?? 't'}-${i}`}>
                <TrackRow
                  track={t}
                  action={
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`Remove ${t.title} by ${t.artist}`}
                      onClick={() => changeTracks(removeTrackAt(tracks, i))}
                    >
                      Remove
                    </button>
                  }
                />
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.none}>No songs yet. Search above and press ADD.</p>
        )}
      </section>

      {id ? (
        <section className={styles.danger} aria-label="Delete playlist">
          {confirming ? (
            <>
              <p className={styles.confirmText}>
                Delete “{displayName}”? This can’t be undone.
              </p>
              <div className={styles.confirmActions} ref={confirmRef}>
                <ArcadeButton variant="cyan" size="sm" onClick={() => setConfirming(false)}>
                  Keep it
                </ArcadeButton>
                <ArcadeButton variant="pink" size="sm" onClick={remove}>
                  Delete
                </ArcadeButton>
              </div>
            </>
          ) : (
            <button ref={deleteRef} type="button" className={styles.deleteLink} onClick={() => setConfirming(true)}>
              Delete playlist
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}
