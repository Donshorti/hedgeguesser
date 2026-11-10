import { SPOTIFY_CLIENT_ID, SPOTIFY_SCOPES } from '../config/spotify.js';
import { codedError } from '../utils/errors.js';

const AUTHORIZE = 'https://accounts.spotify.com/authorize';
const TOKEN = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
const PKCE_KEY = 'hg.spotify.pkce';
const TOKEN_KEY = 'hg.spotify.token';
const PAGE = 100;
export const MAX_TRACKS = 500;
/** A token this close to expiry is refreshed before use. */
const EXPIRY_MARGIN_MS = 30000;

const ID = '[A-Za-z0-9]{10,}';
const URL_LINK = new RegExp(`^https?://open\\.spotify\\.com/(?:intl-[a-z-]+/)?(playlist|album)/(${ID})(?:[/?#].*)?$`, 'i');
const URI_LINK = new RegExp(`^spotify:(playlist|album):(${ID})$`, 'i');

/** `{type: 'playlist'|'album', id}` for a Spotify playlist or album link or URI, else null. */
export function parseSpotifyLink(text) {
  const src = String(text ?? '').trim();
  const m = src.match(URL_LINK) ?? src.match(URI_LINK);
  return m ? { type: m[1].toLowerCase(), id: m[2] } : null;
}

// ---- PKCE ----

export function base64url(bytes) {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A random URL-safe string (86 characters for the default 64 bytes). */
export function randomVerifier(bytes = 64, cryptoImpl = globalThis.crypto) {
  return base64url(cryptoImpl.getRandomValues(new Uint8Array(bytes)));
}

/** The S256 code challenge for a verifier. */
export async function challengeFor(verifier, cryptoImpl = globalThis.crypto) {
  const digest = await cryptoImpl.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(digest);
}

/** Must match a redirect URI registered for the app, so it carries no query or hash. */
export function redirectUri(loc = globalThis.location) {
  return loc.origin + loc.pathname;
}

export function authorizeUrl({ challenge, state, redirect }) {
  const p = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirect,
    scope: SPOTIFY_SCOPES,
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  });
  return `${AUTHORIZE}?${p}`;
}

function readJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key));
  } catch {
    return null;
  }
}

/**
 * Leave for Spotify's login page. The verifier, the state and the pasted link wait in
 * sessionStorage, so the import resumes when Spotify sends the browser back.
 */
export async function beginLogin(
  pending,
  { loc = globalThis.location, storage = globalThis.sessionStorage, cryptoImpl = globalThis.crypto } = {}
) {
  const verifier = randomVerifier(64, cryptoImpl);
  const state = randomVerifier(16, cryptoImpl);
  const challenge = await challengeFor(verifier, cryptoImpl);
  storage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, pending: pending ?? null }));
  loc.assign(authorizeUrl({ challenge, state, redirect: redirectUri(loc) }));
}

async function requestToken(fields, { fetchImpl, storage, now, previous }) {
  let res;
  try {
    res = await fetchImpl(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...fields, client_id: SPOTIFY_CLIENT_ID }).toString(),
    });
  } catch {
    throw codedError('unreachable');
  }
  if (!res.ok) throw codedError('auth');
  const data = await res.json();
  if (!data?.access_token) throw codedError('auth');
  const token = {
    access_token: data.access_token,
    expires_at: now() + (Number(data.expires_in) || 3600) * 1000,
    refresh_token: data.refresh_token ?? previous?.refresh_token ?? null,
  };
  // sessionStorage, not localStorage: the token ends with the tab
  storage.setItem(TOKEN_KEY, JSON.stringify(token));
  return token;
}

/**
 * Finish a login when the page was opened by Spotify's redirect (`?code=…&state=…` or
 * `?error=…`). Strips the query but keeps the hash. Returns null when this is a normal
 * page load, else `{link, error}`: the link pasted before login, and an error code
 * ('denied', 'state', 'auth', 'unreachable') or null.
 */
export async function completeLogin({
  loc = globalThis.location,
  hist = globalThis.history,
  storage = globalThis.sessionStorage,
  fetchImpl = globalThis.fetch,
  now = Date.now,
} = {}) {
  const params = new URLSearchParams(loc.search);
  const code = params.get('code');
  const denied = params.get('error');
  if (!code && !denied) return null;
  const saved = readJson(storage, PKCE_KEY);
  storage.removeItem(PKCE_KEY);
  const redirect = redirectUri(loc);
  hist.replaceState(hist.state, '', loc.pathname + loc.hash);
  if (!saved?.verifier) return null; // not a login this tab started
  const link = saved.pending ?? null;
  if (denied) return { link, error: 'denied' };
  if (params.get('state') !== saved.state) return { link, error: 'state' };
  try {
    await requestToken(
      { grant_type: 'authorization_code', code, redirect_uri: redirect, code_verifier: saved.verifier },
      { fetchImpl, storage, now }
    );
    return { link, error: null };
  } catch (err) {
    return { link, error: err.code ?? 'auth' };
  }
}

