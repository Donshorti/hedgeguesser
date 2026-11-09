import { describe, it, expect } from 'vitest';
import { gameReducer, initialGameState } from './gameReducer.js';
import { mergeSettings } from '../config/gameConfig.js';

const settings = mergeSettings({ challengeLength: 2 });
const tracks = [
  { id: 1, title: 'Yesterday', artist: 'The Beatles' },
  { id: 2, title: 'Hey Jude', artist: 'The Beatles' },
  { id: 3, title: 'Let It Be', artist: 'The Beatles' },
];
const start = (mode = 'challenge', s = settings) =>
  gameReducer(initialGameState, { type: 'START', mode, tracks, settings: s });
const run = (state, ...actions) => actions.reduce(gameReducer, state);

describe('START', () => {
  it('challenge caps queue at challengeLength and keeps reserve', () => {
    const s = start();
    expect(s.status).toBe('playing');
    expect(s.queue.map((t) => t.id)).toEqual([1, 2]);
    expect(s.reserve.map((t) => t.id)).toEqual([3]);
    expect(s.lives).toBe(0);
  });
  it('endless uses all tracks and sets lives', () => {
    const s = start('endless');
    expect(s.queue).toHaveLength(3);
    expect(s.lives).toBe(3);
  });
});

describe('GUESS / SKIP', () => {
  it('correct guess at stage 0 scores full points and reveals', () => {
    const s = run(start(), { type: 'GUESS', text: 'yesterday' });
    expect(s.status).toBe('reveal');
    expect(s.outcome).toBe('win');
    expect(s.score).toBe(1000);
    expect(s.results).toEqual([{ trackId: 1, stage: 0, points: 1000 }]);
  });
  it('wrong guess advances the stage and is logged', () => {
    const s = run(start(), { type: 'GUESS', text: 'help' });
    expect(s.stage).toBe(1);
    expect(s.attempts).toEqual([{ type: 'guess', text: 'help', correct: false }]);
  });
  it('blank guess is ignored', () => {
    const s0 = start();
    expect(run(s0, { type: 'GUESS', text: '  ' })).toBe(s0);
  });
  it('correct at stage 2 scores stage-2 points', () => {
    const s = run(start(), { type: 'SKIP' }, { type: 'SKIP' }, { type: 'GUESS', text: 'Yesterday' });
    expect(s.score).toBe(250);
  });
  it('failing all four stages reveals a loss; endless loses a life', () => {
    const skips = Array(4).fill({ type: 'SKIP' });
    const c = run(start(), ...skips);
    expect(c.status).toBe('reveal');
    expect(c.outcome).toBe('lose');
    expect(c.results[0]).toEqual({ trackId: 1, stage: null, points: 0 });
    const e = run(start('endless'), ...skips);
    expect(e.lives).toBe(2);
  });
  it('ignores input while revealing', () => {
    const s = run(start(), { type: 'GUESS', text: 'yesterday' });
    expect(run(s, { type: 'SKIP' })).toBe(s);
  });
});

describe('BUY_HINT', () => {
  it('no-op when unaffordable', () => {
    const s = start();
    expect(run(s, { type: 'BUY_HINT', hint: 'year' })).toBe(s);
  });
  it('deducts cost once', () => {
    const won = run(start(), { type: 'GUESS', text: 'yesterday' }, { type: 'NEXT' });
    const h = run(won, { type: 'BUY_HINT', hint: 'year' }, { type: 'BUY_HINT', hint: 'year' });
    expect(h.score).toBe(900);
    expect(h.hintsUsed).toEqual(['year']);
  });
});

describe('NEXT', () => {
  it('advances and resets per-song state', () => {
    const s = run(start(), { type: 'SKIP' }, { type: 'GUESS', text: 'yesterday' }, { type: 'NEXT' });
    expect(s).toMatchObject({ index: 1, stage: 0, attempts: [], hintsUsed: [], status: 'playing', outcome: null });
  });
  it('challenge ends after the last song', () => {
    const s = run(
      start(),
      { type: 'GUESS', text: 'yesterday' }, { type: 'NEXT' },
      { type: 'GUESS', text: 'hey jude' }, { type: 'NEXT' }
    );
    expect(s.status).toBe('over');
  });
  it('endless ends at zero lives', () => {
    const one = mergeSettings({ endlessLives: 1 });
    const s = run(start('endless', one), ...Array(4).fill({ type: 'SKIP' }), { type: 'NEXT' });
    expect(s.status).toBe('over');
  });
  it('endless appends refill at the end of the queue', () => {
    let s = start('endless');
    s = { ...s, index: 2, status: 'reveal' };
    const n = run(s, { type: 'NEXT', refill: [{ id: 9, title: 'Help!', artist: 'The Beatles' }] });
    expect(n.index).toBe(3);
    expect(n.queue[3].id).toBe(9);
  });
});

describe('REPLACE_CURRENT', () => {
  it('swaps in a reserve track', () => {
    const s = run(start(), { type: 'REPLACE_CURRENT' });
    expect(s.queue[0].id).toBe(3);
    expect(s.reserve).toEqual([]);
  });
  it('drops the track when no reserve; ends if queue exhausted', () => {
    let s = run(start(), { type: 'REPLACE_CURRENT' }, { type: 'REPLACE_CURRENT' });
    expect(s.queue.map((t) => t.id)).toEqual([2]);
    s = run(s, { type: 'REPLACE_CURRENT' });
    expect(s.status).toBe('over');
  });
});
