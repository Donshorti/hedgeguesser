import { describe, it, expect, vi } from 'vitest';
import {
  searchUrl, lookupUrl, toTrack, getJson, HttpError, pickBestMatch, lookupTracks,
} from './itunes.js';

const raw = (o = {}) => ({
  wrapperType: 'track', kind: 'song', trackId: 1, trackName: 'Yesterday',
  artistName: 'The Beatles', collectionName: 'Help!',
  artworkUrl100: 'https://x/100x100bb.jpg', previewUrl: 'https://p/1.m4a',
  releaseDate: '1965-08-06T07:00:00Z', primaryGenreName: 'Rock', ...o,
});

describe('urls', () => {
  it('builds search and lookup urls', () => {
    expect(searchUrl('hey jude', { country: 'ES', limit: 5 })).toBe(
      'https://itunes.apple.com/search?term=hey+jude&media=music&entity=song&limit=5&country=ES'
    );
    expect(lookupUrl([1, 2], { country: 'US' })).toBe(
      'https://itunes.apple.com/lookup?id=1%2C2&country=US'
    );
  });
});

describe('toTrack', () => {
  it('maps a song result', () => {
    expect(toTrack(raw())).toEqual({
      id: 1, title: 'Yesterday', artist: 'The Beatles', album: 'Help!',
      artwork: 'https://x/600x600bb.jpg', previewUrl: 'https://p/1.m4a', year: 1965, genre: 'Rock',
    });
  });
  it('drops results without a preview or non-songs', () => {
    expect(toTrack(raw({ previewUrl: undefined }))).toBeNull();
    expect(toTrack(raw({ kind: 'music-video' }))).toBeNull();
  });
});

describe('getJson', () => {
  it('uses fetch when it works', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ a: 1 }) }));
    const jsonpImpl = vi.fn();
    await expect(getJson('u', { fetchImpl, jsonpImpl })).resolves.toEqual({ a: 1 });
    expect(jsonpImpl).not.toHaveBeenCalled();
  });
  it('falls back to JSONP on network/CORS failure', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const jsonpImpl = vi.fn(async () => ({ b: 2 }));
    await expect(getJson('u', { fetchImpl, jsonpImpl })).resolves.toEqual({ b: 2 });
  });
  it('surfaces HTTP errors (e.g. 403 rate limit) without fallback', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 403 }));
    const jsonpImpl = vi.fn();
    await expect(getJson('u', { fetchImpl, jsonpImpl })).rejects.toBeInstanceOf(HttpError);
    expect(jsonpImpl).not.toHaveBeenCalled();
  });
});

describe('pickBestMatch', () => {
  const tracks = [
    toTrack(raw({ trackId: 1, trackName: 'Yesterday (Remastered 2009)', artistName: 'The Beatles' })),
    toTrack(raw({ trackId: 2, trackName: 'Yesterday', artistName: 'Some Cover Band' })),
  ];
  it('prefers title+artist agreement', () => {
    expect(pickBestMatch(tracks, { title: 'Yesterday', artist: 'The Beatles' }).id).toBe(1);
  });
  it('returns null when nothing is close', () => {
    expect(pickBestMatch(tracks, { title: 'Bohemian Rhapsody', artist: 'Queen' })).toBeNull();
  });
});

describe('lookupTracks', () => {
  it('chunks ids and returns a Map by id', async () => {
    const getJsonImpl = vi.fn(async (url) => {
      const ids = new URL(url).searchParams.get('id').split(',').map(Number);
      return { results: ids.map((id) => raw({ trackId: id })) };
    });
    const ids = Array.from({ length: 160 }, (_, i) => i + 1);
    const map = await lookupTracks(ids, { country: 'US', chunk: 150, getJsonImpl });
    expect(getJsonImpl).toHaveBeenCalledTimes(2);
    expect(map.size).toBe(160);
    expect(map.get(42).id).toBe(42);
  });
});
