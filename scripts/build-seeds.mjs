// Resolves scripts/seeds/*.txt to iTunes track IDs → src/data/seedPlaylists.json
// Usage: npm run seeds   (≈3s per uncached song; cache in scripts/.seed-cache.json)
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { searchTracks, pickBestMatch } from '../src/services/itunes.js';

const SEEDS = new URL('./seeds/', import.meta.url);
const CACHE = new URL('./.seed-cache.json', import.meta.url);
const OUT = new URL('../src/data/seedPlaylists.json', import.meta.url);
const COUNTRY = process.env.COUNTRY ?? 'US';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJsonImpl = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
};

const cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, 'utf8')) : {};
const playlists = [];

for (const file of (await readdir(SEEDS)).filter((f) => f.endsWith('.txt')).sort()) {
  const lines = (await readFile(new URL(file, SEEDS), 'utf8')).split(/\r?\n/);
  const meta = {};
  const tracks = [];
  for (const line of lines) {
    const h = line.match(/^#\s*(\w+):\s*(.+)$/);
    if (h) { meta[h[1]] = h[2].trim(); continue; }
    const m = line.trim().match(/^(.+?)\s+-\s+(.+)$/);
    if (!m) continue;
    const [, title, artist] = m;
    const key = `${COUNTRY}|${title}|${artist}`.toLowerCase();
    if (!(key in cache)) {
      try {
        const results = await searchTracks(`${title} ${artist}`, { country: COUNTRY, limit: 10, getJsonImpl });
        const best = pickBestMatch(results, { title, artist });
        cache[key] = best ? { id: best.id, title: best.title, artist: best.artist } : null;
      } catch (e) {
        console.warn(`  ! ${title} — ${artist}: ${e.message} (will retry next run)`);
        await sleep(30000);
        continue;
      }
      await writeFile(CACHE, JSON.stringify(cache, null, 1));
      await sleep(3100);
    }
    if (cache[key]) tracks.push(cache[key]);
    else console.warn(`  ✗ no match: ${title} — ${artist}`);
  }
  console.log(`${meta.code} ${meta.name}: ${tracks.length} tracks`);
  playlists.push({ id: meta.id, code: meta.code, name: meta.name, color: meta.color, tracks });
}

playlists.sort((a, b) => a.code.localeCompare(b.code));
await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(playlists, null, 2) + '\n');
console.log(`Wrote ${OUT.pathname}`);
