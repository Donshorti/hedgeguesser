import { load, save } from './storage.js';
import { lookupTracks, resolveByTitle } from './itunes.js';
import { titleVariants } from '../utils/normalize.js';
import { abortError, codedError, isAbortError } from '../utils/errors.js';

export class ImportError extends Error {}

const KEY = 'customPlaylists';
const CACHE_KEY = 'trackCache';
const CACHE_TTL = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 1500;
/** Consecutive title-search errors after which the network is treated as unreachable. */
const MAX_RESOLVE_FAILURES = 3;

function validTrack(t) {
  return t && typeof t.title === 'string' && t.title.trim() && typeof t.artist === 'string' && t.artist.trim();
}

export function parseImport(text) {
  const src = String(text ?? '').trim();
  if (!src) throw new ImportError('Nothing to import — paste JSON or one "Title - Artist" per line.');
  if (src.startsWith('{') || src.startsWith('[')) {
    let data;
    try {
      data = JSON.parse(src);
    } catch (e) {
      throw new ImportError(`That JSON doesn't parse: ${e.message}`);
    }
    const list = Array.isArray(data) ? data : data?.tracks;
    if (!Array.isArray(list) || !list.length) throw new ImportError('JSON needs a non-empty "tracks" array.');
    const tracks = list.map((t, i) => {
      if (!validTrack(t)) throw new ImportError(`JSON track ${i + 1} needs a "title" and an "artist".`);
      const out = { title: t.title.trim(), artist: t.artist.trim() };
      if (Number.isInteger(t.id)) out.id = t.id;
      return out;
    });
    return { name: typeof data?.name === 'string' && data.name.trim() ? data.name.trim() : 'Imported playlist', tracks };
  }
  const tracks = [];
  src.split(/\r?\n/).forEach((line, i) => {
    const l = line.trim();
    if (!l || l.startsWith('#')) return;
    const m = l.match(/^(.+?)\s+[-–—]\s+(.+)$/);
    if (!m) throw new ImportError(`Line ${i + 1} needs the form "Title - Artist": ${l}`);
    tracks.push({ title: m[1].trim(), artist: m[2].trim() });
  });
  if (!tracks.length) throw new ImportError('No tracks found.');
  return { name: 'Imported playlist', tracks };
}

export function listCustom() {
  const v = load(KEY, []);
  return Array.isArray(v) ? v.filter((p) => p && p.id && Array.isArray(p.tracks)) : [];
}

export function saveCustom(playlist) {
  const all = listCustom();
  const id = playlist.id ?? `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const p = { ...playlist, id, updatedAt: Date.now() };
  const i = all.findIndex((x) => x.id === p.id);
  if (i >= 0) all[i] = p;
  else all.push(p);
  return save(KEY, all) ? p : null;
}

export function deleteCustom(id) {
  save(KEY, listCustom().filter((p) => p.id !== id));
}

/**
 * Track cache: `entries` is `[id, { t: track, at: fetchedAtMs }]` in insertion order,
 * oldest first. Expired or malformed entries are dropped on read.
 */
function readCache(country, now) {
  const cache = new Map();
  try {
    const c = load(`${CACHE_KEY}:${country}`, null);
    if (!c || !Array.isArray(c.entries)) return cache;
    for (const entry of c.entries) {
      if (!Array.isArray(entry)) continue;
      const [id, v] = entry;
      const fresh = v && typeof v === 'object' && v.t && typeof v.t === 'object' &&
        Number.isFinite(v.at) && now - v.at < CACHE_TTL;
      if (fresh) cache.set(id, v);
    }
  } catch {
    return new Map();
  }
  return cache;
}

function writeCache(country, cache) {
  save(`${CACHE_KEY}:${country}`, { entries: [...cache].slice(-CACHE_MAX_ENTRIES) });
}

/**
 * Resolve a playlist's tracks to playable iTunes tracks.
 *
 * Ids are looked up in one batch; a track without an id, or whose id the lookup did not
 * return, falls back to a title search when it has a title and artist. A failed lookup is
 * not fatal: loading continues with cached tracks and title search. After
 * MAX_RESOLVE_FAILURES consecutive title-search errors (a "no match" is not an error),
 * searching stops and `error` gets `code: 'unreachable'`. An aborted `signal` rejects
 * with an AbortError.
 *
 * @returns {Promise<{tracks: object[], resolvedIds: number[], error: Error|null}>}
 *   resolvedIds lets callers persist ids for import lists; error is the first problem met.
 */
export async function loadPlaylistTracks(
  playlist,
  {
    country = 'US',
    lookup = lookupTracks,
    resolve = resolveByTitle,
    onProgress,
    useCache = false,
    signal,
    now = Date.now,
  } = {}
) {
  if (signal?.aborted) throw abortError();
  const total = playlist.tracks.length;
  let done = 0;
  let error = null;
  const cache = useCache ? readCache(country, now()) : new Map();
  const ids = [...new Set(playlist.tracks.filter((t) => t.id && !cache.has(t.id)).map((t) => t.id))];
  if (ids.length) {
    try {
      const fetched = await lookup(ids, { country, signal });
      error = fetched.errors?.[0] ?? null;
      const at = now();
      for (const [id, t] of fetched) {
        cache.delete(id); // re-insert so the newest entries sit at the end
        cache.set(id, { t, at });
      }
    } catch (err) {
      if (isAbortError(err)) throw err;
      error = err;
    }
  }

  const out = [];
  let failures = 0;
  for (const t of playlist.tracks) {
    let track = t.id ? cache.get(t.id)?.t ?? null : null;
    if (!track && failures < MAX_RESOLVE_FAILURES && validTrack(t)) {
      if (signal?.aborted) throw abortError();
      try {
        track = await resolve(t, { country, signal });
        failures = 0;
      } catch (err) {
        if (isAbortError(err)) throw err;
        track = null;
        if (++failures === MAX_RESOLVE_FAILURES) {
          error = codedError('unreachable', 'Song search keeps failing; stopped resolving titles.');
        }
      }
    }
    out.push(track ?? null);
    onProgress?.(++done, total);
  }
  if (useCache) writeCache(country, cache);
  const tracks = out.filter((t) => t && t.previewUrl && titleVariants(t.title).length);
  return { tracks, resolvedIds: tracks.map((t) => t.id), error };
}
