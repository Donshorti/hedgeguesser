import { describe, it, expect, vi } from 'vitest';
import {
  parseSpotifyLink,
  base64url,
  randomVerifier,
  challengeFor,
  redirectUri,
  authorizeUrl,
  beginLogin,
  completeLogin,
  getAccessToken,
  fetchSpotifyTracks,
  MAX_TRACKS,
} from './spotify.js';
import { SPOTIFY_CLIENT_ID } from '../config/spotify.js';

const ID = '37i9dQZF1DXcBWIGoYBM5M';

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const fail = (status) => ({ ok: false, status, json: async () => ({}) });

describe('parseSpotifyLink', () => {
  it('reads playlist and album URLs, with share and locale parts', () => {
    expect(parseSpotifyLink(`https://open.spotify.com/playlist/${ID}?si=abc123`)).toEqual({ type: 'playlist', id: ID });
    expect(parseSpotifyLink(`  https://open.spotify.com/intl-de/playlist/${ID}\n`)).toEqual({ type: 'playlist', id: ID });
    expect(parseSpotifyLink(`https://open.spotify.com/album/${ID}`)).toEqual({ type: 'album', id: ID });
    expect(parseSpotifyLink(`https://open.spotify.com/intl-pt-br/album/${ID}?si=x`)).toEqual({ type: 'album', id: ID });
  });
  it('reads spotify: URIs', () => {
    expect(parseSpotifyLink(`spotify:playlist:${ID}`)).toEqual({ type: 'playlist', id: ID });
    expect(parseSpotifyLink(`spotify:album:${ID}`)).toEqual({ type: 'album', id: ID });
  });
  it('rejects everything else', () => {
    expect(parseSpotifyLink(`https://open.spotify.com/track/${ID}`)).toBeNull();
    expect(parseSpotifyLink(`https://open.spotify.com/artist/${ID}`)).toBeNull();
    expect(parseSpotifyLink(`https://evil.example/open.spotify.com/playlist/${ID}`)).toBeNull();
    expect(parseSpotifyLink('Yesterday - The Beatles')).toBeNull();
    expect(parseSpotifyLink(`Yesterday - The Beatles\nhttps://open.spotify.com/playlist/${ID}`)).toBeNull();
    expect(parseSpotifyLink('')).toBeNull();
    expect(parseSpotifyLink(null)).toBeNull();
  });
});

describe('PKCE', () => {
  it('base64url has no padding and no + or /', () => {
    expect(base64url(new Uint8Array([251, 255, 254]))).toBe('-__-');
    expect(base64url(new Uint8Array([0]))).toBe('AA');
  });
  it('matches the RFC 7636 challenge vector', async () => {
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    );
  });
  it('makes a fresh URL-safe verifier of a legal length', () => {
    const a = randomVerifier();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(randomVerifier()).not.toBe(a);
  });
  it('builds the redirect URI from origin and path only', () => {
    expect(redirectUri({ origin: 'https://donshorti.github.io', pathname: '/hedgeguesser/', search: '?x=1', hash: '#/play' })).toBe(
      'https://donshorti.github.io/hedgeguesser/'
    );
  });
  it('builds the authorize URL', () => {
    const u = new URL(authorizeUrl({ challenge: 'CH', state: 'ST', redirect: 'http://127.0.0.1:5173/' }));
    expect(u.origin + u.pathname).toBe('https://accounts.spotify.com/authorize');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: 'http://127.0.0.1:5173/',
      scope: 'playlist-read-private playlist-read-collaborative',
      state: 'ST',
      code_challenge_method: 'S256',
      code_challenge: 'CH',
    });
  });
});

