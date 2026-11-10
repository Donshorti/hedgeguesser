import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  searchUrl, lookupUrl, toTrack, getJson, HttpError, pickBestMatch, lookupTracks, jsonp,
  searchTracks, resolveByTitle, searchAlbums, searchArtists, albumTracks, artistTracks, isAlternateVersion,
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

describe('pickBestMatch prefers original recordings', () => {
  const cand = (trackId, trackName, artistName) => toTrack(raw({ trackId, trackName, artistName }));

  // [wanted title, wanted artist, alternate version iTunes listed first, original as iTunes titles it]
  it.each([
    ['Poker Face', 'Lady Gaga', 'Poker Face (Glam As You Radio Mix)', 'Poker Face'],
    ['Get Lucky', 'Daft Punk', 'Get Lucky [Daft Punk Remix]', 'Get Lucky (feat. Pharrell Williams & Nile Rodgers)'],
    ['Blinding Lights', 'The Weeknd', 'Blinding Lights (Live)', 'Blinding Lights'],
    ['Creep', 'Radiohead', 'Creep (Acoustic)', 'Creep'],
    ['Purple Rain', 'Prince', 'Purple Rain (Piano & a Microphone 1983 Version)', 'Purple Rain'],
    ['Under Pressure', 'Queen', 'Under Pressure [Rah Mix]', 'Under Pressure (Remastered 2011)'],
    ['Mask Off', 'Future', 'Mask Off (Marshmello Remix)', 'Mask Off'],
    ["Lola's Theme", 'Shapeshifters', "Lola's Theme (Tripolism Extended Remix)", "Lola's Theme"],
    ['Kernkraft 400', 'Zombie Nation', 'Kernkraft 400 (Sport Chant Stadium Remix)', 'Kernkraft 400'],
    ['Espresso', 'Sabrina Carpenter', 'Espresso (On Vacation Version)', 'Espresso'],
    ['Despacito', 'Luis Fonsi', 'Despacito (Versión Pop)', 'Despacito (feat. Daddy Yankee)'],
    ['Bailando', 'Enrique Iglesias', 'Bailando (English Version)', 'Bailando (feat. Descemer Bueno & Gente de Zona)'],
    ['Felices los 4', 'Maluma', 'Felices los 4 [Salsa Version]', 'Felices los 4'],
    ['Mayores', 'Becky G', 'Mayores (Urban Tropical)', 'Mayores'],
    ['Waka Waka (This Time for Africa)', 'Shakira', 'Waka Waka (This Time for Africa) [K-Mix]', 'Waka Waka (This Time for Africa)'],
    ['Sin Pijama', 'Becky G', 'Sin Pijama (Kumbia Remix)', 'Sin Pijama'],
    ['Purple Haze', 'Jimi Hendrix', 'Purple Haze (Anthology Version)', 'Purple Haze'],
    ['Blue Monday', 'New Order', 'Blue Monday (12" Version)', 'Blue Monday'],
    ['Hey Jude', 'The Beatles', 'Hey Jude - Live', 'Hey Jude - Remastered 2015'],
    ['Levitating', 'Dua Lipa', 'Levitating (Sped Up)', 'Levitating'],
  ])('%s by %s: skips "%s"', (title, artist, alternate, original) => {
    const tracks = [cand(1, alternate, artist), cand(2, original, artist)];
    expect(pickBestMatch(tracks, { title, artist }).id).toBe(2);
  });

  it('does not penalise remasters or featured-artist credits', () => {
    const tracks = [
      cand(1, 'Bohemian Rhapsody (Live Aid)', 'Queen'),
      cand(2, 'Bohemian Rhapsody (Remastered 2011)', 'Queen'),
    ];
    expect(pickBestMatch(tracks, { title: 'Bohemian Rhapsody', artist: 'Queen' }).id).toBe(2);
    const feat = [cand(3, 'Despacito (feat. Justin Bieber) [Remix]', 'Luis Fonsi'), cand(4, 'Despacito (feat. Daddy Yankee)', 'Luis Fonsi')];
    expect(pickBestMatch(feat, { title: 'Despacito', artist: 'Luis Fonsi' }).id).toBe(4);
  });
  it('keeps a version the seed asks for', () => {
    const tracks = [cand(1, 'Creep', 'Radiohead'), cand(2, 'Creep (Acoustic)', 'Radiohead')];
    expect(pickBestMatch(tracks, { title: 'Creep (Acoustic)', artist: 'Radiohead' }).id).toBe(2);
  });
  it('does not penalise marker words that are part of the real title', () => {
    const tracks = [cand(1, 'Radio Ga Ga (Live Aid)', 'Queen'), cand(2, 'Radio Ga Ga', 'Queen')];
    expect(pickBestMatch(tracks, { title: 'Radio Ga Ga', artist: 'Queen' }).id).toBe(2);
    const piano = [cand(3, 'Piano Man', 'Billy Joel')];
    expect(pickBestMatch(piano, { title: 'Piano Man', artist: 'Billy Joel' }).id).toBe(3);
  });
  it('still returns the best candidate when every one is an alternate version', () => {
    const tracks = [cand(1, 'Creep (Acoustic)', 'Radiohead'), cand(2, 'Creep (Live)', 'Radiohead')];
    expect(pickBestMatch(tracks, { title: 'Creep', artist: 'Radiohead' })).not.toBeNull();
  });
  it('prefers an exact title over a near match', () => {
    const tracks = [cand(1, 'Loose Yourself', 'Eminem'), cand(2, 'Lose Yourself', 'Eminen')];
    expect(pickBestMatch(tracks, { title: 'Lose Yourself', artist: 'Eminem' }).id).toBe(2);
  });

  it.each([
    ['Get Lucky', 'Daft Punk', 'Daft Punk, Pharrell Williams & Nile Rodgers'],
    ['Under Pressure', 'Queen', 'Queen & David Bowie'],
    ['This Is What You Came For', 'Calvin Harris', 'Calvin Harris feat. Rihanna'],
    ['Old Town Road', 'Lil Nas X', 'Lil Nas X & Billy Ray Cyrus'],
    ['Señorita', 'Shawn Mendes', 'Shawn Mendes x Camila Cabello'],
    ['Stay', 'The Kid LAROI', 'The Kid LAROI with Justin Bieber'],
  ])('%s: matches "%s" within the credit "%s"', (title, artist, credit) => {
    const tracks = [cand(1, title, credit)];
    expect(pickBestMatch(tracks, { title, artist })?.id).toBe(1);
  });
  it('still rejects covers and karaoke by other artists', () => {
    const tracks = [
      cand(1, 'Blinding Lights (Karaoke Version)', 'Sing King'),
      cand(2, 'Blinding Lights', 'Some Cover Band & Friends'),
    ];
    expect(pickBestMatch(tracks, { title: 'Blinding Lights', artist: 'The Weeknd' })).toBeNull();
  });
});

