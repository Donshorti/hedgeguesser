import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../state/environment.js';

const COUNT = 120;
const DURATION = 1200;
const COLORS = ['#ff2e97', '#20e3ff', '#ffb627'];
const GRAVITY = 1500; // px/s²

function makePixels(w, h, origin) {
  const ox = origin?.x ?? w / 2;
  const oy = origin?.y ?? h * 0.35;
  return Array.from({ length: COUNT }, () => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
    const speed = 420 + Math.random() * 520;
    return {
      x: ox + (Math.random() - 0.5) * 40,
      y: oy + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      drift: (Math.random() - 0.5) * 160,
      size: 4 + Math.round(Math.random() * 4),
      color: COLORS[(Math.random() * COLORS.length) | 0],
    };
  });
}

/**
 * One burst of square "pixels" (pink/cyan/amber) over a full-viewport canvas:
 * 1.2s of gravity and sideways drift, then the canvas removes itself.
 * Skipped entirely under reduced motion. `origin` is in viewport px.
 */
export default function Confetti({ origin }) {
  const reduced = usePrefersReducedMotion();
  const canvasRef = useRef(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (reduced) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return undefined;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pixels = makePixels(w, h, origin);
    let raf = 0;
    let last = performance.now();
    const start = last;
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / DURATION;
      ctx.clearRect(0, 0, w, h);
      if (t >= 1) {
        setDone(true);
        return;
      }
      ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
      for (const p of pixels) {
        p.vy += GRAVITY * dt;
        p.vx += p.drift * dt;
        p.vx *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // one burst per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  if (reduced || done) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 'var(--z-overlay)',
      }}
    />
  );
}
