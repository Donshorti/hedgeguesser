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

  const cls = [styles.sign, pulse ? styles.flashing : '', className].filter(Boolean).join(' ');

  return (
    <Tag className={cls}>
      <span className="visually-hidden">HedgeGuesser</span>
      <span className={styles.board} aria-hidden="true">
        <span className={styles.tube} key={pulse}>
          {WORD.split('').map((ch, i) => (
            <span key={i} className={FLICKER[i] ? `${styles.ch} ${styles[FLICKER[i]]}` : styles.ch}>
              {ch}
            </span>
          ))}
        </span>
      </span>
    </Tag>
  );
}
