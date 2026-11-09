import ArcadeButton from './ArcadeButton.jsx';
import { BackIcon } from './icons.jsx';
import styles from './OutOfOrder.module.css';

const CAUSES = {
  offline: { text: "Can't reach iTunes. Check your connection.", retry: true },
  busy: { text: 'iTunes is busy — give it a minute.', retry: true },
  'not-enough': { text: 'Not enough playable songs in that selection.', retry: false },
};

/**
 * The cabinet's "OUT OF ORDER" card, taped across the screen. `cause` picks
 * the message; RETRY shows only for causes a second try can fix.
 */
export default function OutOfOrder({ cause, onRetry, onBack, backLabel = 'Back' }) {
  const c = CAUSES[cause] ?? CAUSES.offline;
  return (
    <section className={styles.sign} role="alert" aria-labelledby="out-of-order-title">
      <span className={`${styles.tape} ${styles.tapeTop}`} aria-hidden="true" />
      <h1 id="out-of-order-title" className={styles.title} data-screen-heading>
        Out of order
      </h1>
      <p className={styles.text}>{c.text}</p>
      <div className={styles.actions}>
        {c.retry && onRetry ? (
          <ArcadeButton variant="amber" size="md" onClick={onRetry}>
            Retry
          </ArcadeButton>
        ) : null}
        <ArcadeButton variant="neutral" size="md" icon={<BackIcon />} onClick={onBack}>
          {backLabel}
        </ArcadeButton>
      </div>
      <span className={`${styles.tape} ${styles.tapeBottom}`} aria-hidden="true" />
    </section>
  );
}
