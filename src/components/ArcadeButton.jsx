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
  const cls = [styles.btn, styles[variant], styles[size], className].filter(Boolean).join(' ');
  return (
    <button type={type} className={cls} {...buttonProps}>
      <span className={styles.cap}>
        {icon ? <span className={styles.icon}>{icon}</span> : null}
        {children != null && children !== false ? <span className={styles.label}>{children}</span> : null}
      </span>
    </button>
  );
}
