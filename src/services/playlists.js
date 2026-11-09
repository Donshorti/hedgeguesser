import { load, save } from './storage.js';
import { lookupTracks, resolveByTitle } from './itunes.js';

export class ImportError extends Error {}

const KEY = 'customPlaylists';
const CACHE_KEY = 'trackCache';
const CACHE_TTL = 24 * 60 * 60 * 1000;

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
  const p = { ...playlist, id: playlist.id ?? `c_${Date.now().toString(36)}`, updatedAt: Date.now() };
  const i = all.findIndex((x) => x.id === p.id);
  if (i >= 0) all[i] = p;
  else all.push(p);
  save(KEY, all);
  return p;
}

export function deleteCustom(id) {
  save(KEY, listCustom().filter((p) => p.id !== id));
}

function readCache(country) {
  const c = load(`${CACHE_KEY}:${country}`, null);
  return c && Date.now() - c.at < CACHE_TTL ? new Map(c.entries) : new Map();
}
function writeCache(country, map) {
  save(`${CACHE_KEY}:${country}`, { at: Date.now(), entries: [...map].slice(-1500) });
}

/**
 * Resolve a playlist's tracks to playable iTunes tracks.
 * @returns {{tracks: object[], resolvedIds: number[]}} resolvedIds lets callers persist ids for import lists.
 */
export async function loadPlaylistTracks(
  playlist,
  { country = 'US', lookup = lookupTracks, resolve = resolveByTitle, onProgress, useCache = false } = {}
) {
  const total = playlist.tracks.length;
  let done = 0;
  const cache = useCache ? readCache(country) : new Map();
  const ids = playlist.tracks.filter((t) => t.id && !cache.has(t.id)).map((t) => t.id);
  const fetched = ids.length ? await lookup(ids, { country }) : new Map();
  for (const [id, t] of fetched) cache.set(id, t);
  const out = [];
  for (const t of playlist.tracks) {
    let track = t.id ? cache.get(t.id) : null;
    if (!track && !t.id) {
      try {
        track = await resolve(t, { country });
      } catch {
        track = null;
      }
    }
    out.push(track ?? null);
    onProgress?.(++done, total);
  }
  if (useCache) writeCache(country, cache);
  const tracks = out.filter((t) => t && t.previewUrl);
  return { tracks, resolvedIds: tracks.map((t) => t.id) };
}
