import { describe, expect, it } from 'vitest';
import { attachResolvedIds, buildRefill, dedupeTracks } from './gameLoading.js';

const t = (id, title = `Song ${id}`) => ({ id, title, artist: 'A' });

describe('dedupeTracks', () => {
  it('keeps the first of each id', () => {
    expect(dedupeTracks([t(1), t(2), t(1, 'dup')]).map((x) => x.title)).toEqual(['Song 1', 'Song 2']);
  });
});

describe('buildRefill', () => {
  const pool = Array.from({ length: 8 }, (_, i) => t(i + 1));
  it('leaves out the last five played songs', () => {
    const queue = pool.slice(0, 7);
    const ids = buildRefill(pool, queue, 6).map((x) => x.id).sort();
    expect(ids).toEqual([1, 2, 8]);
  });
  it('falls back to the whole pool when everything is recent', () => {
    const small = pool.slice(0, 3);
    expect(buildRefill(small, small, 2)).toHaveLength(3);
  });
});

describe('attachResolvedIds', () => {
  it('fills ids for id-less tracks by normalized title', () => {
    const raw = [{ title: 'The Hello', artist: 'X' }, { id: 5, title: 'Kept', artist: 'Y' }, { title: 'Nope', artist: 'Z' }];
    const out = attachResolvedIds(raw, [{ id: 9, title: 'Hello' }, { id: 5, title: 'Kept' }]);
    expect(out).toEqual([{ title: 'The Hello', artist: 'X', id: 9 }, raw[1], raw[2]]);
  });
  it('returns null when nothing changed', () => {
    expect(attachResolvedIds([{ id: 1, title: 'A', artist: 'B' }], [{ id: 1, title: 'A' }])).toBeNull();
  });
});
