import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Route table. `path` is the pattern; `:name` segments become params.
 * Hash routing keeps GitHub Pages deep links working with no 404 setup.
 */
export const ROUTES = [
  '/',
  '/play',
  '/game',
  '/scores',
  '/playlists',
  '/playlists/:id',
  '/settings',
];

const HOME = Object.freeze({ path: '/', params: Object.freeze({}), location: '/', matched: true });

function decode(seg) {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/**
 * Pure hash parser.
 * Returns `{ path, params, location, matched }`:
 *   path     — the matched route pattern, e.g. '/playlists/:id'
 *   params   — decoded `:name` segments, e.g. { id: 'abc' }
 *   location — the normalised concrete path, e.g. '/playlists/abc'
 *   matched  — false when the hash named an unknown route (caller redirects home)
 * Empty hash, '#' and '#/' are home. A trailing slash is tolerated.
 */
export function parseHash(hash) {
  let raw = typeof hash === 'string' ? hash : '';
  if (raw.startsWith('#')) raw = raw.slice(1);
  raw = raw.split('?')[0];
  if (raw === '' || raw === '/') return HOME;
  if (!raw.startsWith('/')) return { ...HOME, matched: false };

  const segs = raw.split('/').filter(Boolean);
  if (segs.length === 0) return HOME;

  for (const pattern of ROUTES) {
    const parts = pattern.split('/').filter(Boolean);
    if (parts.length !== segs.length) continue;
    const params = {};
    const ok = parts.every((p, i) => {
      if (p.startsWith(':')) {
        params[p.slice(1)] = decode(segs[i]);
        return true;
      }
      return p === segs[i];
    });
    if (ok) return { path: pattern, params, location: `/${segs.join('/')}`, matched: true };
  }
  return { ...HOME, matched: false };
}

/** '/settings', '#/settings' or 'settings' → '#/settings'. */
export function toHash(to) {
  const s = String(to ?? '/').replace(/^#/, '');
  return `#${s.startsWith('/') ? s : `/${s}`}`;
}

function currentHash() {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

/**
 * `useHashRoute()` → `{ path, params, location, navigate }`.
 * Unknown routes are replaced (not pushed) with '#/' so Back never returns to them.
 * `navigate(to, { replace })` sets the hash; the hashchange listener does the rest.
 */
export function useHashRoute() {
  const [route, setRoute] = useState(() => parseHash(currentHash()));
  const routeRef = useRef(route);
  routeRef.current = route;

  useEffect(() => {
    const sync = () => {
      const next = parseHash(window.location.hash);
      if (!next.matched) {
        window.history.replaceState(window.history.state, '', '#/');
      }
      setRoute((prev) => (prev.location === next.location ? prev : next));
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    const hash = toHash(to);
    // already there (also covers '' / '#' / '#/' all meaning home): no duplicate history entry
    if (parseHash(hash).location === routeRef.current.location) return;
    if (replace) {
      window.history.replaceState(window.history.state, '', hash);
      // replaceState fires no hashchange; tell the listener ourselves
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      window.location.hash = hash;
    }
  }, []);

  return { path: route.path, params: route.params, location: route.location, navigate };
}
