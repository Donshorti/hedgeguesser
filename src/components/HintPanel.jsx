import { HINTS } from '../config/gameConfig.js';
import { hintText } from '../utils/hints.js';
import styles from './HintPanel.module.css';

export const HINT_NAMES = { year: 'Year', genre: 'Genre', artistInitials: 'Artist', firstLetter: 'Title' };

/**
 * Bought hints stay on show for the song; with `open`, the four tiles to buy
 * from (amber cost; disabled when used or unaffordable). A bought tile flips
 * to its answer.
 */
export default function HintPanel({ id, open, track, hintsUsed, costs, score, onBuy }) {
  if (!open && !hintsUsed.length) return null;
  const shown = open ? HINTS : HINTS.filter((h) => hintsUsed.includes(h));
  return (
    <ul id={id} className={styles.tiles} aria-label="Hints">
      {shown.map((h) => {
        const used = hintsUsed.includes(h);
        const cost = costs?.[h] ?? 0;
        return (
          <li key={h}>
            {used ? (
              <div className={`${styles.tile} ${styles.flipped}`}>
                <span className={styles.name}>{HINT_NAMES[h]}</span>
                <span className={styles.answer}>{hintText(h, track)}</span>
              </div>
            ) : (
              <button type="button" className={styles.tile} disabled={score < cost} onClick={() => onBuy(h)}>
                <span className={styles.name}>{HINT_NAMES[h]}</span>
                <span className={styles.cost}>
                  {cost}
                  <span className="visually-hidden"> points</span>
                </span>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
