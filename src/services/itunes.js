import { normalizeText, normalizeTitle } from '../utils/normalize.js';
import { similarity } from '../utils/fuzzyMatch.js';
import { createThrottle } from '../utils/throttle.js';

const SEARCH = 'https://itunes.apple.com/search';
const LOOKUP = 'https://itunes.apple.com/lookup';

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
export function jsonp(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const name = `__hgJsonp${jsonpSeq++}`;
    const script = document.createElement('script');
    const cleanup = () => {
      clearTimeout(timer);
      window[name] = () => {}; // late responses become no-ops
      script.remove();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('jsonp-timeout'));
    }, timeoutMs);
    window[name] = (data) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('jsonp-error'));
    };
    script.src = `${url}&callback=${name}`;
    document.head.appendChild(script);
  });
}

export async function getJson(url, { fetchImpl = globalThis.fetch, jsonpImpl = jsonp } = {}) {
  let res;
  try {
    res = await fetchImpl(url);
  } catch {
    return jsonpImpl(url); // network or CORS failure
  }
  if (!res.ok) throw new HttpError(res.status);
  return res.json();
}

export async function searchTracks(term, { country, limit, getJsonImpl = getJson } = {}) {
  const data = await getJsonImpl(searchUrl(term, { country, limit }));
  return (data?.results ?? []).map(toTrack).filter(Boolean);
}

export async function lookupTracks(ids, { country, chunk = 150, getJsonImpl = getJson } = {}) {
  const map = new Map();
  for (let i = 0; i < ids.length; i += chunk) {
    const data = await getJsonImpl(lookupUrl(ids.slice(i, i + chunk), { country }));
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

export async function resolveByTitle({ title, artist }, opts = {}) {
  const results = await bulkThrottle(() => searchTracks(`${title} ${artist}`, { ...opts, limit: 10 }));
  return pickBestMatch(results, { title, artist });
}
