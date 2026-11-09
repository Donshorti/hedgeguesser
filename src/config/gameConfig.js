export const HINTS = ['year', 'genre', 'artistInitials', 'firstLetter'];

export const DEFAULT_SETTINGS = Object.freeze({
  stages: Object.freeze([0.5, 5, 15, 30]),
  stagePoints: Object.freeze([1000, 500, 250, 100]),
  challengeLength: 20,
  endlessLives: 3,
  hintCosts: Object.freeze({ year: 100, genre: 100, artistInitials: 200, firstLetter: 300 }),
  minPlayableSongs: 8,
  country: 'US',
  volume: 0.8,
});

export function validStages(stages) {
  return (
    Array.isArray(stages) &&
    stages.length === 4 &&
    stages.every(
      (n, i) =>
        typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 30 && (i === 0 || n > stages[i - 1])
    )
  );
}

const clamp = (n, lo, hi, fallback) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;

export function mergeSettings(saved) {
  const src = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const d = DEFAULT_SETTINGS;
  const stages = validStages(src.stages) ? [...src.stages] : [...d.stages];
  const points =
    Array.isArray(src.stagePoints) &&
    src.stagePoints.length === stages.length &&
    src.stagePoints.every((n) => Number.isFinite(n) && n >= 0)
      ? [...src.stagePoints]
      : [...d.stagePoints];
  const hintCosts = { ...d.hintCosts };
  for (const k of HINTS) {
    const v = src.hintCosts?.[k];
    if (Number.isFinite(v) && v >= 0) hintCosts[k] = v;
  }
  return {
    stages,
    stagePoints: points,
    challengeLength: Math.round(clamp(src.challengeLength, 1, 50, d.challengeLength)),
    endlessLives: Math.round(clamp(src.endlessLives, 1, 9, d.endlessLives)),
    hintCosts,
    minPlayableSongs: d.minPlayableSongs,
    country: typeof src.country === 'string' && /^[A-Z]{2}$/.test(src.country) ? src.country : d.country,
    volume: clamp(src.volume, 0, 1, d.volume),
  };
}
