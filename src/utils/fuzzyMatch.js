import { normalizeTitle, titleVariants } from './normalize.js';

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Allowed typos for an answer of `len` normalized characters. */
export function maxEdits(len) {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  if (len <= 14) return 2;
  return Math.floor(len * 0.15);
}

/** 0..1 similarity of two already-normalized strings. */
export function similarity(a, b) {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 1;
  return 1 - levenshtein(a, b) / longest;
}

function guessForms(guess) {
  const raw = String(guess ?? '').trim();
  const forms = [raw];
  const parts = raw.split(/\s+[-–—]\s+/);
  if (parts.length > 1) forms.push(parts[0]);
  return [...new Set(forms.map(normalizeTitle).filter(Boolean))];
}

/**
 * Title-only correctness check.
 * @param {string} guess   what the player typed
 * @param {string} title   the answer's raw title
 * @param {string[]} poolTitles raw titles in the active pool (for decoy rejection)
 */
export function isCorrectGuess(guess, title, poolTitles = []) {
  const guesses = guessForms(guess);
  if (!guesses.length) return false;
  const answers = titleVariants(title);
  if (!answers.length) return false;
  const shortest = Math.min(...answers.map((a) => a.length));
  const decoys = new Set(
    poolTitles.flatMap(titleVariants).filter((t) => !answers.includes(t))
  );
  return guesses.some((g) => {
    if (g.length < 3 && g.length < shortest) return false;
    if (answers.includes(g)) return true;
    if (decoys.has(g)) return false;
    return answers.some((a) => levenshtein(g, a) <= maxEdits(a.length));
  });
}