describe('pickBestMatch alternate-version edge cases (seed run 2)', () => {
  const cand = (trackId, trackName, artistName) => toTrack(raw({ trackId, trackName, artistName }));

  it.each([
    ['Clint Eastwood', 'Gorillaz', 'Clint Eastwood (Ed Case / Sweetie Irie Refix)'],
    ['Feel So Close', 'Calvin Harris', 'Feel So Close (Nero Dub)'],
    ['Blue (Da Ba Dee)', 'Eiffel 65', 'Blue (Da Ba Dee) [Hannover Rmx]'],
    ['Pepas', 'Farruko', 'Pepas (Latin Urban Bass Boosted)'],
    ['Macarena', 'Los Del Rio', 'Macarena (River Re-Mix)'],
    ['Levels', 'Avicii', 'Levels (Skrillex Rework)'],
  ])('%s by %s: "%s" counts as an alternate version', (title, artist, alternate) => {
    // an unexplained qualifier costs a little; an alternate-version word costs a lot
    const tracks = [cand(1, alternate, artist), cand(2, `${title} (Bonus Track)`, artist)];
    expect(pickBestMatch(tracks, { title, artist }).id).toBe(2);
  });
  it.each([
    ['Pepas', 'Farruko', 'Pepas (Latin Urban Bass Boosted)', 'Pepas (Original Radio Version)'],
    ['Macarena', 'Los Del Rio', 'Macarena (Bayside Boys Remix)', 'Macarena (Original Version)'],
  ])('%s: a qualifier marked "original" is not an alternate version', (title, artist, alternate, original) => {
    const tracks = [cand(1, alternate, artist), cand(2, original, artist)];
    expect(pickBestMatch(tracks, { title, artist }).id).toBe(2);
  });
  it('prefers the plain recording over a later featured-artist re-recording', () => {
    const tracks = [
      cand(1, 'Hey There Delilah (feat. LØLØ)', "Plain White T's"),
      cand(2, 'Hey There Delilah', "Plain White T's"),
    ];
    expect(pickBestMatch(tracks, { title: 'Hey There Delilah', artist: "Plain White T's" }).id).toBe(2);
  });
  it('still picks a featured-artist original over an alternate version', () => {
    const tracks = [
      cand(1, 'Uptown Funk (Live)', 'Mark Ronson'),
      cand(2, 'Uptown Funk (feat. Bruno Mars)', 'Mark Ronson'),
    ];
    expect(pickBestMatch(tracks, { title: 'Uptown Funk', artist: 'Mark Ronson' }).id).toBe(2);
  });
});

