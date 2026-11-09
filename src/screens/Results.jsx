import { useMemo, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton.jsx';
import InitialsEntry from '../components/InitialsEntry.jsx';
import SegmentScore from '../components/SegmentScore.jsx';
import { PlayIcon } from '../components/icons.jsx';
import { loadScores, saveScore } from '../services/scores.js';
import { qualifies } from '../utils/highScores.js';
import { runStats } from '../utils/runStats.js';
import styles from './Results.module.css';

/**
 * GAME OVER: the final score, the run's stats, and — when the score makes the
 * mode's top 10 — the arcade initials entry. Saving hands off to `onSaved`.
 */
export default function Results({ state, onAgain, onHome, onSaved }) {
  const { mode, score, results } = state;
  const stats = useMemo(() => runStats(results), [results]);
  // decided once per run so the entry doesn't vanish mid-typing
  const [onBoard] = useState(() => qualifies(loadScores(mode), score));

  const save = (initials) => {
    const date = Date.now();
    saveScore(mode, { initials, score, date });
    onSaved(mode, date);
  };

  return (
    <section className={styles.results}>
      <h1 className={styles.title} data-screen-heading>
        Game over
      </h1>
      <p className={styles.mode}>{mode === 'challenge' ? 'Challenge' : 'Endless'}</p>

      <SegmentScore value={score} digits={6} label="Final score" className={styles.score} />

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Songs guessed</dt>
          <dd>
            {stats.hits}
            <span className={styles.of}>/{stats.played}</span>
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>Average stage</dt>
          <dd>{stats.avgStage ?? '—'}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Best streak</dt>
          <dd>{stats.bestStreak}</dd>
        </div>
      </dl>

      {onBoard ? <InitialsEntry onSubmit={save} /> : null}

      <div className={styles.actions}>
        <ArcadeButton variant={onBoard ? 'cyan' : 'pink'} size="md" icon={<PlayIcon />} onClick={onAgain}>
          Play again
        </ArcadeButton>
        <ArcadeButton variant="cyan" size="sm" onClick={onHome}>
          Home
        </ArcadeButton>
      </div>
    </section>
  );
}
