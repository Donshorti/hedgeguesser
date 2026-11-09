import { useEffect, useRef } from 'react';
import { usePageVisible, usePrefersReducedMotion } from '../state/environment.js';
import styles from './Equalizer.module.css';

const BARS = 20;
const REST = 0.08;
/** How often each bar picks a new target height. */
const RETARGET_MS = 110;

/** Small deterministic PRNG so each song gets its own dance. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(v) {
  let h = 2166136261;
  for (const ch of String(v ?? '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h;
}

/**
 * Cyan LED equalizer in the CRT window. While `playing` the bars chase
 * pseudo-random targets seeded by `seed`, eased per frame, louder as the
 * stage plays through (`getProgress()` → `{ t, limit }`). Idle: a still, seeded resting spectrum, dimmed.
 * Writes clip-paths directly, so the LED cells never stretch (no React renders per frame). Decorative.
 */
export default function Equalizer({ playing, seed, getProgress, active = true }) {
  const barsRef = useRef([]);
  const reduced = usePrefersReducedMotion();
  const visible = usePageVisible();

  useEffect(() => {
    const bars = barsRef.current;
    const setAll = (fn) => bars.forEach((el, i) => el && (el.style.clipPath = `inset(${((1 - fn(i)) * 100).toFixed(1)}% 0 0 0)`));
    const rand = mulberry32(hashSeed(seed));
    if (!playing || !active || !visible) {
      // resting spectrum: a still, seeded contour between 8% and 30%, so the glass never reads empty
      setAll((i) => REST + 0.22 * (0.35 + 0.65 * Math.sin(((i + 0.5) / BARS) * Math.PI)) * (0.45 + 0.55 * rand()));
      return undefined;
    }
    // fixed per-song contour so bass/treble bands keep a shape
    const contour = Array.from({ length: BARS }, (_, i) => 0.55 + 0.45 * Math.sin((i / BARS) * Math.PI) * (0.6 + 0.4 * rand()));
    if (reduced) {
      setAll((i) => 0.25 + 0.5 * contour[i]);
      return undefined;
    }
    const level = bars.map(() => REST);
    const target = bars.map(() => REST);
    let last = 0;
    let raf = 0;
    const frame = (now) => {
      if (now - last > RETARGET_MS) {
        last = now;
        const { t = 0, limit = 0 } = getProgress?.() ?? {};
        const swell = 0.6 + 0.4 * (limit ? Math.min(1, t / limit) : 0);
        for (let i = 0; i < BARS; i++) target[i] = Math.max(REST, contour[i] * swell * (0.25 + 0.75 * rand()));
      }
      for (let i = 0; i < BARS; i++) level[i] += (target[i] - level[i]) * 0.28;
      setAll((i) => level[i]);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, active, visible, reduced, seed, getProgress]);

  return (
    <div className={`${styles.eq} ${playing ? styles.on : ''}`} aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => (
        <span key={i} ref={(el) => (barsRef.current[i] = el)} className={styles.bar} />
      ))}
    </div>
  );
}
