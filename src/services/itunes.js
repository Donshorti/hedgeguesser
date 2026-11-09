import { normalizeText, normalizeTitle } from '../utils/normalize.js';
import { similarity } from '../utils/fuzzyMatch.js';
import { createThrottle } from '../utils/throttle.js';
import { abortError, codedError, isAbortError } from '../utils/errors.js';

const SEARCH = 'https://itunes.apple.com/search';
const LOOKUP = 'https://itunes.apple.com/lookup';
const JSONP_GLOBAL_TTL_MS = 60000;

export class HttpError extends Error {
  constructor(status) {
    super(`http-${status}`);
    this.status = status;
  }
}

export function searchUrl(term, { country = 'US', limit = 15 } = {}) {
  const p = new URLSearchParams({ term, media: 'music', entity: 'song', limit: String(limit), country });
  return `${SEARCH}?${p}`;
}

export function lookupUrl(ids, { country = 'US' } = {}) {
  const p = new URLSearchParams({ id: ids.join(','), country });
  return `${LOOKUP}?${p}`;
}

export function toTrack(r) {
  if (!r || r.wrapperType !== 'track' || r.kind !== 'song' || !r.previewUrl) return null;
  return {
    id: r.trackId,
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName ?? '',
    artwork: (r.artworkUrl100 ?? '').replace('100x100bb', '600x600bb'),
    previewUrl: r.previewUrl,
    year: r.releaseDate ? Number(String(r.releaseDate).slice(0, 4)) : null,
    genre: r.primaryGenreName ?? '',
  };
}

let jsonpSeq = 0;

/**
 * JSONP request (fallback when fetch fails on CORS).
 * Rejects with `code: 'unreachable'` when the script fails to load and `code: 'timeout'`
 * when no response arrives in time. A 403 rate-limit response carries no usable body for
 * a script tag, so it usually surfaces here as 'unreachable'.
 */
export function jsonp(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const name = `__hgJsonp${jsonpSeq++}`;
    const script = document.createElement('script');
    const cleanup = () => {
      clearTimeout(timer);
      window[name] = () => {}; // late responses become no-ops until the global is dropped
      setTimeout(() => delete window[name], JSONP_GLOBAL_TTL_MS);
      script.remove();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(codedError('timeout', 'jsonp-timeout'));
    }, timeoutMs);
    window[name] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(codedError('unreachable', 'jsonp-error'));
    };
    script.src = `${url}&callback=${name}`;
    document.head.appendChild(script);
  });
}

/**
 * GET JSON via fetch, falling back to JSONP on a network/CORS failure.
 * Times out after `timeoutMs` with `code: 'timeout'` (no JSONP fallback, to avoid
 * doubling the wait). An aborted `signal` rejects with an AbortError.
 */
export async function getJson(
  url,
  { fetchImpl = globalThis.fetch, jsonpImpl = jsonp, timeoutMs = 8000, signal } = {}
) {
  if (signal?.aborted) throw abortError();
  const ctrl = new AbortController();
  let guardError = null;
  let failGuard;
  const guard = new Promise((_, reject) => {
    failGuard = (err) => {
      guardError = err;
      ctrl.abort();
      reject(err);
    };
  });
  const timer = setTimeout(() => failGuard(codedError('timeout', 'itunes-timeout')), timeoutMs);
  const onAbort = () => failGuard(abortError());
  signal?.addEventListener('abort', onAbort, { once: true });

  const work = (async () => {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (!res.ok) throw new HttpError(res.status);
    return res.json();
  })();
  work.catch(() => {}); // a late rejection after the guard wins is expected

  try {
    return await Promise.race([work, guard]);
  } catch (err) {
    if (guardError) throw guardError;
    if (err instanceof HttpError) throw err;
    return jsonpImpl(url); // network or CORS failure
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function searchTracks(term, { country, limit, getJsonImpl = getJson, signal } = {}) {
  const data = await getJsonImpl(searchUrl(term, { country, limit }), { signal });
  return (data?.results ?? []).map(toTrack).filter(Boolean);
}

/**
 * Batch lookup by id. Never throws for a failed chunk: the returned Map holds every
 * track that was fetched, and `map.errors` lists one error per failed chunk (empty when
 * all succeeded). An AbortError from `signal` is the only rejection.
 */
export async function lookupTracks(ids, { country, chunk = 150, getJsonImpl = getJson, signal } = {}) {
  const map = new Map();
  map.errors = [];
  for (let i = 0; i < ids.length; i += chunk) {
    if (signal?.aborted) throw abortError();
    let data;
    try {
      data = await getJsonImpl(lookupUrl(ids.slice(i, i + chunk), { country }), { signal });
    } catch (err) {
      if (isAbortError(err)) throw err;
      map.errors.push(err);
      continue;
    }
    for (const r of data?.results ?? []) {
      const t = toTrack(r);
      if (t) map.set(t.id, t);
    }
  }
  return map;
}

export function pickBestMatch(tracks, { title, artist }) {
  const wantTitle = normalizeTitle(title);
  const wantArtist = normalizeText(artist);
  let best = null;
  let bestScore = -1;
  for (const t of tracks) {
    const ts = similarity(normalizeTitle(t.title), wantTitle);
    const as = wantArtist ? similarity(normalizeText(t.artist), wantArtist) : 1;
    if (ts < 0.7 || as < 0.5) continue;
    const score = ts * 0.6 + as * 0.4;
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return best;
}

/** Shared throttle for bulk title resolution (iTunes allows ~20 req/min). */
export const bulkThrottle = createThrottle(3100);

export async function resolveByTitle({ title, artist }, { signal, ...opts } = {}) {
  if (signal?.aborted) throw abortError();
  const results = await bulkThrottle(() => {
    if (signal?.aborted) throw abortError();
    return searchTracks(`${title} ${artist}`, { ...opts, limit: 10, signal });
  });
  return pickBestMatch(results, { title, artist });
}
