import styles from './TitleStrip.module.css';

/**
 * A jukebox title strip: selection code (A1…), playlist name, song count,
 * genre colour band, and a selection lamp. Toggles on press.
 * `state` drives the look: 'ok' | 'resolving' | 'unavailable'. Unavailable strips
 * stay focusable (aria-disabled) so they can be discovered, but ignore presses.
 * `status` is the line shown for it, e.g. "resolving 12/50" or "unavailable".
 */
export default function TitleStrip({
  code,
  name,
  count,
  color = 'var(--pink)',
  selected = false,
  state = 'ok',
  status,
  onToggle,
  onClick,
  className,
  disabled,
  'aria-disabled': ariaDisabled,
  ...buttonProps
}) {
  const unavailable = state === 'unavailable';
  const handleClick = (e) => {
    if (unavailable) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
    if (!e.defaultPrevented) onToggle?.(e);
  };
  const cls = [styles.strip, selected ? styles.selected : '', className].filter(Boolean).join(' ');
  const songs = typeof count === 'number' ? `${count} ${count === 1 ? 'song' : 'songs'}` : count;
  const statusCls = unavailable ? styles.statusBad : state === 'resolving' ? styles.status : styles.statusOk;

  return (
    <button
      type="button"
      className={cls}
      aria-pressed={selected}
      style={{ '--band': color }}
      {...buttonProps}
      onClick={handleClick}
      disabled={disabled}
      aria-disabled={unavailable ? true : ariaDisabled}
    >
      <span className={styles.band} aria-hidden="true" />
      <span className={styles.code}>{code}</span>
      <span className={styles.body}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>
          {songs != null ? <span>{songs}</span> : null}
          {status ? <span className={statusCls}>{status}</span> : null}
        </span>
      </span>
      <span className={styles.lamp} aria-hidden="true" />
    </button>
  );
}
