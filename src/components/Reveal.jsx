import { useEffect, useRef, useState } from 'react';
import ArcadeButton from './ArcadeButton.jsx';
import Confetti from './Confetti.jsx';
import { NextIcon } from './icons.jsx';
import { useScreenActive } from '../state/ScreenActive.js';
import styles from './Reveal.module.css';

function isTypingTarget(el) {
  if (!el || el === document.body) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(el.tagName);
}

/** 600×600 store artwork in a CRT bezel; a lit placeholder if it never arrives. */
function Artwork({ src, title }) {
  const [failed, setFailed] = useState(!src);
  return (
    <div className={styles.bezel}>
      {failed ? (
        <div className={styles.noArt} aria-hidden="true">
          <span>{(title || '?').trim().charAt(0).toUpperCase()}</span>
        </div>
      ) : (
        <img
          className={styles.art}
          src={src}
          alt=""
          width="600"
          height="600"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

/**
 * The song card that replaces the input deck after a round. A hit shows the
 * amber "+N" (the status-strip score rolls up at the same moment) and fires
 * the confetti; a miss reads THE SONG WAS… in red, and Endless drops a life.
 * NEXT (or RESULTS on the final song) also answers to Enter.
 */
export default function Reveal({ track, outcome, result, stages, mode, isLast, onNext }) {
  const active = useScreenActive();
  const win = outcome === 'win';
  const [origin, setOrigin] = useState(null);

  // Burst from the artwork once it is laid out.
  const rootRef = useRef(null);
  useEffect(() => {
    if (!win) return;
    const r = rootRef.current?.querySelector(`.${styles.bezel}`)?.getBoundingClientRect();
    setOrigin(r ? { x: r.left + r.width / 2, y: r.top + r.height / 3 } : { x: window.innerWidth / 2, y: window.innerHeight / 3 });
  }, [win]);

  const next = useRef(onNext);
  next.current = onNext;
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Enter' || e.repeat || isTypingTarget(e.target)) return;
      e.preventDefault();
      next.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const stageSecs = result?.stage != null ? stages[result.stage] : null;

  return (
    <section ref={rootRef} className={`${styles.reveal} ${win ? styles.isWin : styles.isLose}`} aria-live="polite">
      <Artwork src={track.artwork} title={track.title} />

      <div className={styles.text}>
        {win ? (
          <p className={styles.verdict}>
            <span className={styles.got}>Got it at {stageSecs}s</span>
            <span className={styles.points}>+{result?.points ?? 0}</span>
          </p>
        ) : (
          <p className={styles.verdict}>
            <span className={styles.missed}>The song was…</span>
            {mode === 'endless' ? (
              <span className={styles.lifeLost}>
                <span className={styles.lostPip} aria-hidden="true" />
                <span aria-hidden="true">−1</span>
                <span className="visually-hidden">You lost a life</span>
              </span>
            ) : null}
          </p>
        )}
        <h2 className={styles.title}>{track.title}</h2>
        <p className={styles.meta}>
          <span className={styles.artist}>{track.artist}</span>
          {track.year ? <span className={styles.year}>{track.year}</span> : null}
        </p>
      </div>

      <div className={styles.actions}>
        <ArcadeButton variant="pink" size="md" icon={<NextIcon />} autoFocus onClick={onNext}>
          {isLast ? 'Results' : 'Next'}
        </ArcadeButton>
      </div>

      {win && origin ? <Confetti origin={origin} /> : null}
    </section>
  );
}
