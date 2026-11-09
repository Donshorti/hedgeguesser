import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  searchUrl, lookupUrl, toTrack, getJson, HttpError, pickBestMatch, lookupTracks, jsonp,
  searchTracks, resolveByTitle,
} from './itunes.js';

afterEach(() => {
  vi.useRealTimers();
  document.head.innerHTML = '';
});

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

describe('getJson timeout and cancellation', () => {
  const never = () => vi.fn(() => new Promise(() => {}));

  it('passes an abort signal to fetch', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    await getJson('u', { fetchImpl });
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it('rejects with code "timeout" after 8s by default, without JSONP fallback', async () => {
    vi.useFakeTimers();
    const fetchImpl = never();
    const jsonpImpl = vi.fn();
    const p = getJson('u', { fetchImpl, jsonpImpl });
    const assertion = expect(p).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(7999);
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true);
    expect(jsonpImpl).not.toHaveBeenCalled();
  });
  it('honours a custom timeoutMs', async () => {
    vi.useFakeTimers();
    const p = getJson('u', { fetchImpl: never(), jsonpImpl: vi.fn(), timeoutMs: 100 });
    const assertion = expect(p).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
  it('rejects with AbortError when the caller aborts, without JSONP fallback', async () => {
    const ctrl = new AbortController();
    const jsonpImpl = vi.fn();
    const p = getJson('u', { fetchImpl: never(), jsonpImpl, signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(jsonpImpl).not.toHaveBeenCalled();
  });
});

describe('jsonp', () => {
  const appended = () => document.head.querySelector('script');
  const callbackName = (script) => new URL(script.src).searchParams.get('callback');

  it('resolves with the callback payload and removes the script', async () => {
    const p = jsonp('https://itunes.apple.com/search?term=x');
    const script = appended();
    expect(script.src).toMatch(/^https:\/\/itunes\.apple\.com\/search\?term=x&callback=__hgJsonp\d+$/);
    window[callbackName(script)]({ resultCount: 0 });
    await expect(p).resolves.toEqual({ resultCount: 0 });
    expect(appended()).toBeNull();
  });
  it('rejects with code "unreachable" on a script error', async () => {
    const p = jsonp('https://x/?a=1');
    appended().onerror();
    await expect(p).rejects.toMatchObject({ code: 'unreachable' });
    expect(appended()).toBeNull();
  });
  it('rejects with code "timeout" and deletes the global after 60s', async () => {
    vi.useFakeTimers();
    const p = jsonp('https://x/?a=1', 500);
    const name = callbackName(appended());
    vi.advanceTimersByTime(500);
    await expect(p).rejects.toMatchObject({ code: 'timeout' });
    expect(typeof window[name]).toBe('function'); // a late response is a harmless no-op
    window[name]({ late: true });
    vi.advanceTimersByTime(60000);
    expect(name in window).toBe(false);
  });
});

describe('lookupTracks partial failure', () => {
  it('keeps successful chunks and records failed ones on map.errors', async () => {
    const boom = new Error('boom');
    const getJsonImpl = vi.fn(async (url) => {
      const ids = new URL(url).searchParams.get('id').split(',').map(Number);
      if (ids[0] === 1) throw boom;
      return { results: ids.map((id) => raw({ trackId: id })) };
    });
    const ids = Array.from({ length: 4 }, (_, i) => i + 1);
    const map = await lookupTracks(ids, { chunk: 2, getJsonImpl });
    expect([...map.keys()]).toEqual([3, 4]);
    expect(map.errors).toEqual([boom]);
  });
  it('has an empty errors list when everything succeeds', async () => {
    const map = await lookupTracks([1], { getJsonImpl: async () => ({ results: [raw()] }) });
    expect(map.errors).toEqual([]);
  });
  it('propagates AbortError instead of recording it', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const getJsonImpl = vi.fn();
    await expect(lookupTracks([1], { getJsonImpl, signal: ctrl.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(getJsonImpl).not.toHaveBeenCalled();
  });
});

describe('searchTracks / resolveByTitle cancellation', () => {
  it('searchTracks forwards the signal to getJson', async () => {
    const ctrl = new AbortController();
    const getJsonImpl = vi.fn(async () => ({ results: [raw()] }));
    const tracks = await searchTracks('yesterday', { getJsonImpl, signal: ctrl.signal });
    expect(tracks).toHaveLength(1);
    expect(getJsonImpl).toHaveBeenCalledWith(expect.any(String), { signal: ctrl.signal });
  });
  it('resolveByTitle rejects with AbortError when already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      resolveByTitle({ title: 'Yesterday', artist: 'The Beatles' }, { signal: ctrl.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('getJson guard covers the JSONP fallback', () => {
  const corsFail = () => vi.fn(async () => { throw new TypeError('Failed to fetch'); });

  it('rejects with AbortError promptly when aborted during JSONP', async () => {
    const ctrl = new AbortController();
    const jsonpImpl = vi.fn(() => new Promise(() => {}));
    const p = getJson('u', { fetchImpl: corsFail(), jsonpImpl, signal: ctrl.signal });
    await vi.waitFor(() => expect(jsonpImpl).toHaveBeenCalled());
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('times out a JSONP fallback that never answers', async () => {
    vi.useFakeTimers();
    const p = getJson('u', { fetchImpl: corsFail(), jsonpImpl: () => new Promise(() => {}), timeoutMs: 100 });
    const assertion = expect(p).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
  it('still surfaces a JSONP error', async () => {
    const err = Object.assign(new Error('jsonp-error'), { code: 'unreachable' });
    const jsonpImpl = vi.fn(async () => { throw err; });
    await expect(getJson('u', { fetchImpl: corsFail(), jsonpImpl })).rejects.toBe(err);
  });
});

describe('lookupTracks failedIds', () => {
  it('records the ids of failed chunks', async () => {
    const getJsonImpl = vi.fn(async (url) => {
      const ids = new URL(url).searchParams.get('id').split(',').map(Number);
      if (ids[0] === 1) throw new Error('boom');
      return { results: ids.map((id) => raw({ trackId: id })) };
    });
    const map = await lookupTracks([1, 2, 3, 4], { chunk: 2, getJsonImpl });
    expect([...map.failedIds]).toEqual([1, 2]);
  });
  it('is an empty set when every chunk succeeds', async () => {
    const map = await lookupTracks([1], { getJsonImpl: async () => ({ results: [] }) });
    expect(map.failedIds).toEqual(new Set());
  });
});