let returning = null;
/** `completeLogin` once per page load, however often the app asks. */
export function completeLoginIfReturning() {
  returning ??= completeLogin();
  return returning;
}

export function forgetToken(storage = globalThis.sessionStorage) {
  storage.removeItem(TOKEN_KEY);
}

/** A usable access token (refreshed when expired), or null when a login is needed. */
export async function getAccessToken({
  storage = globalThis.sessionStorage,
  fetchImpl = globalThis.fetch,
  now = Date.now,
} = {}) {
  const token = readJson(storage, TOKEN_KEY);
  if (!token?.access_token) return null;
  if (token.expires_at - EXPIRY_MARGIN_MS > now()) return token.access_token;
  if (!token.refresh_token) {
    forgetToken(storage);
    return null;
  }
  try {
    const fresh = await requestToken(
      { grant_type: 'refresh_token', refresh_token: token.refresh_token },
      { fetchImpl, storage, now, previous: token }
    );
    return fresh.access_token;
  } catch {
    forgetToken(storage);
    return null;
  }
}

// ---- Web API ----

const STATUS_CODES = { 401: 'auth', 403: 'forbidden', 404: 'not-found', 429: 'busy' };

const MESSAGES = {
  auth: 'Your Spotify login expired. Connect again.',
  denied: 'Spotify login was cancelled.',
  state: 'That Spotify login didn’t match this tab. Connect again.',
  forbidden:
    "Spotify won't share this playlist with this app. It must be a playlist you own or follow, and your Spotify account must be on the app's user list.",
  'not-found': 'Spotify has no playlist or album at that link.',
  busy: 'Spotify is busy — try again in a minute.',
  unreachable: "Can't reach Spotify.",
  empty: 'No songs found at that link.',
};

/** User-facing copy for an error code from this module. */
export function spotifyErrorMessage(code) {
  return MESSAGES[code] ?? 'Spotify import failed — try again.';
}

/** Codes that are fixed by logging in again rather than by retrying. */
export function needsLogin(code) {
  return code === 'auth' || code === 'denied' || code === 'state';
}

async function api(url, token, fetchImpl) {
  let res;
  try {
    res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw codedError('unreachable');
  }
  if (!res.ok) throw codedError(STATUS_CODES[res.status] ?? 'failed', `spotify-${res.status}`);
  return res.json();
}

/** Only follow paging links that stay on the Web API. */
const nextPage = (url) => (typeof url === 'string' && url.startsWith(`${API}/`) ? url : null);

function toEntry(t) {
  if (!t || t.is_local || (t.type && t.type !== 'track')) return null;
  const title = String(t.name ?? '').trim();
  const artist = String(t.artists?.[0]?.name ?? '').trim();
  return title && artist ? { title, artist } : null;
}

/**
 * The name and `{title, artist}` list of a playlist or album, at most MAX_TRACKS songs.
 * Local files, episodes and removed tracks are skipped. Rejects with a coded error:
 * 'auth' (401), 'forbidden' (403), 'not-found' (404), 'busy' (429), 'unreachable',
 * 'empty', or 'failed'.
 */
export async function fetchSpotifyTracks({ type, id }, token, { fetchImpl = globalThis.fetch } = {}) {
  const tracks = [];
  const add = (items, pick) => {
    for (const it of items ?? []) {
      const entry = toEntry(pick(it));
      if (entry && tracks.length < MAX_TRACKS) tracks.push(entry);
    }
  };
  let name;
  if (type === 'album') {
    const album = await api(`${API}/albums/${id}`, token, fetchImpl);
    name = album.name;
    let page = album.tracks;
    while (page) {
      add(page.items, (it) => it);
      const next = tracks.length < MAX_TRACKS ? nextPage(page.next) : null;
      page = next ? await api(next, token, fetchImpl) : null;
    }
  } else {
    name = (await api(`${API}/playlists/${id}?fields=name`, token, fetchImpl)).name;
    const first = (kind) => api(`${API}/playlists/${id}/${kind}?limit=${PAGE}&offset=0`, token, fetchImpl);
    let page;
    try {
      page = await first('items');
    } catch (err) {
      // the 2026 endpoint is not live everywhere: fall back to the older one
      if (err.code !== 'not-found') throw err;
      page = await first('tracks');
    }
    while (page) {
      // the entry holds its track under `item` (2026) or `track` (older)
      add(page.items, (it) => (it?.is_local ? null : it?.item ?? it?.track));
      const next = tracks.length < MAX_TRACKS ? nextPage(page.next) : null;
      page = next ? await api(next, token, fetchImpl) : null;
    }
  }
  if (!tracks.length) throw codedError('empty');
  return { name: String(name ?? '').trim() || 'Spotify playlist', tracks };
}