describe('album and artist search', () => {
  it('maps album results and builds the album search URL', async () => {
    const getJsonImpl = vi.fn(async () => ({
      results: [
        { wrapperType: 'collection', collectionId: 7, collectionName: 'Help!', artistName: 'The Beatles',
          artworkUrl100: 'https://x/100x100bb.jpg', releaseDate: '1965-08-06T07:00:00Z', trackCount: 14 },
        { wrapperType: 'track', trackId: 1 },
      ],
    }));
    expect(await searchAlbums('help', { country: 'DE', getJsonImpl })).toEqual([
      { id: 7, name: 'Help!', artist: 'The Beatles', artwork: 'https://x/100x100bb.jpg', year: 1965, trackCount: 14 },
    ]);
    const u = new URL(getJsonImpl.mock.calls[0][0]);
    expect(u.origin + u.pathname).toBe('https://itunes.apple.com/search');
    expect(Object.fromEntries(u.searchParams)).toEqual({ term: 'help', media: 'music', entity: 'album', limit: '12', country: 'DE' });
  });

  it('maps artist results and builds the artist search URL', async () => {
    const getJsonImpl = vi.fn(async () => ({
      results: [{ wrapperType: 'artist', artistId: 136975, artistName: 'The Beatles', primaryGenreName: 'Rock' }, { wrapperType: 'artist' }],
    }));
    expect(await searchArtists('beatles', { getJsonImpl })).toEqual([{ id: 136975, name: 'The Beatles', genre: 'Rock' }]);
    const p = new URL(getJsonImpl.mock.calls[0][0]).searchParams;
    expect([p.get('entity'), p.get('limit'), p.get('country')]).toEqual(['musicArtist', '8', 'US']);
  });
});

describe('isAlternateVersion', () => {
  it.each([
    'Yesterday (Live at the BBC)', 'Hey Jude - Live', 'Levitating (The Blessed Madonna Remix)', 'Help! [Demo]',
    'Hello (Acoustic)', 'Hello (Karaoke Version)', 'Hello (Instrumental)', 'One More Time (Extended Mix)',
  ])('%s is an alternate', (title) => expect(isAlternateVersion(title)).toBe(true));
  it.each([
    'Yesterday', 'Yesterday (Remastered 2009)', 'Hey Jude - 2015 Remaster', 'Piano Man', 'Radio Ga Ga',
    'Live and Let Die', 'Love Story (Taylor’s Version)', 'Around the World (Radio Edit)', 'Song (Original Mix)',
    'Stay (feat. Justin Bieber)',
  ])('%s is not', (title) => expect(isAlternateVersion(title)).toBe(false));
});

describe('albumTracks', () => {
  it('keeps album order, drops songs without a preview and repeated titles', async () => {
    const getJsonImpl = vi.fn(async () => ({
      results: [
        { wrapperType: 'collection', collectionId: 7, collectionName: 'Help!', artistName: 'The Beatles' },
        raw({ trackId: 3, trackName: 'Yesterday', discNumber: 1, trackNumber: 3 }),
        raw({ trackId: 1, trackName: 'Help!', discNumber: 1, trackNumber: 1 }),
        raw({ trackId: 2, trackName: 'The Night Before', discNumber: 1, trackNumber: 2, previewUrl: undefined }),
        raw({ trackId: 5, trackName: 'Yesterday (Live)', discNumber: 2, trackNumber: 1 }),
        raw({ trackId: 4, trackName: 'Ticket to Ride', discNumber: 1, trackNumber: 4 }),
      ],
    }));
    const out = await albumTracks(7, { country: 'GB', getJsonImpl });
    expect(out.name).toBe('Help!');
    expect(out.artist).toBe('The Beatles');
    expect(out.tracks.map((t) => t.id)).toEqual([1, 3, 4]);
    expect(out.tracks[0]).toMatchObject({ title: 'Help!', artist: 'The Beatles', previewUrl: 'https://p/1.m4a' });
    const u = new URL(getJsonImpl.mock.calls[0][0]);
    expect(u.origin + u.pathname).toBe('https://itunes.apple.com/lookup');
    expect([u.searchParams.get('id'), u.searchParams.get('entity'), u.searchParams.get('country')]).toEqual(['7', 'song', 'GB']);
  });
});

describe('artistTracks', () => {
  it('drops alternates, no-preview songs, other artists and repeats, keeping the first of each title', async () => {
    const getJsonImpl = vi.fn(async () => ({
      results: [
        { wrapperType: 'artist', artistId: 9, artistName: 'The Beatles' },
        raw({ trackId: 1, trackName: 'Yesterday (Remastered 2009)' }),
        raw({ trackId: 2, trackName: 'Yesterday' }),
        raw({ trackId: 3, trackName: 'Hey Jude (Live)' }),
        raw({ trackId: 4, trackName: 'Hey Jude', previewUrl: undefined }),
        raw({ trackId: 5, trackName: 'Let It Be', artistName: 'Some Tribute Band' }),
        raw({ trackId: 6, trackName: 'Get Back', artistName: 'The Beatles & Billy Preston' }),
        raw({ trackId: 7, trackName: 'Help! - Demo' }),
        raw({ trackId: 8, trackName: 'Something' }),
      ],
    }));
    const out = await artistTracks(9, { getJsonImpl });
    expect(out.name).toBe('The Beatles');
    expect(out.tracks.map((t) => t.id)).toEqual([1, 6, 8]);
    const p = new URL(getJsonImpl.mock.calls[0][0]).searchParams;
    expect([p.get('id'), p.get('entity'), p.get('limit')]).toEqual(['9', 'song', '200']);
  });

  it('returns an empty list when the lookup has nothing', async () => {
    expect(await artistTracks(9, { getJsonImpl: async () => ({ results: [] }) })).toEqual({ name: '', tracks: [] });
  });
});
