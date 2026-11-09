import { useEffect, useMemo, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton.jsx';
import Marquee from '../components/Marquee.jsx';
import ScoreBoard from '../components/ScoreBoard.jsx';
import { PlayIcon } from '../components/icons.jsx';
import { loadScores } from '../services/scores.js';
import { useScreenActive } from '../state/ScreenActive.js';
import { usePageVisible, usePrefersReducedMotion } from '../state/environment.js';
import styles from './Home.module.css';

const CYCLE_MS = 4000;

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
  const any = tables.challenge.length > 0 || tables.endless.length > 0;
  const cycling = active && visible && !reduced && !held && !engaged && any;

  useEffect(() => {
    if (!cycling) return undefined;
    const t = setInterval(() => setMode((m) => (m === 'challenge' ? 'endless' : 'challenge')), CYCLE_MS);
    return () => clearInterval(t);
  }, [cycling]);

  const pick = (id) => {
    setHeld(true);
    setMode(id);
  };

  const onBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setEngaged(false);
  };

  return (
    <ScoreBoard
      tables={tables}
      mode={mode}
      onPick={pick}
      data-cycling={cycling || undefined}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setEngaged(true)}
      onPointerLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      onBlur={onBlur}
    />
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
