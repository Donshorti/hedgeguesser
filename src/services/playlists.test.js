import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseImport, ImportError, listCustom, saveCustom, deleteCustom, loadPlaylistTracks,
} from './playlists.js';
import { load, save, PREFIX } from './storage.js';

beforeEach(() => localStorage.clear());

describe('parseImport', () => {
  it('parses the JSON object form', () => {
    const r = parseImport('{"name":"Mine","tracks":[{"title":"Yesterday","artist":"The Beatles"}]}');
    expect(r).toEqual({ name: 'Mine', tracks: [{ title: 'Yesterday', artist: 'The Beatles' }] });
  });
  it('parses a bare JSON array and keeps numeric ids', () => {
    const r = parseImport('[{"title":"A","artist":"B","id":5}]');
    expect(r.tracks).toEqual([{ title: 'A', artist: 'B', id: 5 }]);
  });
  it('parses "Title - Artist" lines, skipping blanks and # comments', () => {
    const r = parseImport('# my list\nYesterday - The Beatles\n\nHey Jude – The Beatles');
    expect(r.tracks).toEqual([
      { title: 'Yesterday', artist: 'The Beatles' },
      { title: 'Hey Jude', artist: 'The Beatles' },
    ]);
  });
  it('reports the line number of a bad text line', () => {
    expect(() => parseImport('Yesterday - The Beatles\nno separator here')).toThrow(/line 2/i);
  });
  it('reports the index of a bad JSON track', () => {
    expect(() => parseImport('{"tracks":[{"title":"A","artist":"B"},{"title":""}]}')).toThrow(/track 2/);
  });
  it('rejects empty input and malformed JSON', () => {
    expect(() => parseImport('   ')).toThrow(ImportError);
    expect(() => parseImport('{"tracks": [')).toThrow(/JSON/);
  });
});

describe('custom playlist CRUD', () => {
  it('saves, lists and deletes', () => {
    const p = saveCustom({ name: 'X', tracks: [] });
    expect(p.id).toMatch(/^c_/);
    expect(listCustom()).toHaveLength(1);
    saveCustom({ ...p, name: 'Y' });
    expect(listCustom()[0].name).toBe('Y');
    deleteCustom(p.id);
    expect(listCustom()).toEqual([]);
  });
});

describe('loadPlaylistTracks', () => {
  it('looks up ids in one batch and resolves id-less tracks by title', async () => {
    const lookup = vi.fn(async (ids) => new Map(ids.map((id) => [id, { id, title: `T${id}`, artist: 'A', previewUrl: 'p' }])));
    const resolve = vi.fn(async () => ({ id: 99, title: 'New', artist: 'A', previewUrl: 'p' }));
    const onProgress = vi.fn();
    const { tracks, resolvedIds } = await loadPlaylistTracks(
      { tracks: [{ id: 1, title: 'T1', artist: 'A' }, { title: 'New', artist: 'A' }] },
      { country: 'US', lookup, resolve, onProgress }
    );
    expect(lookup).toHaveBeenCalledWith([1], expect.anything());
    expect(tracks.map((t) => t.id)).toEqual([1, 99]);
    expect(resolvedIds).toEqual([1, 99]);
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
  });
});

