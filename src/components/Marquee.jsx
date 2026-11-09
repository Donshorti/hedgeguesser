import { useEffect, useRef, useState } from 'react';
import styles from './Marquee.module.css';

const WORD = 'HEDGEGUESSER';
// Tubes that misbehave, each on its own irregular clock.
const FLICKER = { 3: 'f1', 7: 'f2', 10: 'f3' };
const FLASH_MS = 600;

/**
 * The cabinet marquee: HEDGEGUESSER as a pink neon tube on a cyan-edged sign.
 * `flash` fires a 600ms full-brightness pulse whenever it changes to a truthy
 * value (pass a counter to re-trigger).
 */
export default function Marquee({ flash, as: Tag = 'h1', className }) {
  const [pulse, setPulse] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    if (!flash) return;
    setPulse((n) => n + 1);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPulse(0), FLASH_MS);
  }, [flash]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const boardCls = [styles.board, pulse ? styles.flashing : ''].filter(Boolean).join(' ');

  return (
    <Tag className={[styles.sign, className].filter(Boolean).join(' ')}>
      <span className="visually-hidden">HedgeGuesser</span>
      {/* re-keyed per pulse so a re-flash restarts every flash animation */}
      <span className={boardCls} aria-hidden="true" key={pulse}>
        <span className={styles.tube}>
          {WORD.split('').map((ch, i) =>
            FLICKER[i] ? (
              // flickering tube: a dark copy under the lit letter; only the lit layer's opacity animates
              <span key={i} className={`${styles.ch} ${styles.flick}`}>
                <span className={styles.dark}>{ch}</span>
                <span className={`${styles.lit} ${styles[FLICKER[i]]}`}>{ch}</span>
              </span>
            ) : (
              <span key={i} className={styles.ch}>
                {ch}
              </span>
            )
          )}
        </span>
      </span>
    </Tag>
  );
}
