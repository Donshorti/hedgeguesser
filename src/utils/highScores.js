export const MAX_SCORES = 10;

/** Highest score first; ties go to the earlier entry. */
const byRank = (a, b) => b.score - a.score || a.date - b.date;

export function qualifies(list, score) {
  if (!(score > 0)) return false;
  if (list.length < MAX_SCORES) return true;
  return score > list[list.length - 1].score;
}

export function insertScore(list, entry) {
  return [...list, entry].sort(byRank).slice(0, MAX_SCORES);
}

export function sanitizeInitials(s) {
  return String(s ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
}

/** Validate a stored table; anything malformed is dropped and the rest re-ranked. */
export function readTable(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e) => e && typeof e.initials === 'string' && Number.isFinite(e.score))
    .sort(byRank)
    .slice(0, MAX_SCORES);
}
