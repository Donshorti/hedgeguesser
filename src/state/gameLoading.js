import { normalizeTitle } from '../utils/normalize.js';
import { shuffle } from '../utils/shuffle.js';

/** How many recently played songs an endless refill keeps out. */
export const REFILL_GAP = 5;

/** First occurrence of each track id wins. */
export function dedupeTracks(tracks) {
  const seen = new Set();
  return tracks.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

/**
 * Endless refill: the whole pool reshuffled, minus the last REFILL_GAP songs
 * played up to `index`, so a song never comes straight back.
 */
export function buildRefill(pool, queue, index, random) {
  const recent = new Set(queue.slice(Math.max(0, index - REFILL_GAP + 1), index + 1).map((t) => t.id));
  const rest = pool.filter((t) => !recent.has(t.id));
  return shuffle(rest.length ? rest : pool, random);
}

/**
 * Give id-less custom tracks the ids the loader resolved for them, matched by
 * normalized title. Returns null when nothing changed (no save needed).
 */
export function attachResolvedIds(rawTracks, resolved) {
  const byTitle = new Map();
  for (const t of resolved) {
    const key = normalizeTitle(t.title);
    if (key && !byTitle.has(key)) byTitle.set(key, t.id);
  }
  const known = new Set(rawTracks.filter((t) => t.id).map((t) => t.id));
  let changed = false;
  const tracks = rawTracks.map((t) => {
    if (t.id) return t;
    const id = byTitle.get(normalizeTitle(t.title));
    if (id == null || known.has(id)) return t;
    known.add(id);
    changed = true;
    return { ...t, id };
  });
  return changed ? tracks : null;
}
