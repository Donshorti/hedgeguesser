import { describe, expect, it } from 'vitest';
import { runStats } from './runStats.js';

describe('runStats', () => {
  it('handles an empty run', () => {
    expect(runStats([])).toEqual({ hits: 0, played: 0, avgStage: null, bestStreak: 0 });
  });

  it('counts hits, 1-based average stage and the longest streak', () => {
    const results = [
      { stage: 0, points: 1000 },
      { stage: 2, points: 400 },
      { stage: null, points: 0 },
      { stage: 1, points: 600 },
      { stage: 1, points: 600 },
      { stage: 0, points: 1000 },
    ];
    expect(runStats(results)).toEqual({ hits: 5, played: 6, avgStage: 1.8, bestStreak: 3 });
  });
});
