import styles from './ArcadeButton.module.css';

/**
 * A coin-op arcade button: black housing, concave lit cap that physically
 * depresses. `xl` is the round hero button; `md`/`sm` are pills.
 * Disabled reads as an unlit cap.
 */
export default function ArcadeButton({
  variant = 'pink',
  size = 'md',
  icon,
  children,
  className,
  type = 'button',
  ...buttonProps
}) {
  const hasText = children != null && children !== false && children !== '';
  if (import.meta.env.DEV && !hasText && !buttonProps['aria-label'] && !buttonProps['aria-labelledby']) {
    console.warn('ArcadeButton: icon-only buttons need an aria-label.');
  }
  const cls = [styles.btn, styles[variant], styles[size], className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...buttonProps}>
      <span className={styles.cap}>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
        {hasText ? <span className={styles.label}>{children}</span> : null}
      </span>
    </button>
  );
}
