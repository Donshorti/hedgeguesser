import { load, save } from './storage.js';
import { insertScore, readTable } from '../utils/highScores.js';

const key = (mode) => `scores:${mode}`;

/** The validated top-10 table for 'challenge' | 'endless', best first. */
export function loadScores(mode) {
  return readTable(load(key(mode)));
}

/** Insert `{ initials, score, date }` into the mode's table, persist, return the new table. */
export function saveScore(mode, entry) {
  const table = insertScore(loadScores(mode), entry);
  save(key(mode), table);
  return table;
}
