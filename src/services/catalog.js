import seedPlaylists from '../data/seedPlaylists.json';
import { listCustom } from './playlists.js';

/** Jukebox rows hold four selections each: A1–A4, B1–B4 … */
const PER_ROW = 4;
/** Custom playlists start on row D, after the house selection. */
const FIRST_CUSTOM_ROW = 'D'.charCodeAt(0);
const LAST_ROW = 'Z'.charCodeAt(0);
export const PLAYLIST_COLORS = ['pink', 'red', 'amber', 'cyan'];

/** D1, D2, D3, D4, E1 … ; past row Z the Z row just keeps counting. */
export function customCode(index) {
  const row = FIRST_CUSTOM_ROW + Math.floor(index / PER_ROW);
  if (row > LAST_ROW) return `Z${index - (LAST_ROW - FIRST_CUSTOM_ROW) * PER_ROW + 1}`;
  return `${String.fromCharCode(row)}${(index % PER_ROW) + 1}`;
}

const tracksOf = (p) => (Array.isArray(p.tracks) ? p.tracks : []);
const colorOf = (c) => (PLAYLIST_COLORS.includes(c) ? c : 'pink');

/**
 * Every playlist the jukebox can play, house selection first:
 * `{ id, code, name, color, tracks, custom }`. `color` is a role name
 * ('pink' | 'red' | 'amber' | 'cyan').
 */
export function getAllPlaylists() {
  const seeds = seedPlaylists.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    color: colorOf(p.color),
    tracks: tracksOf(p),
    custom: false,
  }));
  const custom = listCustom().map((p, i) => ({
    id: p.id,
    code: customCode(i),
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'Untitled playlist',
    color: colorOf(p.color),
    tracks: tracksOf(p),
    custom: true,
  }));
  return [...seeds, ...custom];
}