describe('saveCustom failure and ids', () => {
  it('returns null when storage refuses the write', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    try {
      expect(saveCustom({ name: 'X', tracks: [] })).toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
  it('gives distinct ids to playlists saved in the same millisecond', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    try {
      const a = saveCustom({ name: 'A', tracks: [] });
      const b = saveCustom({ name: 'B', tracks: [] });
      expect(a.id).not.toBe(b.id);
      expect(a.id).toMatch(/^c_[a-z0-9]+$/);
      expect(listCustom()).toHaveLength(2);
    } finally {
      now.mockRestore();
    }
  });
});

const playable = (id, title = `T${id}`) => ({ id, title, artist: 'A', previewUrl: 'p' });
const mapOf = (tracks, errors = []) => Object.assign(new Map(tracks.map((t) => [t.id, t])), { errors });
const DAY = 24 * 60 * 60 * 1000;

describe('loadPlaylistTracks track cache', () => {
  const key = 'trackCache:US';

  it('uses fresh entries, refetches expired ones, and stamps only fetched entries', async () => {
    save(key, { entries: [[1, { t: playable(1), at: 1000 }], [2, { t: playable(2), at: 1000 - DAY }]] });
    const lookup = vi.fn(async (ids) => mapOf(ids.map((id) => playable(id))));
    const { tracks } = await loadPlaylistTracks(
      { tracks: [{ id: 1, title: 'T1', artist: 'A' }, { id: 2, title: 'T2', artist: 'A' }] },
      { useCache: true, lookup, resolve: vi.fn(), now: () => 5000 }
    );
    expect(lookup).toHaveBeenCalledWith([2], expect.anything());
    expect(tracks.map((t) => t.id)).toEqual([1, 2]);
    expect(load(key, null).entries).toEqual([
      [1, { t: playable(1), at: 1000 }],
      [2, { t: playable(2), at: 5000 }],
    ]);
  });
  it('moves refreshed entries to the end so the size cap evicts the oldest', async () => {
    save(key, { entries: [[1, { t: playable(1), at: 0 }], [2, { t: playable(2), at: 100 }]] });
    const lookup = vi.fn(async (ids) => mapOf(ids.map((id) => playable(id))));
    await loadPlaylistTracks(
      { tracks: [{ id: 1, title: 'T1', artist: 'A' }] },
      { useCache: true, lookup, resolve: vi.fn(), now: () => DAY + 50 } // entry 1 expired, 2 fresh
    );
    expect(load(key, null).entries.map(([id]) => id)).toEqual([2, 1]);
  });
  it.each([
    ['corrupt JSON', null],
    ['entries not an array', { entries: 'nope' }],
    ['malformed entries', { entries: [[1], 'x', [2, { at: 'soon' }], [3, null]] }],
  ])('ignores a tampered cache (%s)', async (_, value) => {
    if (value === null) localStorage.setItem(`${PREFIX}${key}`, '{oops');
    else save(key, value);
    const lookup = vi.fn(async (ids) => mapOf(ids.map((id) => playable(id))));
    const { tracks } = await loadPlaylistTracks(
      { tracks: [{ id: 1, title: 'T1', artist: 'A' }] },
      { useCache: true, lookup, resolve: vi.fn(), now: () => 5000 }
    );
    expect(lookup).toHaveBeenCalledWith([1], expect.anything());
    expect(tracks.map((t) => t.id)).toEqual([1]);
  });
});

describe('loadPlaylistTracks failures', () => {
  it('returns error: null when everything loads', async () => {
    const { error } = await loadPlaylistTracks(
      { tracks: [{ id: 1, title: 'T1', artist: 'A' }] },
      { lookup: async (ids) => mapOf(ids.map((id) => playable(id))), resolve: vi.fn() }
    );
    expect(error).toBeNull();
  });
  it('continues with cached tracks when the lookup throws', async () => {
    save('trackCache:US', { entries: [[1, { t: playable(1), at: 1000 }]] });
    const boom = new Error('offline');
    const { tracks, error } = await loadPlaylistTracks(
      { tracks: [{ id: 1, title: 'T1', artist: 'A' }, { id: 2 }] },
      { useCache: true, lookup: async () => { throw boom; }, resolve: vi.fn(), now: () => 2000 }
    );
    expect(tracks.map((t) => t.id)).toEqual([1]);
    expect(error).toBe(boom);
  });
  it('reports partial lookup failures from map.errors', async () => {
    const boom = new Error('chunk failed');
    const { tracks, error } = await loadPlaylistTracks(
      { tracks: [{ id: 1, title: 'T1', artist: 'A' }] },
      { lookup: async () => mapOf([playable(1)], [boom]), resolve: vi.fn() }
    );
    expect(tracks).toHaveLength(1);
    expect(error).toBe(boom);
  });
  it('falls back to title search for an id missing from the lookup', async () => {
    const resolve = vi.fn(async () => playable(7, 'Moved'));
    const { tracks } = await loadPlaylistTracks(
      { tracks: [{ id: 5, title: 'Moved', artist: 'A' }] },
      { lookup: async () => mapOf([]), resolve }
    );
    expect(resolve).toHaveBeenCalledWith({ id: 5, title: 'Moved', artist: 'A' }, expect.anything());
    expect(tracks.map((t) => t.id)).toEqual([7]);
  });
  it('gives up after 3 consecutive resolve errors with code "unreachable"', async () => {
    const resolve = vi.fn(async () => { throw new Error('network'); });
    const onProgress = vi.fn();
    const list = Array.from({ length: 5 }, (_, i) => ({ title: `S${i}`, artist: 'A' }));
    const { tracks, error } = await loadPlaylistTracks({ tracks: list }, { resolve, onProgress });
    expect(resolve).toHaveBeenCalledTimes(3);
    expect(tracks).toEqual([]);
    expect(error).toMatchObject({ code: 'unreachable' });
    expect(onProgress).toHaveBeenLastCalledWith(5, 5);
  });
  it('a successful or empty resolve resets the failure streak', async () => {
    let n = 0;
    const resolve = vi.fn(async (t) => {
      n++;
      if (n === 3) return null; // no match is not a failure
      if (n === 6) return playable(60, t.title);
      throw new Error('network');
    });
    const list = Array.from({ length: 7 }, (_, i) => ({ title: `S${i}`, artist: 'A' }));
    const { error } = await loadPlaylistTracks({ tracks: list }, { resolve });
    expect(resolve).toHaveBeenCalledTimes(7);
    expect(error).toBeNull();
  });
  it('drops tracks whose title normalizes to nothing', async () => {
    const { tracks } = await loadPlaylistTracks(
      { tracks: [{ id: 1, title: 'x', artist: 'A' }, { id: 2, title: '!!!', artist: 'A' }] },
      { lookup: async () => mapOf([playable(1, 'Fine'), playable(2, '!!!')]), resolve: vi.fn() }
    );
    expect(tracks.map((t) => t.id)).toEqual([1]);
  });
});

describe('loadPlaylistTracks cancellation', () => {
  it('rejects with AbortError before resolving when already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const resolve = vi.fn();
    await expect(
      loadPlaylistTracks({ tracks: [{ title: 'S', artist: 'A' }] }, { resolve, signal: ctrl.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(resolve).not.toHaveBeenCalled();
  });
  it('stops resolving once aborted mid-way', async () => {
    const ctrl = new AbortController();
    const resolve = vi.fn(async (t) => {
      ctrl.abort();
      return playable(1, t.title);
    });
    const list = [{ title: 'S1', artist: 'A' }, { title: 'S2', artist: 'A' }];
    await expect(loadPlaylistTracks({ tracks: list }, { resolve, signal: ctrl.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(resolve).toHaveBeenCalledTimes(1);
  });
  it('passes the signal to lookup and resolve', async () => {
    const ctrl = new AbortController();
    const lookup = vi.fn(async () => mapOf([]));
    const resolve = vi.fn(async () => null);
    await loadPlaylistTracks({ tracks: [{ id: 1, title: 'S', artist: 'A' }] }, { lookup, resolve, signal: ctrl.signal });
    expect(lookup).toHaveBeenCalledWith([1], expect.objectContaining({ signal: ctrl.signal }));
    expect(resolve).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ signal: ctrl.signal }));
  });
});

describe('loadPlaylistTracks id fallback limits', () => {
  const withFailed = (tracks, failedIds) =>
    Object.assign(mapOf(tracks, [new Error('chunk failed')]), { failedIds: new Set(failedIds) });

  it('does not title-search ids whose lookup chunk failed', async () => {
    const resolve = vi.fn(async () => playable(70));
    const { tracks, error } = await loadPlaylistTracks(
      { tracks: [{ id: 1, title: 'T1', artist: 'A' }, { id: 2, title: 'T2', artist: 'A' }] },
      { lookup: async () => withFailed([playable(1)], [2]), resolve }
    );
    expect(resolve).not.toHaveBeenCalled();
    expect(tracks.map((t) => t.id)).toEqual([1]);
    expect(error).toMatchObject({ message: 'chunk failed' });
  });
  it('does not title-search any id when the whole lookup throws, but still resolves id-less tracks', async () => {
    const resolve = vi.fn(async (t) => playable(80, t.title));
    const { tracks } = await loadPlaylistTracks(
      { tracks: [{ id: 1, title: 'T1', artist: 'A' }, { title: 'Loose', artist: 'A' }] },
      { lookup: async () => { throw new Error('offline'); }, resolve }
    );
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledWith({ title: 'Loose', artist: 'A' }, expect.anything());
    expect(tracks.map((t) => t.id)).toEqual([80]);
  });
  it('searchMissing: false skips the id fallback but still resolves id-less tracks', async () => {
    const resolve = vi.fn(async (t) => playable(81, t.title));
    const { tracks } = await loadPlaylistTracks(
      { tracks: [{ id: 5, title: 'Gone', artist: 'A' }, { title: 'Loose', artist: 'A' }] },
      { lookup: async () => mapOf([]), resolve, searchMissing: false }
    );
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(tracks.map((t) => t.id)).toEqual([81]);
  });
  it('caches a title-resolved track under the original id so the search runs once per TTL', async () => {
    const resolve = vi.fn(async () => playable(7, 'Moved'));
    const lookup = vi.fn(async () => mapOf([]));
    const playlist = { tracks: [{ id: 5, title: 'Moved', artist: 'A' }] };
    const opts = { useCache: true, lookup, resolve, now: () => 1000 };
    await loadPlaylistTracks(playlist, opts);
    expect(load('trackCache:US', null).entries).toEqual([[5, { t: playable(7, 'Moved'), at: 1000 }]]);
    const again = await loadPlaylistTracks(playlist, opts);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(again.tracks.map((t) => t.id)).toEqual([7]);
  });
});
