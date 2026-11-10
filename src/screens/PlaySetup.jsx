import { useId, useMemo, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton.jsx';
import LedPips from '../components/LedPips.jsx';
import TitleStrip from '../components/TitleStrip.jsx';
import { BackIcon, CoinIcon, PlayIcon } from '../components/icons.jsx';
import { getAllPlaylists } from '../services/catalog.js';
import { load } from '../services/storage.js';
import { useSettings } from '../state/SettingsContext.jsx';
import { requestCatalogSearch } from './playlistEdit.js';
import styles from './PlaySetup.module.css';

const MODES = ['challenge', 'endless'];

/** One song counted once, even when two picked playlists share it. */
function songKey(t) {
  if (t?.id != null) return `id:${t.id}`;
  return `t:${String(t?.title ?? '').toLowerCase()}|${String(t?.artist ?? '').toLowerCase()}`;
}

const playable = (p) => p.tracks.length > 0;

/** The last run's setup, minus anything that no longer exists or has no songs. */
function restoreSetup(catalog) {
  const last = load('lastSetup', null);
  const mode = MODES.includes(last?.mode) ? last.mode : 'challenge';
  const ok = new Set(catalog.filter(playable).map((p) => p.id));
  const ids = Array.isArray(last?.playlistIds) ? last.playlistIds.filter((id) => ok.has(id)) : [];
  // first run: the first house strip (A1) is already punched, so START is live
  if (!last) {
    const first = catalog.find((p) => !p.custom && playable(p));
    if (first) ids.push(first.id);
  }
  return { mode, selected: new Set(ids) };
}

function Strips({ playlists, selected, onToggle }) {
  return (
    <ul className={styles.strips} role="list">
      {playlists.map((p) => {
        const empty = !playable(p);
        return (
          <li key={p.id}>
            <TitleStrip
              code={p.code}
              name={p.name}
              count={empty ? undefined : p.tracks.length}
              color={`var(--${p.color})`}
              selected={selected.has(p.id)}
              state={empty ? 'unavailable' : 'ok'}
              status={empty ? 'no songs yet' : undefined}
              onToggle={() => onToggle(p.id)}
            />
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Play setup: pick a mode, punch in jukebox selections, insert coin.
 * `onStart({ mode, playlistIds })` hands the run to the app.
 */
export default function PlaySetup({ navigate, onStart }) {
  const [settings] = useSettings();
  const catalog = useMemo(() => getAllPlaylists(), []);
  const [initial] = useState(() => restoreSetup(catalog));
  const [mode, setMode] = useState(initial.mode);
  const [selected, setSelected] = useState(initial.selected);
  const uid = useId();

  const house = catalog.filter((p) => !p.custom);
  const mine = catalog.filter((p) => p.custom);
  const length = settings.challengeLength;
  const lives = settings.endlessLives;

  const picked = useMemo(() => catalog.filter((p) => selected.has(p.id)), [catalog, selected]);
  const songs = useMemo(() => {
    const keys = new Set();
    picked.forEach((p) => p.tracks.forEach((t) => keys.add(songKey(t))));
    return keys.size;
  }, [picked]);
  const ready = picked.length > 0 && songs > 0;
  const shortRun = ready && mode === 'challenge' && songs < length;

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = (e) => {
    e.preventDefault();
    if (!ready) return;
    // catalog order, so the same picks always give the same setup
    onStart?.({ mode, playlistIds: picked.map((p) => p.id) });
  };

  const summary = ready
    ? `${songs} ${songs === 1 ? 'song' : 'songs'} from ${picked.length} ${picked.length === 1 ? 'playlist' : 'playlists'}`
    : 'No playlists picked';

  return (
    <form className={styles.screen} onSubmit={submit} noValidate>
      <header className={styles.top}>
        <ArcadeButton variant="neutral" size="sm" icon={<BackIcon />} onClick={() => navigate('/')}>
          Back
        </ArcadeButton>
        <h1 className={styles.title} data-screen-heading>
          Set up a run
        </h1>
      </header>

      {/* ---- mode ---- */}
      <fieldset className={styles.group}>
        <legend className={styles.groupTitle}>Game mode</legend>
        <div className={styles.modes}>
          <label className={styles.mode}>
            <input
              className="visually-hidden"
              type="radio"
              name={`${uid}-mode`}
              value="challenge"
              checked={mode === 'challenge'}
              onChange={() => setMode('challenge')}
              aria-describedby={`${uid}-rule-c`}
            />
            <span className={styles.modeLamp} aria-hidden="true" />
            <span className={styles.modeName}>{length}-song challenge</span>
            <span className={styles.modeRule} id={`${uid}-rule-c`}>
              {length} songs. Faster guess, bigger score.
            </span>
            <span className={styles.modeBadge} aria-hidden="true">
              <span className={styles.seg}>
                <span className={styles.segGhost}>88</span>
                <span className={styles.segLit}>{String(Math.min(99, length)).padStart(2, '!')}</span>
              </span>
              <span className={styles.badgeLabel}>songs</span>
            </span>
          </label>

          <label className={styles.mode}>
            <input
              className="visually-hidden"
              type="radio"
              name={`${uid}-mode`}
              value="endless"
              checked={mode === 'endless'}
              onChange={() => setMode('endless')}
              aria-describedby={`${uid}-rule-e`}
            />
            <span className={styles.modeLamp} aria-hidden="true" />
            <span className={styles.modeName}>Endless</span>
            <span className={styles.modeRule} id={`${uid}-rule-e`}>
              Keep going until you’re out of lives.
            </span>
            <span className={styles.modeBadge}>
              <LedPips total={lives} lit={lives} color="red" label={`${lives} ${lives === 1 ? 'life' : 'lives'}`} />
            </span>
          </label>
        </div>
      </fieldset>

      {/* ---- jukebox ---- */}
      <section className={styles.group} aria-labelledby={`${uid}-house`}>
        <h2 className={styles.groupTitle} id={`${uid}-house`}>
          House selection
        </h2>
        <Strips playlists={house} selected={selected} onToggle={toggle} />
      </section>

      <section className={styles.group} aria-labelledby={`${uid}-mine`}>
        <div className={styles.groupHead}>
          <h2 className={styles.groupTitle} id={`${uid}-mine`}>
            Your playlists
          </h2>
          <ArcadeButton
            variant="neutral"
            size="sm"
            onClick={() => {
              requestCatalogSearch();
              navigate('/playlists');
            }}
          >
            Album or artist
          </ArcadeButton>
        </div>
        {mine.length ? (
          <Strips playlists={mine} selected={selected} onToggle={toggle} />
        ) : (
          <p className={styles.none}>
            Nothing of your own yet. <a href="#/playlists">Build a playlist</a> or import one, and it lands here.
          </p>
        )}
      </section>

      {/* ---- control deck ---- */}
      <div className={styles.deck}>
        <div className={styles.readout}>
          <span className={styles.count} aria-hidden="true">
            <span className={styles.seg}>
              <span className={styles.segGhost}>888</span>
              <span className={styles.segLit}>{String(Math.min(999, songs)).padStart(3, '!')}</span>
            </span>
            <span className={styles.badgeLabel}>songs</span>
          </span>
          <span className={styles.readoutText}>
            <span className={styles.summary} role="status">
              {summary}
              {shortRun ? <span className="visually-hidden">. Short run: {songs} songs.</span> : null}
            </span>
            {shortRun ? (
              <span className={styles.short} aria-hidden="true">
                Short run: {songs} {songs === 1 ? 'song' : 'songs'}
              </span>
            ) : !ready ? (
              <span className={styles.hint}>Pick at least one playlist.</span>
            ) : null}
          </span>
        </div>
        <ArcadeButton type="submit" variant="pink" size="md" icon={<CoinIcon />} disabled={!ready} className={styles.go}>
          <span className={styles.goLabel}>
            Insert coin
            <PlayIcon className={styles.goArrow} />
            Start
          </span>
        </ArcadeButton>
      </div>
    </form>
  );
}
