import { describe, expect, it } from 'vitest';
import { addTrack, copyName, hasTrack, removeTrackAt, searchErrorMessage, unmatchedCount } from './playlistEdit.js';
import { HttpError } from '../services/itunes.js';
import { abortError, codedError } from '../utils/errors.js';

describe('copyName', () => {
  it('appends (copy), then numbers further copies', () => {
    expect(copyName('80s Hits')).toBe('80s Hits (copy)');
    expect(copyName('80s Hits', ['80s hits (copy)'])).toBe('80s Hits (copy 2)');
    expect(copyName('80s Hits', ['80s Hits (copy)', '80s Hits (copy 2)'])).toBe('80s Hits (copy 3)');
  });
});

describe('track list edits', () => {
  const a = { id: 1, title: 'A', artist: 'X', previewUrl: 'p', artwork: 'w' };
  it('adds only the stored fields and dedupes by id', () => {
    const one = addTrack([], a);
    expect(one).toEqual([{ id: 1, title: 'A', artist: 'X' }]);
    expect(addTrack(one, a)).toBe(one);
    expect(hasTrack(one, 1)).toBe(true);
    expect(hasTrack(one, 2)).toBe(false);
  });
  it('removes by index and counts id-less tracks', () => {
    const list = [{ id: 1 }, { title: 'B', artist: 'Y' }, { title: 'C', artist: 'Z' }];
    expect(removeTrackAt(list, 0)).toHaveLength(2);
    expect(unmatchedCount(list)).toBe(2);
  });
});

describe('searchErrorMessage', () => {
  it('maps busy, offline and abort', () => {
    expect(searchErrorMessage(new HttpError(403))).toMatch(/busy/);
    expect(searchErrorMessage(codedError('unreachable'))).toBe("Can't reach iTunes");
    expect(searchErrorMessage(codedError('timeout'))).toBe("Can't reach iTunes");
    expect(searchErrorMessage(abortError())).toBeNull();
  });
});
