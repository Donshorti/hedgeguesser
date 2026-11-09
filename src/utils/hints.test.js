import { describe, it, expect } from 'vitest';
import { artistInitials, titleMask, hintText } from './hints.js';

describe('hints', () => {
  it('artist initials', () => {
    expect(artistInitials('The Beatles')).toBe('T. B.');
    expect(artistInitials('Beyoncé')).toBe('B.');
    expect(artistInitials('AC/DC')).toBe('A. D.');
  });
  it('title mask reveals first letter and word shape', () => {
    expect(titleMask('Hey Jude')).toBe('H__ ____');
    // letters/digits become "_" except the first; punctuation and spaces are kept
    expect(titleMask("Don't Stop")).toBe("D__'_ ____");
    expect(titleMask('Despacito (feat. Daddy Yankee)')).toBe('D________');
  });
  it('hintText maps each hint type', () => {
    const t = { title: 'Hey Jude', artist: 'The Beatles', year: 1968, genre: 'Rock' };
    expect(hintText('year', t)).toBe('1968');
    expect(hintText('genre', t)).toBe('Rock');
    expect(hintText('artistInitials', t)).toBe('T. B.');
    expect(hintText('firstLetter', t)).toBe('H__ ____');
    expect(hintText('year', { ...t, year: null })).toBe('Unknown');
  });
});
