import { useEffect, useRef, useState } from 'react';
import styles from './AttemptLog.module.css';

/**
 * One row per stage: a missed guess gets a red MISS stamp and the text, a
 * skip reads SKIPPED, a hit HIT; unused rows are dim dashes. A new row
 * shakes the strip (CSS turns the shake off under reduced motion).
 */
export default function AttemptLog({ attempts, rows }) {
  const [shake, setShake] = useState(false);
  const count = useRef(attempts.length);
  useEffect(() => {
    const grew = attempts.length > count.current;
    count.current = attempts.length;
    if (!grew || attempts[attempts.length - 1]?.correct) return undefined;
    setShake(true);
    const t = setTimeout(() => setShake(false), 320);
    return () => clearTimeout(t);
  }, [attempts]);

  return (
    <ol className={`${styles.log} ${shake ? styles.shake : ''}`} aria-label="Attempts">
      {Array.from({ length: rows }, (_, i) => {
        const a = attempts[i];
        if (!a) {
          return (
            <li key={i} className={`${styles.row} ${styles.empty}`}>
              <span className="visually-hidden">Attempt {i + 1}: unused</span>
              <span aria-hidden="true">— — —</span>
            </li>
          );
        }
        if (a.type === 'skip') {
          return (
            <li key={i} className={styles.row}>
              <span className={`${styles.stamp} ${styles.skip}`}>Skipped</span>
            </li>
          );
        }
        return (
          <li key={i} className={styles.row}>
            <span className={`${styles.stamp} ${a.correct ? styles.hit : styles.miss}`}>{a.correct ? 'Hit' : 'Miss'}</span>
            <span className={styles.text}>{a.text}</span>
          </li>
        );
      })}
    </ol>
  );
}
