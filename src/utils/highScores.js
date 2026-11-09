export const MAX_SCORES = 10;

export function qualifies(list, score) {
  if (!(score > 0)) return false;
  if (list.length < MAX_SCORES) return true;
  return score > list[list.length - 1].score;
}

export function insertScore(list, entry) {
  return [...list, entry]
    .sort((a, b) => b.score - a.score || a.date - b.date)
    .slice(0, MAX_SCORES);
}

export function sanitizeInitials(s) {
  return String(s ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
}

/** Validate a stored table; anything malformed is dropped. */
export function readTable(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e) => e && typeof e.initials === 'string' && Number.isFinite(e.score))
    .slice(0, MAX_SCORES);
}
