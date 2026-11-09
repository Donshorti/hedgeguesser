import styles from './TitleStrip.module.css';

/**
 * A jukebox title strip: selection code (A1…), playlist name, song count,
 * genre colour band, and a selection lamp. Toggles on press.
 * `status` is an optional line such as "resolving 12/50" or "unavailable".
 */
export default function TitleStrip({
  code,
  name,
  count,
  color = 'var(--pink)',
  selected = false,
  status,
  onToggle,
  className,
  ...buttonProps
}) {
  const unavailable = typeof status === 'string' && /unavailable|failed|error/i.test(status);
  const cls = [styles.strip, selected ? styles.selected : '', unavailable ? styles.unavailable : '', className]
    .filter(Boolean)
    .join(' ');
  const songs = typeof count === 'number' ? `${count} ${count === 1 ? 'song' : 'songs'}` : count;

  return (
    <button
      type="button"
      className={cls}
      aria-pressed={selected}
      onClick={onToggle}
      style={{ '--band': color }}
      {...buttonProps}
    >
      <span className={styles.band} aria-hidden="true" />
      <span className={styles.code}>{code}</span>
      <span className={styles.body}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>
          {songs != null ? <span>{songs}</span> : null}
          {status ? <span className={unavailable ? styles.statusBad : styles.status}>{status}</span> : null}
        </span>
      </span>
      <span className={styles.lamp} aria-hidden="true" />
    </button>
  );
}
