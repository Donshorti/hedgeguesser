import { useEffect, useState } from 'react';

const RM = '(prefers-reduced-motion: reduce)';

function mq(query) {
  return typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null;
}

/** Live `prefers-reduced-motion: reduce`. */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => mq(RM)?.matches ?? false);
  useEffect(() => {
    const m = mq(RM);
    if (!m) return undefined;
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/** Live match state of any media query. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => mq(query)?.matches ?? false);
  useEffect(() => {
    const m = mq(query);
    if (!m) return undefined;
    const on = () => setMatches(m.matches);
    on();
    m.addEventListener?.('change', on);
    return () => m.removeEventListener?.('change', on);
  }, [query]);
  return matches;
}

const pageVisible =() => typeof document === 'undefined' || document.visibilityState !== 'hidden';

/** False while the browser tab is hidden. */
export function usePageVisible() {
  const [visible, setVisible] = useState(pageVisible);
  useEffect(() => {
    const on = () => setVisible(pageVisible());
    on();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}
