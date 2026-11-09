import { useId, useRef } from 'react';
import styles from './ScoreBoard.module.css';

const DIGITS = 6;
export const MODES = [
  { id: 'challenge', label: 'Challenge' },
  { id: 'endless', label: 'Endless' },
];

function ordinal(n) {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'TH' : (['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH');
  return `${n}${suffix}`;
}

function dateParts(ms) {
  const d = new Date(ms);
  if (!Number.isFinite(d.getTime())) return null;
  const opts = { day: '2-digit', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = '2-digit';
  return { iso: d.toISOString(), text: d.toLocaleDateString(undefined, opts) };
}

/** Amber 7-segment digits over unlit "8" ghosts, sized by the row. */
function SegDigits({ value }) {
  const n = Math.max(0, Math.min(10 ** DIGITS - 1, Math.round(value)));
  return (
    <span className={styles.seg}>
      <span className={styles.segGhost} aria-hidden="true">
        {'8'.repeat(DIGITS)}
      </span>
      {/* DSEG7 draws "!" as an all-off digit cell */}
      <span className={styles.segLit} aria-hidden="true">
        {String(n).padStart(DIGITS, '!')}
      </span>
      <span className="visually-hidden">{n}</span>
    </span>
  );
}

/** Top-10 table: rank · initials · score · date. `freshDate` lights that row. */
export function ScoreTable({ rows, freshDate }) {
  if (!rows.length) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyLine}>No scores yet — be the first.</p>
        <p className={styles.emptyHint}>Finish a run and your initials go up here.</p>
      </div>
    );
  }
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Name</th>
          <th scope="col" className={styles.right}>
            Score
          </th>
          <th scope="col" className={`${styles.right} ${styles.dateCol}`}>
            Date
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const date = dateParts(r.date);
          const fresh = freshDate != null && r.date === freshDate;
          const cls = [i === 0 ? styles.top : '', fresh ? styles.fresh : ''].filter(Boolean).join(' ');
          return (
            <tr
              key={`${r.initials}-${r.date}-${i}`}
              className={cls || undefined}
              aria-current={fresh ? 'true' : undefined}
            >
              <td className={styles.rank}>{ordinal(i + 1)}</td>
              <td className={styles.initials}>{r.initials || '???'}</td>
              <td className={styles.right}>
                <SegDigits value={r.score} />
              </td>
              <td className={`${styles.right} ${styles.dateCol} ${styles.date}`}>
                {date ? <time dateTime={date.iso}>{date.text}</time> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * The high-score board: a cabinet panel with Challenge/Endless lamp tabs over
 * a CRT window holding the table. Controlled: `mode` + `onPick(id)`.
 * Extra props (pointer/focus handlers, data-*) land on the section.
 */
export default function ScoreBoard({ tables, mode, onPick, title = 'High scores', freshDate, ...sectionProps }) {
  const tabRefs = useRef({});
  const uid = useId();

  const onTabKey = (e) => {
    const i = MODES.findIndex((m) => m.id === mode);
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = MODES[(i + 1) % MODES.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = MODES[(i + MODES.length - 1) % MODES.length];
    else if (e.key === 'Home') next = MODES[0];
    else if (e.key === 'End') next = MODES[MODES.length - 1];
    if (!next) return;
    e.preventDefault();
    onPick(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <section
      className={styles.board}
      aria-labelledby={title ? `${uid}-title` : undefined}
      aria-label={title ? undefined : 'High scores'}
      {...sectionProps}
    >
      <header className={styles.boardHead}>
        {title ? (
          <h2 id={`${uid}-title`} className={styles.boardTitle}>
            {title}
          </h2>
        ) : null}
        <div role="tablist" aria-label="Game mode" className={styles.tabs} onKeyDown={onTabKey}>
          {MODES.map((m) => {
            const on = m.id === mode;
            return (
              <button
                key={m.id}
                ref={(el) => {
                  tabRefs.current[m.id] = el;
                }}
                type="button"
                role="tab"
                id={`${uid}-tab-${m.id}`}
                aria-selected={on}
                aria-controls={`${uid}-panel`}
                tabIndex={on ? 0 : -1}
                className={styles.tab}
                onClick={() => onPick(m.id)}
              >
                <span className={styles.tabLamp} aria-hidden="true" />
                {m.label}
              </button>
            );
          })}
        </div>
      </header>
      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${mode}`} className={styles.glass}>
        {/* re-keyed per mode so the page-in runs on each switch */}
        <div key={mode} className={styles.page}>
          <ScoreTable rows={tables[mode]} freshDate={freshDate} />
        </div>
      </div>
    </section>
  );
}
