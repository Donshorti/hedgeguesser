import { useEffect, useId, useMemo, useRef, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton.jsx';
import Marquee from '../components/Marquee.jsx';
import { PlayIcon } from '../components/icons.jsx';
import { loadScores } from '../services/scores.js';
import { useScreenActive } from '../state/ScreenActive.js';
import { usePageVisible, usePrefersReducedMotion } from '../state/environment.js';
import styles from './Home.module.css';

const CYCLE_MS = 4000;
const DIGITS = 6;
const MODES = [
  { id: 'challenge', label: 'Challenge' },
  { id: 'endless', label: 'Endless' },
];

function ordinal(n) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'TH' : (['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH');
  return `${n}${suffix}`;
}

function dateParts(ms) {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return null;
  const opts = { day: '2-digit', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = '2-digit';
  return { iso: d.toISOString(), text: d.toLocaleDateString(undefined, opts) };
}

/** Amber 7-segment digits over unlit "8" ghosts, sized by the row. */
function SegDigits({ value }) {
  const n = Math.max(0, Math.min(10 ** DIGITS - 1, Math.round(value)));
  return (
    <span className={styles.seg}>
      <span className={styles.segGhost} aria-hidden="true">
        {'8'.repeat(DIGITS)}
      </span>
      {/* DSEG7 draws "!" as an all-off digit cell */}
      <span className={styles.segLit} aria-hidden="true">
        {String(n).padStart(DIGITS, '!')}
      </span>
      <span className="visually-hidden">{n}</span>
    </span>
  );
}

function ScoreTable({ rows }) {
  if (!rows.length) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyLine}>No scores yet — be the first.</p>
        <p className={styles.emptyHint}>Finish a run and your initials go up here.</p>
      </div>
    );
  }
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Name</th>
          <th scope="col" className={styles.right}>
            Score
          </th>
          <th scope="col" className={`${styles.right} ${styles.dateCol}`}>
            Date
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const date = dateParts(r.date);
          return (
            <tr key={`${r.initials}-${r.date}-${i}`} className={i === 0 ? styles.top : undefined}>
              <td className={styles.rank}>{ordinal(i + 1)}</td>
              <td className={styles.initials}>{r.initials || '???'}</td>
              <td className={styles.right}>
                <SegDigits value={r.score} />
              </td>
              <td className={`${styles.right} ${styles.dateCol} ${styles.date}`}>
                {date ? <time dateTime={date.iso}>{date.text}</time> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * Attract-mode high-score board. Cycles Challenge ↔ Endless every 4s while
 * the screen is live, the tab is visible and nobody is pointing at or
 * focused in it; picking a tab takes over for good. Reduced motion: static.
 */
function AttractBoard({ tables }) {
  const active = useScreenActive();
  const reduced = usePrefersReducedMotion();
  const visible = usePageVisible();
  const [mode, setMode] = useState('challenge');
  const [held, setHeld] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const tabRefs = useRef({});
  const uid = useId();
  const any = tables.challenge.length > 0 || tables.endless.length > 0;
  const cycling = active && visible && !reduced && !held && !engaged && any;

  useEffect(() => {
    if (!cycling) return undefined;
    const t = setInterval(() => setMode((m) => (m === 'challenge' ? 'endless' : 'challenge')), CYCLE_MS);
    return () => clearInterval(t);
  }, [cycling]);

  const pick = (id, focus) => {
    setHeld(true);
    setMode(id);
    if (focus) tabRefs.current[id]?.focus();
  };

  const onTabKey = (e) => {
    const i = MODES.findIndex((m) => m.id === mode);
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = MODES[(i + 1) % MODES.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = MODES[(i + MODES.length - 1) % MODES.length];
    else if (e.key === 'Home') next = MODES[0];
    else if (e.key === 'End') next = MODES[MODES.length - 1];
    if (!next) return;
    e.preventDefault();
    pick(next.id, true);
  };

  const onBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setEngaged(false);
  };

  return (
    <section
      className={styles.board}
      aria-labelledby={`${uid}-title`}
      data-cycling={cycling || undefined}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setEngaged(true)}
      onPointerLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      onBlur={onBlur}
    >
      <header className={styles.boardHead}>
        <h2 id={`${uid}-title`} className={styles.boardTitle}>
          High scores
        </h2>
        <div role="tablist" aria-label="Game mode" className={styles.tabs} onKeyDown={onTabKey}>
          {MODES.map((m) => {
            const on = m.id === mode;
            return (
              <button
                key={m.id}
                ref={(el) => {
                  tabRefs.current[m.id] = el;
                }}
                type="button"
                role="tab"
                id={`${uid}-tab-${m.id}`}
                aria-selected={on}
                aria-controls={`${uid}-panel`}
                tabIndex={on ? 0 : -1}
                className={styles.tab}
                onClick={() => pick(m.id)}
              >
                <span className={styles.tabLamp} aria-hidden="true" />
                {m.label}
              </button>
            );
          })}
        </div>
      </header>
      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${mode}`} className={styles.glass}>
        {/* re-keyed per mode so the page-in runs on each switch */}
        <div key={mode} className={styles.page}>
          <ScoreTable rows={tables[mode]} />
        </div>
      </div>
    </section>
  );
}

// The marquee is the screen's h1 (route focus falls back to it).
export default function Home({ navigate }) {
  // Home remounts on every visit, so this is always the latest table.
  const tables = useMemo(() => ({ challenge: loadScores('challenge'), endless: loadScores('endless') }), []);

  return (
    <div className={styles.screen}>
      <Marquee as="h1" />

      <div className={styles.start}>
        <span className={styles.halo} aria-hidden="true" data-decor />
        <ArcadeButton variant="pink" size="xl" icon={<PlayIcon />} onClick={() => navigate('/play')}>
          Press start
        </ArcadeButton>
      </div>

      <AttractBoard tables={tables} />

      <nav className={styles.nav} aria-label="Main">
        <ArcadeButton variant="cyan" size="sm" onClick={() => navigate('/playlists')}>
          Playlists
        </ArcadeButton>
        <ArcadeButton variant="amber" size="sm" onClick={() => navigate('/scores')}>
          High scores
        </ArcadeButton>
        <ArcadeButton variant="cyan" size="sm" onClick={() => navigate('/settings')}>
          Settings
        </ArcadeButton>
      </nav>
    </div>
  );
}
