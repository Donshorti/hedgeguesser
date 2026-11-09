import { useEffect, useRef, useState } from 'react';
import styles from './SegmentScore.module.css';

const ROLL_MS = 600;
// DSEG7 maps "!" to an all-segments-off cell the width of a digit.
const BLANK = '!';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Amber 7-segment score over dim "8" ghost segments. Rolls up from the
 * previously shown value to `value` over 600ms; decreases and reduced motion
 * are instant.
 */
export default function SegmentScore({ value = 0, digits = 6, label, className }) {
  const max = 10 ** digits - 1;
  const target = Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return undefined;
    // Only gains roll; a drop (reset, hint cost) lands instantly.
    if (target < from || prefersReducedMotion()) {
      shownRef.current = target;
      setShown(target);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / ROLL_MS);
      const v = Math.round(from + (target - from) * easeOut(t));
      shownRef.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const lit = String(shown).padStart(digits, BLANK);
  const ghost = '8'.repeat(digits);

  return (
    <div className={[styles.score, className].filter(Boolean).join(' ')}>
      {label ? (
        <span className={styles.label} aria-hidden="true">
          {label}
        </span>
      ) : null}
      <span className={styles.window}>
        <span className={styles.ghost} aria-hidden="true">
          {ghost}
        </span>
        <span className={styles.lit} aria-hidden="true">
          {lit}
        </span>
        <span className="visually-hidden">
          {label ? `${label}: ` : ''}
          {target}
        </span>
      </span>
    </div>
  );
}
