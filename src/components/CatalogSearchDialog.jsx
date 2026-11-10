import { useEffect, useId, useRef, useState } from 'react';
import ArcadeButton from './ArcadeButton.jsx';
import { albumTracks, artistTracks, searchAlbums, searchArtists } from '../services/itunes.js';
import { saveCustom } from '../services/playlists.js';
import { useSettings } from '../state/SettingsContext.jsx';
import { plural, searchErrorMessage } from '../screens/playlistEdit.js';
import styles from './CatalogSearchDialog.module.css';

const SEARCH_DELAY = 400;
const MIN_TERM = 2;
const NONE = { albums: [], artists: [] };

/**
 * Search iTunes for an album or an artist in a native modal <dialog>. Picking a result
 * fetches its songs, saves them as a custom playlist (ids included, so it plays without
 * title matching) and hands the saved playlist to `onSaved`.
 */
export default function CatalogSearchDialog({ open, onClose, onSaved }) {
  const [settings] = useSettings();
  const ref = useRef(null);
  const uid = useId();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState(NONE);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  /** `${type}:${id}` of the result being fetched. */
  const [picking, setPicking] = useState(null);
  const pickCtrl = useRef(null);
  const term = query.trim();
  const country = settings.country;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQuery('');
      setFound(NONE);
      setError(null);
      setPicking(null);
      d.showModal?.();
    } else if (!open && d.open) {
      pickCtrl.current?.abort();
      d.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open || term.length < MIN_TERM) {
      setFound(NONE);
      setSearching(false);
      return undefined;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      const opts = { country, signal: ctrl.signal };
      const [albums, artists] = await Promise.allSettled([searchAlbums(term, opts), searchArtists(term, opts)]);
      if (ctrl.signal.aborted) return;
      setFound({
        albums: albums.status === 'fulfilled' ? albums.value : [],
        artists: artists.status === 'fulfilled' ? artists.value : [],
      });
      // one half failing still leaves the other half usable
      const failed = albums.status === 'rejected' && artists.status === 'rejected';
      setError(failed ? searchErrorMessage(albums.reason) : null);
      setSearching(false);
    }, SEARCH_DELAY);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [open, term, country]);

  const pick = async (type, item) => {
    if (picking) return;
    const ctrl = new AbortController();
    pickCtrl.current = ctrl;
    setPicking(`${type}:${item.id}`);
    setError(null);
    try {
      const got = await (type === 'album' ? albumTracks : artistTracks)(item.id, { country, signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      if (!got.tracks.length) {
        setError(`No playable songs for “${item.name}” in this store.`);
        return;
      }
      const name = type === 'album' ? got.name || item.name : `${got.name || item.name} — songs`;
      const saved = saveCustom({
        name: name.slice(0, 60),
        color: 'pink',
        tracks: got.tracks.map(({ id, title, artist }) => ({ id, title, artist })),
        source: { type, id: item.id },
      });
      if (!saved) setError('Couldn’t save — storage full?');
      else onSaved?.(saved);
    } catch (err) {
      const msg = searchErrorMessage(err);
      if (msg) setError(msg);
    } finally {
      if (!ctrl.signal.aborted) setPicking(null);
    }
  };

  const total = found.albums.length + found.artists.length;
  const status = picking
    ? 'Fetching songs…'
    : term.length < MIN_TERM
      ? ''
      : searching
        ? 'Searching…'
        : error
          ? ''
          : total
            ? `${plural(found.albums.length, 'album')}, ${plural(found.artists.length, 'artist')}`
            : 'Nothing found';

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby={`${uid}-t`} onClose={onClose}>
      <form method="dialog" className={styles.body} onSubmit={(e) => e.preventDefault()}>
        <h2 className={styles.title} id={`${uid}-t`}>
          Album or artist
        </h2>
        <p className={styles.note}>Pick one and its songs become a playlist of yours.</p>

        <label className="visually-hidden" htmlFor={`${uid}-q`}>
          Search iTunes for an album or an artist
        </label>
        <input
          id={`${uid}-q`}
          className={styles.input}
          type="search"
          value={query}
          placeholder="Search an album or artist"
          autoComplete="off"
          enterKeyHint="search"
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className={styles.status} role="status" aria-live="polite">
          {status}
        </p>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        {total ? (
          <div className={styles.results}>
            {found.albums.length ? (
              <section aria-labelledby={`${uid}-al`}>
                <h3 className={styles.groupTitle} id={`${uid}-al`}>
                  Albums
                </h3>
                <ul className={styles.rows} role="list">
                  {found.albums.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className={styles.row}
                        aria-disabled={picking ? true : undefined}
                        aria-busy={picking === `album:${a.id}` || undefined}
                        onClick={() => pick('album', a)}
                      >
                        {a.artwork ? (
                          <img className={styles.thumb} src={a.artwork} alt="" width="48" height="48" loading="lazy" />
                        ) : (
                          <span className={styles.thumb} aria-hidden="true" />
                        )}
                        <span className={styles.text}>
                          <span className={styles.name}>{a.name}</span>
                          <span className={styles.meta}>
                            {a.artist}
                            {a.year ? ` · ${a.year}` : ''} · {plural(a.trackCount, 'song')}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {found.artists.length ? (
              <section aria-labelledby={`${uid}-ar`}>
                <h3 className={styles.groupTitle} id={`${uid}-ar`}>
                  Artists
                </h3>
                <ul className={styles.rows} role="list">
                  {found.artists.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className={`${styles.row} ${styles.artist}`}
                        aria-disabled={picking ? true : undefined}
                        aria-busy={picking === `artist:${a.id}` || undefined}
                        onClick={() => pick('artist', a)}
                      >
                        <span className={styles.text}>
                          <span className={styles.name}>{a.name}</span>
                          {a.genre ? <span className={styles.meta}>{a.genre}</span> : null}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}

        <div className={styles.actions}>
          <ArcadeButton variant="neutral" size="sm" onClick={onClose}>
            Cancel
          </ArcadeButton>
        </div>
      </form>
    </dialog>
  );
}