describe('login round trip', () => {
  it('beginLogin stores verifier, state and link, then leaves; completeLogin trades the code', async () => {
    const storage = memoryStorage();
    const loc = { origin: 'http://127.0.0.1:5173', pathname: '/', search: '', hash: '#/playlists', assign: vi.fn() };
    await beginLogin(`spotify:playlist:${ID}`, { loc, storage });
    const sent = new URL(loc.assign.mock.calls[0][0]);
    const saved = JSON.parse(storage.getItem('hg.spotify.pkce'));
    expect(saved.pending).toBe(`spotify:playlist:${ID}`);
    expect(sent.searchParams.get('state')).toBe(saved.state);
    expect(sent.searchParams.get('code_challenge')).toBe(await challengeFor(saved.verifier));

    const back = { ...loc, search: `?code=CODE&state=${saved.state}`, hash: '' };
    const hist = { state: null, replaceState: vi.fn() };
    const fetchImpl = vi.fn(async () => ok({ access_token: 'AT', expires_in: 3600, refresh_token: 'RT' }));
    const out = await completeLogin({ loc: back, hist, storage, fetchImpl, now: () => 1000 });
    expect(out).toEqual({ link: `spotify:playlist:${ID}`, error: null });
    expect(hist.replaceState).toHaveBeenCalledWith(null, '', '/');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://accounts.spotify.com/api/token');
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(new URLSearchParams(init.body))).toEqual({
      grant_type: 'authorization_code',
      code: 'CODE',
      redirect_uri: 'http://127.0.0.1:5173/',
      code_verifier: saved.verifier,
      client_id: SPOTIFY_CLIENT_ID,
    });
    expect(JSON.parse(storage.getItem('hg.spotify.token'))).toEqual({
      access_token: 'AT',
      expires_at: 1000 + 3600000,
      refresh_token: 'RT',
    });
    expect(storage.getItem('hg.spotify.pkce')).toBeNull();
  });

  const pkce = { 'hg.spotify.pkce': JSON.stringify({ verifier: 'V', state: 'S', pending: 'LINK' }) };
  const hist = () => ({ state: null, replaceState: vi.fn() });
  const at = (search, hash = '') => ({ origin: 'http://127.0.0.1:5173', pathname: '/', search, hash });

  it('is a no-op on a normal page load', async () => {
    const h = hist();
    expect(await completeLogin({ loc: at(''), hist: h, storage: memoryStorage(pkce), fetchImpl: vi.fn() })).toBeNull();
    expect(h.replaceState).not.toHaveBeenCalled();
  });
  it('rejects a state mismatch without calling Spotify, and keeps the hash', async () => {
    const h = hist();
    const fetchImpl = vi.fn();
    const out = await completeLogin({ loc: at('?code=C&state=OTHER', '#/play'), hist: h, storage: memoryStorage(pkce), fetchImpl });
    expect(out).toEqual({ link: 'LINK', error: 'state' });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(h.replaceState).toHaveBeenCalledWith(null, '', '/#/play');
  });
  it('reports a cancelled login and a failed exchange', async () => {
    expect(await completeLogin({ loc: at('?error=access_denied&state=S'), hist: hist(), storage: memoryStorage(pkce), fetchImpl: vi.fn() })).toEqual({
      link: 'LINK',
      error: 'denied',
    });
    const out = await completeLogin({ loc: at('?code=C&state=S'), hist: hist(), storage: memoryStorage(pkce), fetchImpl: async () => fail(400) });
    expect(out).toEqual({ link: 'LINK', error: 'auth' });
  });
  it('ignores a code this tab never asked for', async () => {
    expect(await completeLogin({ loc: at('?code=C&state=S'), hist: hist(), storage: memoryStorage(), fetchImpl: vi.fn() })).toBeNull();
  });
});

describe('getAccessToken', () => {
  const stored = (t) => memoryStorage({ 'hg.spotify.token': JSON.stringify(t) });
  it('returns null without a token and the token while it is fresh', async () => {
    expect(await getAccessToken({ storage: memoryStorage(), fetchImpl: vi.fn() })).toBeNull();
    const fetchImpl = vi.fn();
    expect(await getAccessToken({ storage: stored({ access_token: 'AT', expires_at: 100000 }), fetchImpl, now: () => 0 })).toBe('AT');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('refreshes an expired token and keeps the old refresh token when none is returned', async () => {
    const storage = stored({ access_token: 'OLD', expires_at: 10, refresh_token: 'RT' });
    const fetchImpl = vi.fn(async () => ok({ access_token: 'NEW', expires_in: 60 }));
    expect(await getAccessToken({ storage, fetchImpl, now: () => 1000 })).toBe('NEW');
    expect(Object.fromEntries(new URLSearchParams(fetchImpl.mock.calls[0][1].body))).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'RT',
      client_id: SPOTIFY_CLIENT_ID,
    });
    expect(JSON.parse(storage.getItem('hg.spotify.token'))).toEqual({ access_token: 'NEW', expires_at: 61000, refresh_token: 'RT' });
  });
  it('forgets a token it cannot refresh', async () => {
    const storage = stored({ access_token: 'OLD', expires_at: 10, refresh_token: 'RT' });
    expect(await getAccessToken({ storage, fetchImpl: async () => fail(400), now: () => 1000 })).toBeNull();
    expect(storage.getItem('hg.spotify.token')).toBeNull();
  });
});

