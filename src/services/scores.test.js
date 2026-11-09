import { describe, it, expect, beforeEach } from 'vitest';
import { loadScores, saveScore } from './scores.js';
import { load, save } from './storage.js';

beforeEach(() => localStorage.clear());

describe('scores', () => {
  it('loads an empty table when nothing is stored', () => {
    expect(loadScores('challenge')).toEqual([]);
  });

  it('drops malformed rows and ranks what is left', () => {
    save('scores:endless', [{ initials: 'AAA', score: 10, date: 1 }, { nope: true }, { initials: 'BBB', score: 30, date: 2 }]);
    expect(loadScores('endless').map((e) => e.initials)).toEqual(['BBB', 'AAA']);
  });

  it('saves into the mode table only and returns the new ranking', () => {
    saveScore('challenge', { initials: 'AAA', score: 100, date: 1 });
    const table = saveScore('challenge', { initials: 'BBB', score: 200, date: 2 });
    expect(table.map((e) => e.initials)).toEqual(['BBB', 'AAA']);
    expect(load('scores:challenge')).toEqual(table);
    expect(loadScores('endless')).toEqual([]);
  });

  it('keeps only the top ten', () => {
    for (let i = 1; i <= 12; i++) saveScore('endless', { initials: 'ZZZ', score: i * 10, date: i });
    const t = loadScores('endless');
    expect(t).toHaveLength(10);
    expect(t[0].score).toBe(120);
    expect(t[9].score).toBe(30);
  });
});
