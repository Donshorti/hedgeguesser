import styles from './LedPips.module.css';

/**
 * A row of LED pips: `lit` of `total` glowing. Lives use red; pass a `label`
 * such as "3 lives left" (default: "3 of 5 lit").
 * `color` is a role name: 'red' | 'pink' | 'cyan' | 'amber'.
 */
export default function LedPips({ total, lit, color = 'red', label, className }) {
  const n = Math.max(0, Math.floor(total) || 0);
  const on = Math.max(0, Math.min(n, Math.floor(lit) || 0));
  const name = label ?? `${on} of ${n} lit`;
  return (
    <span
      className={[styles.pips, styles[color] ?? styles.red, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={name}
    >
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={i < on ? `${styles.pip} ${styles.on}` : styles.pip} />
      ))}
    </span>
  );
}
