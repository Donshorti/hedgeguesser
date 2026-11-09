import { describe, it, expect } from 'vitest';
import { qualifies, insertScore, sanitizeInitials, MAX_SCORES } from './highScores.js';

const list = (n) => Array.from({ length: n }, (_, i) => ({ initials: 'AAA', score: (n - i) * 100, date: i }));

describe('highScores', () => {
  it('qualifies any positive score when the table has room', () => {
    expect(qualifies([], 1)).toBe(true);
    expect(qualifies([], 0)).toBe(false);
  });
  it('requires beating the lowest score when full', () => {
    const full = list(MAX_SCORES); // lowest is 100
    expect(qualifies(full, 100)).toBe(false);
    expect(qualifies(full, 101)).toBe(true);
  });
  it('inserts sorted and trims to MAX_SCORES', () => {
    const out = insertScore(list(MAX_SCORES), { initials: 'NEW', score: 550, date: 99 });
    expect(out).toHaveLength(MAX_SCORES);
    expect(out.map((e) => e.score)).toEqual([...out.map((e) => e.score)].sort((a, b) => b - a));
    expect(out.some((e) => e.initials === 'NEW')).toBe(true);
  });
  it('sanitizes initials to 3 uppercase alphanumerics', () => {
    expect(sanitizeInitials('ab!c9')).toBe('ABC');
    expect(sanitizeInitials('z')).toBe('Z');
    expect(sanitizeInitials(null)).toBe('');
  });
});
