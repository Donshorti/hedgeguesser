import styles from './StageLadder.module.css';

/** Stage 1 is tiny in seconds; give it enough width to see and tap. */
const MIN_FIRST = 0.16;

/**
 * Fractions of the ladder width per stage: proportional to duration, the first
 * one floored, and never narrower than the stage before it (a longer clip is
 * never drawn shorter). Floor + monotone + renormalise, repeated to settle.
 */
export function ladderWidths(stages) {
  const total = stages[stages.length - 1] || 1;
  let w = stages.map((s, i) => Math.max(0, s - (i ? stages[i - 1] : 0)) / total);
  for (let pass = 0; pass < 40; pass++) {
    w[0] = Math.max(w[0], MIN_FIRST);
    for (let i = 1; i < w.length; i++) w[i] = Math.max(w[i], w[i - 1]);
    const sum = w.reduce((a, b) => a + b, 0) || 1;
    w = w.map((x) => x / sum);
  }
  return w;
}

/** Playhead position 0..1 for time `t`, piecewise across the (non-linear) segments. */
export function playheadAt(t, stages, widths) {
  let x = 0;
  for (let i = 0; i < stages.length; i++) {
    const from = i ? stages[i - 1] : 0;
    if (t <= stages[i]) return x + widths[i] * Math.max(0, (t - from) / (stages[i] - from));
    x += widths[i];
  }
  return 1;
}

const fmt = (s) => `${s}s`;

/**
 * The four-stage ladder: segment widths follow stage durations; locked stages
 * are dark, the current one lit cyan, used ones dim with a red tick (miss or
 * skip). `t` sweeps the playhead while audio plays (null hides it).
 */
export default function StageLadder({ stages, stage, attempts, outcome, t }) {
  const widths = ladderWidths(stages);
  const showHead = t != null;
  const x = showHead ? playheadAt(t, stages, widths) : 0;
  return (
    <div className={styles.ladder}>
      <p className="visually-hidden" aria-live="polite">
        Stage {stage + 1} of {stages.length}: {fmt(stages[stage])}
      </p>
      <div className={styles.track} aria-hidden="true">
        {stages.map((s, i) => {
          const used = i < stage || (i === stage && outcome === 'lose');
          const won = i === stage && outcome === 'win';
          const cls = won ? styles.won : used ? styles.used : i === stage ? styles.current : styles.locked;
          return (
            <span key={i} className={`${styles.seg} ${cls}`} style={{ flexGrow: widths[i] }}>
              {used && attempts[i] ? <span className={styles.tick} /> : null}
            </span>
          );
        })}
        {showHead ? <span className={styles.head} style={{ left: `${(x * 100).toFixed(2)}%` }} /> : null}
      </div>
      <ol className={styles.labels} aria-hidden="true">
        {stages.map((s, i) => (
          <li key={i} style={{ flexGrow: widths[i] }} className={i === stage ? styles.labelOn : undefined}>
            {fmt(s)}
          </li>
        ))}
      </ol>
    </div>
  );
}
