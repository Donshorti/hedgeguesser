// Pure helpers for the playlist list and editor.
import { isAbortError } from '../utils/errors.js';
import { saveCustom } from '../services/playlists.js';

/** "<name> (copy)", then "(copy 2)", "(copy 3)" … so duplicates stay distinguishable. */
export function copyName(name, taken = []) {
  const base = `${String(name ?? '').trim() || 'Untitled playlist'} (copy`;
  const names = new Set(taken.map((n) => String(n).trim().toLowerCase()));
  let candidate = `${base})`;
  for (let n = 2; names.has(candidate.toLowerCase()); n += 1) candidate = `${base} ${n})`;
  return candidate;
}

/** Whether a search result is already in the list (matched by iTunes id). */
export function hasTrack(tracks, id) {
  return id != null && tracks.some((t) => t.id === id);
}

/** Appends `{id,title,artist}`; returns the same array when the id is already there. */
export function addTrack(tracks, track) {
  if (hasTrack(tracks, track.id)) return tracks;
  return [...tracks, { id: track.id, title: track.title, artist: track.artist }];
}

export function removeTrackAt(tracks, index) {
  return tracks.filter((_, i) => i !== index);
}

/** Tracks with no iTunes id: matched by title search the first time they play. */
export function unmatchedCount(tracks) {
  return tracks.filter((t) => t.id == null).length;
}

/** User-facing copy for a failed search; null for aborts (a newer search took over). */
export function searchErrorMessage(err) {
  if (!err || isAbortError(err)) return null;
  if (err.status === 403) return 'iTunes is busy — try again in a minute';
  if (err.code === 'unreachable' || err.code === 'timeout') return "Can't reach iTunes";
  return "Search failed — try again";
}

/** Set by a link elsewhere in the app to open the album-or-artist search on the Playlists screen. */
const OPEN_CATALOG_KEY = 'hg.openCatalogSearch';

export function requestCatalogSearch(storage = globalThis.sessionStorage) {
  try {
    storage.setItem(OPEN_CATALOG_KEY, '1');
  } catch {
    // no storage: the Playlists screen still opens, without the dialog
  }
}

export function catalogSearchRequested(storage = globalThis.sessionStorage) {
  try {
    return storage.getItem(OPEN_CATALOG_KEY) === '1';
  } catch {
    return false;
  }
}

export function clearCatalogSearchRequest(storage = globalThis.sessionStorage) {
  try {
    storage.removeItem(OPEN_CATALOG_KEY);
  } catch {
    // nothing to clear
  }
}

/** Shown for an album or artist playlist too short to run alone; null when it is long enough. */
export function shortPlaylistNote(count, min) {
  if (!count || count >= min) return null;
  return `Only ${plural(count, 'playable song')} — a run needs ${min}. Pick it together with another playlist.`;
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A house playlist as a fresh custom copy, or null when storage is full. */
export function duplicatePlaylist(p, catalog) {
  return saveCustom({
    name: copyName(p.name, catalog.map((x) => x.name)),
    color: p.color,
    tracks: p.tracks.map(({ id, title, artist }) => (id != null ? { id, title, artist } : { title, artist })),
  });
}
