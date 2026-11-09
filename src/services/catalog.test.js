import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./playlists.js', () => ({ listCustom: vi.fn(() => []) }));
vi.mock('../data/seedPlaylists.json', () => ({
  default: [
    { id: 'pop', code: 'A1', name: 'Pop Hits', color: 'pink', tracks: [{ id: 1, title: 'a', artist: 'b' }] },
    { id: 'rock', code: 'A2', name: 'Rock Classics', color: 'red', tracks: [] },
  ],
}));

import { getAllPlaylists, customCode } from './catalog.js';
import { listCustom } from './playlists.js';

beforeEach(() => listCustom.mockReset().mockReturnValue([]));

describe('getAllPlaylists', () => {
  it('returns the seeds in the common shape, marked not custom', () => {
    expect(getAllPlaylists()).toEqual([
      { id: 'pop', code: 'A1', name: 'Pop Hits', color: 'pink', tracks: [{ id: 1, title: 'a', artist: 'b' }], custom: false },
      { id: 'rock', code: 'A2', name: 'Rock Classics', color: 'red', tracks: [], custom: false },
    ]);
  });

  it('appends custom playlists after the seeds with D-row codes and a pink default', () => {
    listCustom.mockReturnValue([
      { id: 'c1', name: 'Road trip', tracks: [{ title: 'x', artist: 'y' }], updatedAt: 1 },
      { id: 'c2', name: 'Gym', color: 'cyan', tracks: [] },
    ]);
    const all = getAllPlaylists();
    expect(all.slice(2)).toEqual([
      { id: 'c1', code: 'D1', name: 'Road trip', color: 'pink', tracks: [{ title: 'x', artist: 'y' }], custom: true },
      { id: 'c2', code: 'D2', name: 'Gym', color: 'cyan', tracks: [], custom: true },
    ]);
  });

  it('falls back for unknown colours and blank names', () => {
    listCustom.mockReturnValue([{ id: 'c1', name: '  ', color: 'chartreuse', tracks: [] }]);
    const [c] = getAllPlaylists().slice(2);
    expect(c.color).toBe('pink');
    expect(c.name).toBe('Untitled playlist');
  });

  it('numbers past the fourth custom playlist onto the next row', () => {
    listCustom.mockReturnValue(Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, name: `P${i}`, tracks: [] })));
    expect(getAllPlaylists().slice(2).map((p) => p.code)).toEqual(['D1', 'D2', 'D3', 'D4', 'E1', 'E2']);
  });
});

describe('customCode', () => {
  it('runs D1…Z4 then keeps counting on row Z', () => {
    expect(customCode(0)).toBe('D1');
    expect(customCode(4)).toBe('E1');
    expect(customCode(91)).toBe('Z4');
    expect(customCode(92)).toBe('Z5');
  });
});
