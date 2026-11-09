import { describe, expect, it } from 'vitest';
import { shuffle } from './shuffle.js';

describe('shuffle', () => {
  it('returns a permutation of the input', () => {
    const input = Array.from({ length: 50 }, (_, i) => i);
    const out = shuffle(input);
    expect(out).toHaveLength(50);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it('does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    const out = shuffle(input, () => 0);
    expect(input).toEqual(copy);
    expect(out).not.toBe(input);
  });

  it('uses the random source (deterministic with a fixed one)', () => {
    expect(shuffle([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
    expect(shuffle([], () => 0)).toEqual([]);
  });
});
