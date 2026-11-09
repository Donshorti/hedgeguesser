import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings, validStages } from './gameConfig.js';

describe('validStages', () => {
  it('accepts 4 ascending positive durations up to 30s', () => {
    expect(validStages([0.5, 5, 15, 30])).toBe(true);
    expect(validStages([1, 2, 3, 4])).toBe(true);
  });
  it.each([
    [[5, 0.5, 15, 30]],
    [[0.5, 5, 15]],
    [[0, 5, 15, 30]],
    [[0.5, 5, 15, 31]],
    [[0.5, 5, 'x', 30]],
    [null],
  ])('rejects %j', (s) => expect(validStages(s)).toBe(false));
});

describe('mergeSettings', () => {
  it('returns defaults for garbage', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings('nope')).toEqual(DEFAULT_SETTINGS);
  });
  it('keeps valid overrides and repairs invalid ones', () => {
    const s = mergeSettings({
      stages: [1, 2, 3, 4],
      stagePoints: [9, 8],
      endlessLives: 99,
      volume: 2,
      hintCosts: { year: 50 },
    });
    expect(s.stages).toEqual([1, 2, 3, 4]);
    expect(s.stagePoints).toEqual(DEFAULT_SETTINGS.stagePoints);
    expect(s.endlessLives).toBe(9);
    expect(s.volume).toBe(1);
    expect(s.hintCosts).toEqual({ ...DEFAULT_SETTINGS.hintCosts, year: 50 });
  });
  it('does not mutate defaults', () => {
    const s = mergeSettings({});
    s.stages.push(99);
    expect(DEFAULT_SETTINGS.stages).toHaveLength(4);
  });
});