describe('fetchSpotifyTracks', () => {
  const song = (name, artist = 'A') => ({ type: 'track', name, artists: [{ name: artist }, { name: 'Guest' }] });
  /** Routes by URL without the query; a function gets the full URL. */
  function router(routes) {
    return vi.fn(async (url) => {
      const hit = routes[url] ?? routes[url.split('?')[0]];
      if (hit === undefined) return fail(404);
      const v = typeof hit === 'function' ? hit(url) : hit;
      return typeof v === 'number' ? fail(v) : ok(v);
    });
  }
  const P = `https://api.spotify.com/v1/playlists/${ID}`;

  it('reads a playlist from /items, taking the track from `item` or `track`, skipping junk', async () => {
    const fetchImpl = router({
      [P]: { name: 'Road trip' },
      [`${P}/items`]: {
        items: [
          { item: song('One', 'First') },
          { track: song('Two') },
          { item: null },
          { track: null },
          { is_local: true, track: song('Local file') },
          { item: { ...song('Local too'), is_local: true } },
          { item: { type: 'episode', name: 'A podcast', artists: [{ name: 'Host' }] } },
        ],
        next: null,
      },
    });
    const out = await fetchSpotifyTracks({ type: 'playlist', id: ID }, 'TOKEN', { fetchImpl });
    expect(out).toEqual({ name: 'Road trip', tracks: [{ title: 'One', artist: 'First' }, { title: 'Two', artist: 'A' }] });
    expect(fetchImpl.mock.calls[0][0]).toBe(`${P}?fields=name`);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer TOKEN');
    expect(fetchImpl.mock.calls[1][0]).toBe(`${P}/items?limit=100&offset=0`);
  });

  it('falls back to /tracks when /items is a 404, and follows `next`', async () => {
    const fetchImpl = router({
      [P]: { name: 'Old API' },
      [`${P}/items`]: 404,
      [`${P}/tracks`]: (url) =>
        url.includes('offset=100')
          ? { items: [{ track: song('Second page') }], next: null }
          : { items: [{ track: song('First page') }], next: `${P}/tracks?offset=100&limit=100` },
    });
    const out = await fetchSpotifyTracks({ type: 'playlist', id: ID }, 'T', { fetchImpl });
    expect(out.tracks.map((t) => t.title)).toEqual(['First page', 'Second page']);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('caps a long playlist and stops paging', async () => {
    const page = { items: Array.from({ length: 100 }, (_, i) => ({ item: song(`S${i}`) })), next: `${P}/items?more` };
    const fetchImpl = router({ [P]: { name: 'Long' }, [`${P}/items`]: page });
    const out = await fetchSpotifyTracks({ type: 'playlist', id: ID }, 'T', { fetchImpl });
    expect(out.tracks).toHaveLength(MAX_TRACKS);
    expect(fetchImpl).toHaveBeenCalledTimes(1 + MAX_TRACKS / 100);
  });

  it('does not follow a `next` link that leaves the Web API', async () => {
    const fetchImpl = router({
      [P]: { name: 'X' },
      [`${P}/items`]: { items: [{ item: song('One') }], next: 'https://evil.example/steal' },
    });
    await fetchSpotifyTracks({ type: 'playlist', id: ID }, 'T', { fetchImpl });
    expect(fetchImpl.mock.calls.map((c) => c[0])).not.toContain('https://evil.example/steal');
  });

  it('reads an album and follows tracks.next', async () => {
    const A = `https://api.spotify.com/v1/albums/${ID}`;
    const fetchImpl = router({
      [A]: { name: 'Abbey Road', artists: [{ name: 'The Beatles' }], tracks: { items: [song('Come Together', 'The Beatles')], next: `${A}/tracks?offset=50` } },
      [`${A}/tracks`]: { items: [song('Something', 'The Beatles')], next: null },
    });
    expect(await fetchSpotifyTracks({ type: 'album', id: ID }, 'T', { fetchImpl })).toEqual({
      name: 'Abbey Road',
      tracks: [
        { title: 'Come Together', artist: 'The Beatles' },
        { title: 'Something', artist: 'The Beatles' },
      ],
    });
  });

  it.each([
    [401, 'auth'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [429, 'busy'],
    [500, 'failed'],
  ])('maps HTTP %i to %s', async (status, code) => {
    await expect(fetchSpotifyTracks({ type: 'playlist', id: ID }, 'T', { fetchImpl: async () => fail(status) })).rejects.toMatchObject({ code });
    await expect(fetchSpotifyTracks({ type: 'album', id: ID }, 'T', { fetchImpl: async () => fail(status) })).rejects.toMatchObject({ code });
  });

  it('maps a 403 on the track list, a network failure and an empty list', async () => {
    const forbidden = router({ [P]: { name: 'X' }, [`${P}/items`]: 403 });
    await expect(fetchSpotifyTracks({ type: 'playlist', id: ID }, 'T', { fetchImpl: forbidden })).rejects.toMatchObject({ code: 'forbidden' });
    const down = async () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(fetchSpotifyTracks({ type: 'playlist', id: ID }, 'T', { fetchImpl: down })).rejects.toMatchObject({ code: 'unreachable' });
    const empty = router({ [P]: { name: 'X' }, [`${P}/items`]: { items: [], next: null } });
    await expect(fetchSpotifyTracks({ type: 'playlist', id: ID }, 'T', { fetchImpl: empty })).rejects.toMatchObject({ code: 'empty' });
  });
});
