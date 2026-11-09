import { describe, expect, it } from 'vitest';
import { ladderWidths, playheadAt } from './StageLadder.jsx';

const sum = (a) => a.reduce((x, y) => x + y, 0);
const nonDecreasing = (a) => a.every((w, i) => i === 0 || w >= a[i - 1] - 1e-9);

describe('ladderWidths', () => {
  it('never draws a longer stage narrower than the one before (default stages)', () => {
    const w = ladderWidths([0.5, 5, 15, 30]);
    expect(nonDecreasing(w)).toBe(true);
    expect(sum(w)).toBeCloseTo(1, 6);
    expect(w[0]).toBeGreaterThan(0.15);
  });

  it('stays proportional when no floor is needed', () => {
    const w = ladderWidths([20, 40, 60, 100]);
    expect(w.map((x) => +x.toFixed(4))).toEqual([0.2, 0.2, 0.2, 0.4]);
  });

  it('keeps monotone order for odd custom stages', () => {
    for (const stages of [[1, 2, 3, 30], [0.5, 1, 1.5, 2], [2, 30, 31, 60]]) {
      const w = ladderWidths(stages);
      expect(nonDecreasing(w)).toBe(true);
      expect(sum(w)).toBeCloseTo(1, 6);
    }
  });

  it('puts the playhead at each stage boundary', () => {
    const stages = [0.5, 5, 15, 30];
    const w = ladderWidths(stages);
    expect(playheadAt(5, stages, w)).toBeCloseTo(w[0] + w[1], 6);
    expect(playheadAt(30, stages, w)).toBeCloseTo(1, 6);
  });
});
