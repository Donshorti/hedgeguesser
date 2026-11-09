import { describe, expect, it } from 'vitest';
import { suggest, suggestionIndex } from './suggest.js';

const index = suggestionIndex(['Hello', 'Hello (Remastered)', 'Hey Jude', 'Shake It Off', 'Hellbound', 'The Hey Song', 'Yellow', 'Help!']);

describe('suggest', () => {
  it('waits for two characters', () => {
    expect(suggest(index, 'h')).toEqual([]);
  });
  it('dedupes by normalized title and ranks prefix before contains', () => {
    const out = suggest(index, 'hel');
    expect(out.filter((t) => t.startsWith('Hello'))).toHaveLength(1);
    expect(out.slice(0, 3).every((t) => t.toLowerCase().startsWith('hel'))).toBe(true);
  });
  it('matches inside titles and tolerates a typo at the start', () => {
    expect(suggest(index, 'it off')).toEqual(['Shake It Off']);
    expect(suggest(index, 'yelow')).toContain('Yellow');
  });
  it('caps at six', () => {
    const big = suggestionIndex(Array.from({ length: 20 }, (_, i) => `Song ${i}`));
    expect(suggest(big, 'song')).toHaveLength(6);
  });
});
