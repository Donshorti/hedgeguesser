import { useEffect, useMemo, useState } from 'react';
import ArcadeButton from '../components/ArcadeButton.jsx';
import ScoreBoard from '../components/ScoreBoard.jsx';
import { BackIcon, PlayIcon } from '../components/icons.jsx';
import { loadScores } from '../services/scores.js';
import styles from './HighScores.module.css';

const FRESH_KEY = 'hg:newScore';

/** The score just entered on the Results screen, handed over once. */
function readFresh() {
  try {
    const v = JSON.parse(sessionStorage.getItem(FRESH_KEY) ?? 'null');
    return v && (v.mode === 'challenge' || v.mode === 'endless') && Number.isFinite(v.date) ? v : null;
  } catch {
    return null;
  }
}

export default function HighScores({ navigate }) {
  const tables = useMemo(() => ({ challenge: loadScores('challenge'), endless: loadScores('endless') }), []);
  const [fresh] = useState(readFresh);
  const [mode, setMode] = useState(fresh?.mode ?? 'challenge');

  useEffect(() => {
    try {
      sessionStorage.removeItem(FRESH_KEY);
    } catch {
      /* nothing to clear */
    }
  }, []);

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <ArcadeButton variant="cyan" size="sm" icon={<BackIcon />} aria-label="Back to home" onClick={() => navigate('/')} />
        <h1 className={styles.title} data-screen-heading>
          High scores
        </h1>
      </header>

      <ScoreBoard tables={tables} mode={mode} onPick={setMode} title={null} freshDate={fresh?.date} />

      <div className={styles.actions}>
        <ArcadeButton variant="pink" size="md" icon={<PlayIcon />} onClick={() => navigate('/play')}>
          Play
        </ArcadeButton>
      </div>
    </div>
  );
}
