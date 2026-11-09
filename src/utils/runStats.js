/**
 * Summary of a finished run from `state.results` ([{ trackId, stage, points }],
 * stage null = missed). `avgStage` is 1-based (1 = got it on the first slice),
 * null when nothing was guessed.
 */
export function runStats(results = []) {
  let hits = 0;
  let stageSum = 0;
  let streak = 0;
  let bestStreak = 0;
  for (const r of results) {
    if (r && r.stage != null) {
      hits += 1;
      stageSum += r.stage + 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      streak = 0;
    }
  }
  return {
    hits,
    played: results.length,
    avgStage: hits ? Math.round((stageSum / hits) * 10) / 10 : null,
    bestStreak,
  };
}
