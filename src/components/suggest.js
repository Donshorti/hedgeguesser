import { levenshtein, maxEdits } from '../utils/fuzzyMatch.js';
import { normalizeTitle } from '../utils/normalize.js';

export const MAX_SUGGESTIONS = 6;
export const MIN_QUERY = 2;

/** Pool titles deduped by normalized title: `[{ title, norm }]`. */
export function suggestionIndex(poolTitles) {
  const seen = new Map();
  for (const title of poolTitles) {
    const norm = normalizeTitle(title);
    if (norm && !seen.has(norm)) seen.set(norm, { title, norm });
  }
  return [...seen.values()];
}

/** Edit distance from the query to the closest-length prefix of `norm` (±1 char). */
function fuzzyPrefix(norm, q) {
  let best = Infinity;
  for (let n = q.length - 1; n <= q.length + 1; n++) best = Math.min(best, levenshtein(norm.slice(0, n), q));
  return best;
}

/**
 * Titles that start with, contain, or fuzzily start with the query
 * (a typo-tolerant prefix match), best first, at most MAX_SUGGESTIONS.
 */
export function suggest(index, query) {
  const q = normalizeTitle(query);
  if (q.length < MIN_QUERY) return [];
  const edits = Math.max(1, maxEdits(q.length));
  const ranked = [];
  for (const item of index) {
    let rank = -1;
    if (item.norm.startsWith(q)) rank = 0;
    else if (item.norm.includes(q)) rank = 1;
    else if (q.length >= 3 && fuzzyPrefix(item.norm, q) <= edits) rank = 2;
    if (rank >= 0) ranked.push({ rank, item });
  }
  ranked.sort((a, b) => a.rank - b.rank || a.item.norm.localeCompare(b.item.norm));
  return ranked.slice(0, MAX_SUGGESTIONS).map((r) => r.item.title);
}
