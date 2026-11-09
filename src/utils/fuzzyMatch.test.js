import { describe, it, expect } from 'vitest';
import { normalizeTitle, titleVariants, normalizeText } from './normalize.js';
import { levenshtein, maxEdits, isCorrectGuess, similarity } from './fuzzyMatch.js';

describe('normalizeTitle', () => {
  it.each([
    ['Bohemian Rhapsody - Remastered 2011', 'bohemian rhapsody'],
    ["Don't Stop Me Now", 'dont stop me now'],
    ['Despacito (feat. Daddy Yankee)', 'despacito'],
    ['Café del Mar', 'cafe del mar'],
    ['Rock & Roll', 'rock and roll'],
    ['The Final Countdown', 'final countdown'],
    ['Hey Jude - Live at Wembley', 'hey jude'],
    ['Song feat. Somebody', 'song'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  it('keeps non-Latin letters', () => {
    expect(normalizeTitle('紅蓮華')).toBe('紅蓮華');
  });
});

describe('titleVariants', () => {
  it('offers stripped and full forms for leading brackets', () => {
    expect(titleVariants("(I Can't Get No) Satisfaction")).toEqual([
      'satisfaction',
      'i cant get no satisfaction',
    ]);
  });
});

describe('levenshtein / maxEdits', () => {
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });
  it('scales tolerance by length', () => {
    expect(maxEdits(4)).toBe(0);
    expect(maxEdits(5)).toBe(1);
    expect(maxEdits(7)).toBe(1);
    expect(maxEdits(8)).toBe(2);
    expect(maxEdits(14)).toBe(2);
    expect(maxEdits(20)).toBe(3);
  });
});

describe('isCorrectGuess — should pass', () => {
  it.each([
    ['Bohemian Rhapsody', 'bohemian rapsody'],
    ["Don't Stop Me Now", 'dont stop me now'],
    ['Smells Like Teen Spirit', 'smells like teen spirt'],
    ['Hey Jude - Remastered 2015', 'hey jude'],
    ['The Final Countdown', 'final countdown'],
    ['The Final Countdown', 'The Final Countdown!'],
    ['Rock & Roll', 'rock and roll'],
    ['Rock & Roll', 'rock n roll'],
    ['Despacito (feat. Daddy Yankee)', 'despacito'],
    ['Café del Mar', 'cafe del mar'],
    ["(I Can't Get No) Satisfaction", 'satisfaction'],
    ["(I Can't Get No) Satisfaction", 'i cant get no satisfaction'],
    ['Yesterday', 'Yesterday - The Beatles'],
    ['Thriller', 'thriler'],
    ['Up', 'up'],
  ])('%s <- "%s"', (title, guess) => {
    expect(isCorrectGuess(guess, title)).toBe(true);
  });
});

describe('isCorrectGuess — should fail', () => {
  it.each([
    ['Hello', 'Halo'],
    ['Roar', 'Roam'],
    ['One', 'Ode'],
    ['Yesterday', 'Tomorrow'],
    ['Bohemian Rhapsody', 'bohemian'],
    ['Hey Jude', 'hey'],
    ['Abba Song', 'ab'],
    ['Yesterday', ''],
    ['Yesterday', '   '],
  ])('%s <- "%s"', (title, guess) => {
    expect(isCorrectGuess(guess, title)).toBe(false);
  });

  it('rejects a guess that exactly names another song in the pool', () => {
    expect(isCorrectGuess('Believer', 'Believe')).toBe(true); // no pool: within 1 edit
    expect(isCorrectGuess('Believer', 'Believe', ['Believe', 'Believer'])).toBe(false);
  });
});

describe('similarity / normalizeText', () => {
  it('is 1 for equal, lower for different', () => {
    expect(similarity('abc', 'abc')).toBe(1);
    expect(similarity('abc', 'xyz')).toBe(0);
  });
  it('normalizes artists', () => {
    expect(normalizeText('Beyoncé & JAY-Z')).toBe('beyonce and jay z');
  });
});
