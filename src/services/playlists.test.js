import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseImport, ImportError, listCustom, saveCustom, deleteCustom, loadPlaylistTracks,
} from './playlists.js';

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
