# HedgeGuesser Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build HedgeGuesser, a static Vite + React song-guessing game (Heardle-style, 4 progressive stages) deployable to GitHub Pages, per `docs/plans/2026-11-09-hedgeguesser-design.md`.

**Architecture:**
- Game logic (normalizing, fuzzy matching, scoring, reducer, settings, storage, hints, iTunes client, import parsing) lives in framework-free ES modules, built test-first with Vitest.
- React handles the UI only: hash routing, two contexts (Settings, Game) and a `StagePlayer` class that wraps one `HTMLAudioElement`.
- Seed playlists are resolved to iTunes track IDs at dev time by a Node script, then fetched at runtime with one batched lookup.

**Tech Stack:** Node 20+, Vite 5, React 18, Vitest 2 + jsdom, `@fontsource/*` + `dseg` fonts (self-hosted), GitHub Actions → GitHub Pages.

**Conventions:**
- All paths are relative to the repo root `Music game/`.
- Commits use the repo-local identity (Donshorti) and end with the `Co-Authored-By` trailer.
- Logic tasks (2–9) carry complete code.
- UI tasks (10–20) carry exact files, component contracts, behaviors and acceptance checks. Their JSX/CSS is written at execution time after reading Impeccable's `reference/craft-floor.md`, as the design skill requires before any UI edit.

---

### Task 0: Prerequisite — Node.js (user action)

Node is not installed on this machine. Run once and restart the terminal:

```bash
winget install OpenJS.NodeJS.LTS
```

Verify: `node --version` prints v20 or newer, and `npm --version` prints a version.

---

### Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `.gitignore`, `src/main.jsx`, `src/App.jsx`, `public/favicon.svg`

**Step 1: Write `package.json`**

```json
{
  "name": "hedgeguesser",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "seeds": "node scripts/build-seeds.mjs"
  },
  "dependencies": {
    "@fontsource/barlow-semi-condensed": "^5.1.0",
    "@fontsource/bungee": "^5.1.0",
    "@fontsource/monoton": "^5.1.0",
    "dseg": "^0.46.0",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "vite": "^5.4.11",
    "vitest": "^2.1.8"
  }
}
```

**Step 2: Write `vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.js', 'scripts/**/*.test.js'],
  },
});
```

**Step 3: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0f051d" />
    <meta name="description" content="HedgeGuesser — name the song from half a second of audio." />
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <title>HedgeGuesser</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Step 4: Write `.gitignore`**

```
node_modules/
dist/
.DS_Store
*.log
scripts/.seed-cache.json
.impeccable/questions/
.impeccable/mocks/
.impeccable/review/
.impeccable/config.local.json
```

**Step 5: Write `src/main.jsx` and a placeholder `src/App.jsx`**

```jsx
// src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```jsx
// src/App.jsx
export default function App() {
  return <h1>HedgeGuesser</h1>;
}
```

`public/favicon.svg`: a 32×32 SVG, a cyan note glyph on `#0f051d`. It gets finalized in Task 10.

**Step 6: Install and smoke-test**

Run: `npm install`, then `npm run dev`.
Expected: Vite prints a `http://localhost:5173/` URL, and the page shows "HedgeGuesser". Stop the server.

**Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.js index.html .gitignore src public
git commit -m "chore: scaffold Vite + React project"
```

---

### Task 2: Text normalization and fuzzy title matching

**Files:**
- Create: `src/utils/normalize.js`, `src/utils/fuzzyMatch.js`
- Test: `src/utils/fuzzyMatch.test.js`

**Step 1: Write the failing tests**

```js
// src/utils/fuzzyMatch.test.js
import { describe, it, expect } from 'vitest';
import { normalizeTitle, titleVariants, normalizeText } from './normalize.js';
import { levenshtein, maxEdits, isCorrectGuess, similarity } from './fuzzyMatch.js';

describe('normalizeTitle', () => {
  it.each([
    ['Bohemian Rhapsody - Remastered 2011', 'bohemian rhapsody'],
    ["Don't Stop Me Now", 'dont stop me now'],
    ['Despacito (feat. Daddy Yankee)', 'despacito'],
    ['Café del Mar', 'cafe del mar'],
    ['Rock & Roll', 'rock and roll'],
    ['The Final Countdown', 'final countdown'],
    ['Hey Jude - Live at Wembley', 'hey jude'],
    ['Song feat. Somebody', 'song'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  it('keeps non-Latin letters', () => {
    expect(normalizeTitle('紅蓮華')).toBe('紅蓮華');
  });
});

describe('titleVariants', () => {
  it('offers stripped and full forms for leading brackets', () => {
    expect(titleVariants("(I Can't Get No) Satisfaction")).toEqual([
      'satisfaction',
      'i cant get no satisfaction',
    ]);
  });
});

describe('levenshtein / maxEdits', () => {
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });
  it('scales tolerance by length', () => {
    expect(maxEdits(4)).toBe(0);
    expect(maxEdits(5)).toBe(1);
    expect(maxEdits(7)).toBe(1);
    expect(maxEdits(8)).toBe(2);
    expect(maxEdits(14)).toBe(2);
    expect(maxEdits(20)).toBe(3);
  });
});

describe('isCorrectGuess — should pass', () => {
  it.each([
    ['Bohemian Rhapsody', 'bohemian rapsody'],
    ["Don't Stop Me Now", 'dont stop me now'],
    ['Smells Like Teen Spirit', 'smells like teen spirt'],
    ['Hey Jude - Remastered 2015', 'hey jude'],
    ['The Final Countdown', 'final countdown'],
    ['The Final Countdown', 'The Final Countdown!'],
    ['Rock & Roll', 'rock and roll'],
    ['Rock & Roll', 'rock n roll'],
    ['Despacito (feat. Daddy Yankee)', 'despacito'],
    ['Café del Mar', 'cafe del mar'],
    ["(I Can't Get No) Satisfaction", 'satisfaction'],
    ["(I Can't Get No) Satisfaction", 'i cant get no satisfaction'],
    ['Yesterday', 'Yesterday - The Beatles'],
    ['Thriller', 'thriler'],
    ['Up', 'up'],
  ])('%s <- "%s"', (title, guess) => {
    expect(isCorrectGuess(guess, title)).toBe(true);
  });
});

describe('isCorrectGuess — should fail', () => {
  it.each([
    ['Hello', 'Halo'],
    ['Roar', 'Roam'],
    ['One', 'Ode'],
    ['Yesterday', 'Tomorrow'],
    ['Bohemian Rhapsody', 'bohemian'],
    ['Hey Jude', 'hey'],
    ['Abba Song', 'ab'],
    ['Yesterday', ''],
    ['Yesterday', '   '],
  ])('%s <- "%s"', (title, guess) => {
    expect(isCorrectGuess(guess, title)).toBe(false);
  });

  it('rejects a guess that exactly names another song in the pool', () => {
    expect(isCorrectGuess('Believer', 'Believe')).toBe(true); // no pool: within 1 edit
    expect(isCorrectGuess('Believer', 'Believe', ['Believe', 'Believer'])).toBe(false);
  });
});

describe('similarity / normalizeText', () => {
  it('is 1 for equal, lower for different', () => {
    expect(similarity('abc', 'abc')).toBe(1);
    expect(similarity('abc', 'xyz')).toBe(0);
  });
  it('normalizes artists', () => {
    expect(normalizeText('Beyoncé & JAY-Z')).toBe('beyonce and jay z');
  });
});
```

**Step 2: Run to verify failure**

Run: `npx vitest run src/utils/fuzzyMatch.test.js`
Expected: FAIL. The modules are not found.

**Step 3: Implement `src/utils/normalize.js`**

```js
const VERSION_TAIL =
  /\s+-\s+.*\b(live|remaster(ed)?|version|edit|mix|mono|stereo|acoustic|demo|radio|single|bonus)\b.*$/i;
const FEAT_TAIL = /\s*\b(feat\.?|ft\.?|featuring)\s.*$/i;
const BRACKETED = /[([][^)\]]*[)\]]/g;
const FEAT_BRACKET = /[([]\s*(feat\.?|ft\.?|featuring)\s[^)\]]*[)\]]/gi;

function base(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function clean(t) {
  return t
    .replace(/['’‘`´]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the\s+/, '');
}

/** Generic text normalization (artists, search). */
export function normalizeText(s) {
  return clean(base(s));
}

/** All acceptable normalized forms of a song title, primary form first. */
export function titleVariants(title) {
  const b = base(title).replace(VERSION_TAIL, '');
  const stripped = clean(b.replace(BRACKETED, ' ').replace(FEAT_TAIL, ''));
  const full = clean(b.replace(FEAT_BRACKET, ' ').replace(FEAT_TAIL, ''));
  return [...new Set([stripped, full].filter(Boolean))];
}

/** Primary normalized title. */
export function normalizeTitle(title) {
  return titleVariants(title)[0] ?? '';
}
```

**Step 4: Implement `src/utils/fuzzyMatch.js`**

```js
import { normalizeTitle, titleVariants } from './normalize.js';

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Allowed typos for an answer of `len` normalized characters. */
export function maxEdits(len) {
  if (len <= 4) return 0;
  if (len <= 7) return 1;
  if (len <= 14) return 2;
  return Math.floor(len * 0.15);
}

/** 0..1 similarity of two already-normalized strings. */
export function similarity(a, b) {
  const longest = Math.max(a.length, b.length);
  if (!longest) return 1;
  return 1 - levenshtein(a, b) / longest;
}

function guessForms(guess) {
  const raw = String(guess ?? '').trim();
  const forms = [raw];
  const parts = raw.split(/\s+[-–—]\s+/);
  if (parts.length > 1) forms.push(parts[0]);
  return [...new Set(forms.map(normalizeTitle).filter(Boolean))];
}

/**
 * Title-only correctness check.
 * @param {string} guess   what the player typed
 * @param {string} title   the answer's raw title
 * @param {string[]} poolTitles raw titles in the active pool (for decoy rejection)
 */
export function isCorrectGuess(guess, title, poolTitles = []) {
  const guesses = guessForms(guess);
  if (!guesses.length) return false;
  const answers = titleVariants(title);
  if (!answers.length) return false;
  const shortest = Math.min(...answers.map((a) => a.length));
  const decoys = new Set(
    poolTitles.flatMap(titleVariants).filter((t) => !answers.includes(t))
  );
  return guesses.some((g) => {
    if (g.length < 3 && g.length < shortest) return false;
    if (answers.includes(g)) return true;
    if (decoys.has(g)) return false;
    return answers.some((a) => levenshtein(g, a) <= maxEdits(a.length));
  });
}
```

**Step 5: Run to verify pass**

Run: `npx vitest run src/utils/fuzzyMatch.test.js`
Expected: all tests PASS. If a normalization case fails, fix the regex in `normalize.js`, not the test.

**Step 6: Commit**

```bash
git add src/utils
git commit -m "feat: title normalization and fuzzy guess matching"
```

---

### Task 3: Game config and settings validation

**Files:**
- Create: `src/config/gameConfig.js`
- Test: `src/config/gameConfig.test.js`

**Step 1: Failing test**

```js
// src/config/gameConfig.test.js
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, mergeSettings, validStages } from './gameConfig.js';

describe('validStages', () => {
  it('accepts 4 ascending positive durations up to 30s', () => {
    expect(validStages([0.5, 5, 15, 30])).toBe(true);
    expect(validStages([1, 2, 3, 4])).toBe(true);
  });
  it.each([
    [[5, 0.5, 15, 30]],
    [[0.5, 5, 15]],
    [[0, 5, 15, 30]],
    [[0.5, 5, 15, 31]],
    [[0.5, 5, 'x', 30]],
    [null],
  ])('rejects %j', (s) => expect(validStages(s)).toBe(false));
});

describe('mergeSettings', () => {
  it('returns defaults for garbage', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings('nope')).toEqual(DEFAULT_SETTINGS);
  });
  it('keeps valid overrides and repairs invalid ones', () => {
    const s = mergeSettings({
      stages: [1, 2, 3, 4],
      stagePoints: [9, 8],
      endlessLives: 99,
      volume: 2,
      hintCosts: { year: 50 },
    });
    expect(s.stages).toEqual([1, 2, 3, 4]);
    expect(s.stagePoints).toEqual(DEFAULT_SETTINGS.stagePoints);
    expect(s.endlessLives).toBe(9);
    expect(s.volume).toBe(1);
    expect(s.hintCosts).toEqual({ ...DEFAULT_SETTINGS.hintCosts, year: 50 });
  });
  it('does not mutate defaults', () => {
    const s = mergeSettings({});
    s.stages.push(99);
    expect(DEFAULT_SETTINGS.stages).toHaveLength(4);
  });
});
```

**Step 2:** Run `npx vitest run src/config`. Expected: FAIL.

**Step 3: Implement**

```js
// src/config/gameConfig.js
export const HINTS = ['year', 'genre', 'artistInitials', 'firstLetter'];

export const DEFAULT_SETTINGS = Object.freeze({
  stages: Object.freeze([0.5, 5, 15, 30]),
  stagePoints: Object.freeze([1000, 500, 250, 100]),
  challengeLength: 20,
  endlessLives: 3,
  hintCosts: Object.freeze({ year: 100, genre: 100, artistInitials: 200, firstLetter: 300 }),
  minPlayableSongs: 8,
  country: 'US',
  volume: 0.8,
});

export function validStages(stages) {
  return (
    Array.isArray(stages) &&
    stages.length === 4 &&
    stages.every(
      (n, i) =>
        typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 30 && (i === 0 || n > stages[i - 1])
    )
  );
}

const clamp = (n, lo, hi, fallback) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;

export function mergeSettings(saved) {
  const src = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const d = DEFAULT_SETTINGS;
  const stages = validStages(src.stages) ? [...src.stages] : [...d.stages];
  const points =
    Array.isArray(src.stagePoints) &&
    src.stagePoints.length === stages.length &&
    src.stagePoints.every((n) => Number.isFinite(n) && n >= 0)
      ? [...src.stagePoints]
      : [...d.stagePoints];
  const hintCosts = { ...d.hintCosts };
  for (const k of HINTS) {
    const v = src.hintCosts?.[k];
    if (Number.isFinite(v) && v >= 0) hintCosts[k] = v;
  }
  return {
    stages,
    stagePoints: points,
    challengeLength: Math.round(clamp(src.challengeLength, 1, 50, d.challengeLength)),
    endlessLives: Math.round(clamp(src.endlessLives, 1, 9, d.endlessLives)),
    hintCosts,
    minPlayableSongs: d.minPlayableSongs,
    country: typeof src.country === 'string' && /^[A-Z]{2}$/.test(src.country) ? src.country : d.country,
    volume: clamp(src.volume, 0, 1, d.volume),
  };
}
```

Note: `mergeSettings(null)` must `toEqual` the frozen defaults. It returns plain copies with equal values, so `toEqual` passes.

**Step 4:** Run `npx vitest run src/config`. Expected: PASS.

**Step 5: Commit**

```bash
git add src/config
git commit -m "feat: game config defaults and settings validation"
```

---

### Task 4: Storage and high scores

**Files:**
- Create: `src/services/storage.js`, `src/utils/highScores.js`
- Test: `src/services/storage.test.js`, `src/utils/highScores.test.js`

**Step 1: Failing tests**

```js
// src/services/storage.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { load, save, remove, PREFIX } from './storage.js';

beforeEach(() => localStorage.clear());

describe('storage', () => {
  it('round-trips JSON under a versioned prefix', () => {
    save('x', { a: 1 });
    expect(localStorage.getItem(`${PREFIX}x`)).toBe('{"a":1}');
    expect(load('x', null)).toEqual({ a: 1 });
  });
  it('returns fallback for missing keys', () => {
    expect(load('missing', 42)).toBe(42);
  });
  it('recovers from corrupt data by removing it', () => {
    localStorage.setItem(`${PREFIX}bad`, '{not json');
    expect(load('bad', 'fb')).toBe('fb');
    expect(localStorage.getItem(`${PREFIX}bad`)).toBeNull();
  });
  it('remove deletes the key', () => {
    save('y', 1);
    remove('y');
    expect(load('y', null)).toBeNull();
  });
});
```

```js
// src/utils/highScores.test.js
import { describe, it, expect } from 'vitest';
import { qualifies, insertScore, sanitizeInitials, MAX_SCORES } from './highScores.js';

const list = (n) => Array.from({ length: n }, (_, i) => ({ initials: 'AAA', score: (n - i) * 100, date: i }));

describe('highScores', () => {
  it('qualifies any positive score when the table has room', () => {
    expect(qualifies([], 1)).toBe(true);
    expect(qualifies([], 0)).toBe(false);
  });
  it('requires beating the lowest score when full', () => {
    const full = list(MAX_SCORES); // lowest is 100
    expect(qualifies(full, 100)).toBe(false);
    expect(qualifies(full, 101)).toBe(true);
  });
  it('inserts sorted and trims to MAX_SCORES', () => {
    const out = insertScore(list(MAX_SCORES), { initials: 'NEW', score: 550, date: 99 });
    expect(out).toHaveLength(MAX_SCORES);
    expect(out.map((e) => e.score)).toEqual([...out.map((e) => e.score)].sort((a, b) => b - a));
    expect(out.some((e) => e.initials === 'NEW')).toBe(true);
  });
  it('sanitizes initials to 3 uppercase alphanumerics', () => {
    expect(sanitizeInitials('ab!c9')).toBe('ABC');
    expect(sanitizeInitials('z')).toBe('Z');
    expect(sanitizeInitials(null)).toBe('');
  });
});
```

**Step 2:** Run `npx vitest run src/services/storage.test.js src/utils/highScores.test.js`. Expected: FAIL.

**Step 3: Implement**

```js
// src/services/storage.js
export const PREFIX = 'hg:v1:';

export function load(key, fallback) {
  let raw;
  try {
    raw = localStorage.getItem(PREFIX + key);
  } catch {
    return fallback;
  }
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    remove(key);
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* storage unavailable */
  }
}

/** Remove every HedgeGuesser key (Settings → Reset all data). */
export function clearAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}
```

```js
// src/utils/highScores.js
export const MAX_SCORES = 10;

export function qualifies(list, score) {
  if (!(score > 0)) return false;
  if (list.length < MAX_SCORES) return true;
  return score > list[list.length - 1].score;
}

export function insertScore(list, entry) {
  return [...list, entry]
    .sort((a, b) => b.score - a.score || a.date - b.date)
    .slice(0, MAX_SCORES);
}

export function sanitizeInitials(s) {
  return String(s ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
}

/** Validate a stored table; anything malformed is dropped. */
export function readTable(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e) => e && typeof e.initials === 'string' && Number.isFinite(e.score))
    .slice(0, MAX_SCORES);
}
```

**Step 4:** Run the same command. Expected: PASS.

**Step 5: Commit**

```bash
git add src/services/storage.js src/services/storage.test.js src/utils/highScores.js src/utils/highScores.test.js
git commit -m "feat: versioned localStorage wrapper and high-score table"
```

---

### Task 5: Hint text helpers

**Files:**
- Create: `src/utils/hints.js`
- Test: `src/utils/hints.test.js`

**Step 1: Failing test**

```js
// src/utils/hints.test.js
import { describe, it, expect } from 'vitest';
import { artistInitials, titleMask, hintText } from './hints.js';

describe('hints', () => {
  it('artist initials', () => {
    expect(artistInitials('The Beatles')).toBe('T. B.');
    expect(artistInitials('Beyoncé')).toBe('B.');
    expect(artistInitials('AC/DC')).toBe('A. D.');
  });
  it('title mask reveals first letter and word shape', () => {
    expect(titleMask('Hey Jude')).toBe('H__ ____');
    // letters/digits become "_" except the first; punctuation and spaces are kept
    expect(titleMask("Don't Stop")).toBe("D__'_ ____");
    expect(titleMask('Despacito (feat. Daddy Yankee)')).toBe('D________');
  });
  it('hintText maps each hint type', () => {
    const t = { title: 'Hey Jude', artist: 'The Beatles', year: 1968, genre: 'Rock' };
    expect(hintText('year', t)).toBe('1968');
    expect(hintText('genre', t)).toBe('Rock');
    expect(hintText('artistInitials', t)).toBe('T. B.');
    expect(hintText('firstLetter', t)).toBe('H__ ____');
    expect(hintText('year', { ...t, year: null })).toBe('Unknown');
  });
});
```

**Step 2:** Run `npx vitest run src/utils/hints.test.js`. Expected: FAIL.

**Step 3: Implement**

```js
// src/utils/hints.js
export function artistInitials(artist) {
  return String(artist ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[\s/&,-]+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
    .map((w) => w.match(/[\p{L}\p{N}]/u)[0].toUpperCase() + '.')
    .join(' ');
}

export function titleMask(title) {
  const clean = String(title ?? '').replace(/\s*[([].*$/, '').replace(/\s+-\s+.*$/, '').trim();
  let revealed = false;
  return [...clean]
    .map((ch) => {
      if (/[\p{L}\p{N}]/u.test(ch)) {
        if (!revealed) {
          revealed = true;
          return ch.toUpperCase();
        }
        return '_';
      }
      return ch;
    })
    .join('');
}

export function hintText(type, track) {
  switch (type) {
    case 'year':
      return track.year ? String(track.year) : 'Unknown';
    case 'genre':
      return track.genre || 'Unknown';
    case 'artistInitials':
      return artistInitials(track.artist) || '?';
    case 'firstLetter':
      return titleMask(track.title);
    default:
      return '';
  }
}
```

**Step 4:** Run the test. Expected: PASS.

**Step 5:** `git add src/utils/hints.* && git commit -m "feat: hint text helpers"`

---

### Task 6: Game reducer

**Files:**
- Create: `src/state/gameReducer.js`
- Test: `src/state/gameReducer.test.js`

**Step 1: Failing test**

```js
// src/state/gameReducer.test.js
import { describe, it, expect } from 'vitest';
import { gameReducer, initialGameState } from './gameReducer.js';
import { mergeSettings } from '../config/gameConfig.js';

const settings = mergeSettings({ challengeLength: 2 });
const tracks = [
  { id: 1, title: 'Yesterday', artist: 'The Beatles' },
  { id: 2, title: 'Hey Jude', artist: 'The Beatles' },
  { id: 3, title: 'Let It Be', artist: 'The Beatles' },
];
const start = (mode = 'challenge', s = settings) =>
  gameReducer(initialGameState, { type: 'START', mode, tracks, settings: s });
const run = (state, ...actions) => actions.reduce(gameReducer, state);

describe('START', () => {
  it('challenge caps queue at challengeLength and keeps reserve', () => {
    const s = start();
    expect(s.status).toBe('playing');
    expect(s.queue.map((t) => t.id)).toEqual([1, 2]);
    expect(s.reserve.map((t) => t.id)).toEqual([3]);
    expect(s.lives).toBe(0);
  });
  it('endless uses all tracks and sets lives', () => {
    const s = start('endless');
    expect(s.queue).toHaveLength(3);
    expect(s.lives).toBe(3);
  });
});

describe('GUESS / SKIP', () => {
  it('correct guess at stage 0 scores full points and reveals', () => {
    const s = run(start(), { type: 'GUESS', text: 'yesterday' });
    expect(s.status).toBe('reveal');
    expect(s.outcome).toBe('win');
    expect(s.score).toBe(1000);
    expect(s.results).toEqual([{ trackId: 1, stage: 0, points: 1000 }]);
  });
  it('wrong guess advances the stage and is logged', () => {
    const s = run(start(), { type: 'GUESS', text: 'help' });
    expect(s.stage).toBe(1);
    expect(s.attempts).toEqual([{ type: 'guess', text: 'help', correct: false }]);
  });
  it('blank guess is ignored', () => {
    const s0 = start();
    expect(run(s0, { type: 'GUESS', text: '  ' })).toBe(s0);
  });
  it('correct at stage 2 scores stage-2 points', () => {
    const s = run(start(), { type: 'SKIP' }, { type: 'SKIP' }, { type: 'GUESS', text: 'Yesterday' });
    expect(s.score).toBe(250);
  });
  it('failing all four stages reveals a loss; endless loses a life', () => {
    const skips = Array(4).fill({ type: 'SKIP' });
    const c = run(start(), ...skips);
    expect(c.status).toBe('reveal');
    expect(c.outcome).toBe('lose');
    expect(c.results[0]).toEqual({ trackId: 1, stage: null, points: 0 });
    const e = run(start('endless'), ...skips);
    expect(e.lives).toBe(2);
  });
  it('ignores input while revealing', () => {
    const s = run(start(), { type: 'GUESS', text: 'yesterday' });
    expect(run(s, { type: 'SKIP' })).toBe(s);
  });
});

describe('BUY_HINT', () => {
  it('no-op when unaffordable', () => {
    const s = start();
    expect(run(s, { type: 'BUY_HINT', hint: 'year' })).toBe(s);
  });
  it('deducts cost once', () => {
    const won = run(start(), { type: 'GUESS', text: 'yesterday' }, { type: 'NEXT' });
    const h = run(won, { type: 'BUY_HINT', hint: 'year' }, { type: 'BUY_HINT', hint: 'year' });
    expect(h.score).toBe(900);
    expect(h.hintsUsed).toEqual(['year']);
  });
});

describe('NEXT', () => {
  it('advances and resets per-song state', () => {
    const s = run(start(), { type: 'SKIP' }, { type: 'GUESS', text: 'yesterday' }, { type: 'NEXT' });
    expect(s).toMatchObject({ index: 1, stage: 0, attempts: [], hintsUsed: [], status: 'playing', outcome: null });
  });
  it('challenge ends after the last song', () => {
    const s = run(
      start(),
      { type: 'GUESS', text: 'yesterday' }, { type: 'NEXT' },
      { type: 'GUESS', text: 'hey jude' }, { type: 'NEXT' }
    );
    expect(s.status).toBe('over');
  });
  it('endless ends at zero lives', () => {
    const one = mergeSettings({ endlessLives: 1 });
    const s = run(start('endless', one), ...Array(4).fill({ type: 'SKIP' }), { type: 'NEXT' });
    expect(s.status).toBe('over');
  });
  it('endless appends refill at the end of the queue', () => {
    let s = start('endless');
    s = { ...s, index: 2, status: 'reveal' };
    const n = run(s, { type: 'NEXT', refill: [{ id: 9, title: 'Help!', artist: 'The Beatles' }] });
    expect(n.index).toBe(3);
    expect(n.queue[3].id).toBe(9);
  });
});

describe('REPLACE_CURRENT', () => {
  it('swaps in a reserve track', () => {
    const s = run(start(), { type: 'REPLACE_CURRENT' });
    expect(s.queue[0].id).toBe(3);
    expect(s.reserve).toEqual([]);
  });
  it('drops the track when no reserve; ends if queue exhausted', () => {
    let s = run(start(), { type: 'REPLACE_CURRENT' }, { type: 'REPLACE_CURRENT' });
    expect(s.queue.map((t) => t.id)).toEqual([2]);
    s = run(s, { type: 'REPLACE_CURRENT' });
    expect(s.status).toBe('over');
  });
});
```

**Step 2:** Run `npx vitest run src/state`. Expected: FAIL.

**Step 3: Implement**

```js
// src/state/gameReducer.js
import { isCorrectGuess } from '../utils/fuzzyMatch.js';

export const initialGameState = Object.freeze({
  status: 'idle', // idle | playing | reveal | over
  mode: null, // challenge | endless
  settings: null,
  queue: [],
  reserve: [],
  index: 0,
  stage: 0,
  attempts: [],
  hintsUsed: [],
  score: 0,
  lives: 0,
  results: [],
  outcome: null, // win | lose
  poolTitles: [],
});

const freshSong = { stage: 0, attempts: [], hintsUsed: [], outcome: null };

function failOrAdvance(state) {
  if (state.stage < state.settings.stages.length - 1) {
    return { ...state, stage: state.stage + 1 };
  }
  const track = state.queue[state.index];
  return {
    ...state,
    status: 'reveal',
    outcome: 'lose',
    lives: state.mode === 'endless' ? state.lives - 1 : state.lives,
    results: [...state.results, { trackId: track.id, stage: null, points: 0 }],
  };
}

export function gameReducer(state, action) {
  switch (action.type) {
    case 'START': {
      const { mode, tracks, settings } = action;
      const len = mode === 'challenge' ? Math.min(settings.challengeLength, tracks.length) : tracks.length;
      return {
        ...initialGameState,
        status: tracks.length ? 'playing' : 'over',
        mode,
        settings,
        queue: tracks.slice(0, len),
        reserve: tracks.slice(len),
        lives: mode === 'endless' ? settings.endlessLives : 0,
        poolTitles: tracks.map((t) => t.title),
      };
    }
    case 'GUESS': {
      if (state.status !== 'playing') return state;
      const text = String(action.text ?? '').trim();
      if (!text) return state;
      const track = state.queue[state.index];
      const correct = isCorrectGuess(text, track.title, state.poolTitles);
      const attempts = [...state.attempts, { type: 'guess', text, correct }];
      if (!correct) return failOrAdvance({ ...state, attempts });
      const points = state.settings.stagePoints[state.stage] ?? 0;
      return {
        ...state,
        attempts,
        status: 'reveal',
        outcome: 'win',
        score: state.score + points,
        results: [...state.results, { trackId: track.id, stage: state.stage, points }],
      };
    }
    case 'SKIP': {
      if (state.status !== 'playing') return state;
      return failOrAdvance({ ...state, attempts: [...state.attempts, { type: 'skip' }] });
    }
    case 'BUY_HINT': {
      const cost = state.settings?.hintCosts?.[action.hint];
      if (
        state.status !== 'playing' ||
        cost == null ||
        state.hintsUsed.includes(action.hint) ||
        state.score < cost
      ) {
        return state;
      }
      return { ...state, score: state.score - cost, hintsUsed: [...state.hintsUsed, action.hint] };
    }
    case 'REPLACE_CURRENT': {
      if (state.status !== 'playing') return state;
      const queue = [...state.queue];
      if (state.reserve.length) {
        queue[state.index] = state.reserve[0];
        return { ...state, ...freshSong, queue, reserve: state.reserve.slice(1) };
      }
      queue.splice(state.index, 1);
      if (state.index >= queue.length) return { ...state, queue, status: 'over' };
      return { ...state, ...freshSong, queue };
    }
    case 'NEXT': {
      if (state.status !== 'reveal') return state;
      if (state.mode === 'endless' && state.lives <= 0) return { ...state, status: 'over' };
      let queue = state.queue;
      if (state.index + 1 >= queue.length) {
        if (state.mode === 'challenge' || !action.refill?.length) return { ...state, status: 'over' };
        queue = [...queue, ...action.refill];
      }
      return { ...state, ...freshSong, queue, index: state.index + 1, status: 'playing' };
    }
    case 'QUIT':
      return initialGameState;
    default:
      return state;
  }
}
```

**Step 4:** Run `npx vitest run src/state`. Expected: PASS.

**Step 5:** `git add src/state && git commit -m "feat: game reducer (stages, scoring, lives, hints)"`

---

### Task 7: StagePlayer (audio wrapper)

**Files:**
- Create: `src/audio/StagePlayer.js`
- Test: `src/audio/StagePlayer.test.js`

**Step 1: Failing test**

```js
// src/audio/StagePlayer.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StagePlayer } from './StagePlayer.js';

class FakeAudio {
  currentTime = 0; volume = 1; paused = true; ended = false; src = ''; preload = '';
  listeners = {};
  play = vi.fn(async () => { this.paused = false; });
  pause = vi.fn(() => { this.paused = true; });
  load = vi.fn();
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] || []).filter((x) => x !== f); }
  emit(t) { (this.listeners[t] || []).slice().forEach((f) => f()); }
}

let audio, frames, player;
const step = () => { const fs = frames; frames = []; fs.forEach((f) => f()); };

beforeEach(() => {
  audio = new FakeAudio();
  frames = [];
  player = new StagePlayer({
    audio,
    raf: (cb) => frames.push(cb),
    caf: () => { frames = []; },
    fadeMs: 40,
  });
  player.setVolume(1);
});

describe('StagePlayer', () => {
  it('load resolves on canplaythrough', async () => {
    const p = player.load('a.mp3');
    expect(audio.src).toBe('a.mp3');
    audio.emit('canplaythrough');
    await expect(p).resolves.toBeUndefined();
  });
  it('load rejects on error', async () => {
    const p = player.load('bad.mp3');
    audio.emit('error');
    await expect(p).rejects.toThrow('audio-error');
  });
  it('plays from 0 and stops exactly at the limit', async () => {
    const onEnd = vi.fn();
    player.onEnd = onEnd;
    audio.currentTime = 12;
    await player.play(0.5);
    expect(audio.currentTime).toBe(0);
    audio.currentTime = 0.3; step();
    expect(audio.pause).not.toHaveBeenCalled();
    audio.currentTime = 0.5; step();
    expect(audio.pause).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(frames).toHaveLength(0);
  });
  it('fades volume in the last 40ms', async () => {
    await player.play(1);
    audio.currentTime = 0.98; step();
    expect(audio.volume).toBeCloseTo(0.5, 2);
  });
  it('reports progress', async () => {
    const onProgress = vi.fn();
    player.onProgress = onProgress;
    await player.play(5);
    audio.currentTime = 2; step();
    expect(onProgress).toHaveBeenLastCalledWith(2, 5);
  });
  it('stop during a pending play leaves audio paused and no loop', async () => {
    let resolve;
    audio.play = vi.fn(() => new Promise((r) => { resolve = r; }));
    const p = player.play(5);
    player.stop();
    resolve();
    await p;
    expect(audio.pause).toHaveBeenCalled();
    expect(frames).toHaveLength(0);
  });
  it('restores volume after stop', async () => {
    await player.play(1);
    audio.currentTime = 0.99; step();
    player.stop();
    expect(audio.volume).toBe(1);
  });
});
```

**Step 2:** Run `npx vitest run src/audio`. Expected: FAIL.

**Step 3: Implement**

```js
// src/audio/StagePlayer.js
/**
 * Plays a preview from 0:00 up to a stage limit, fading out over the last
 * `fadeMs` to avoid a click, then pausing. One instance per page.
 * Note: iOS ignores audio.volume, so the fade is a no-op there; the cut is still clean.
 */
export class StagePlayer {
  constructor({ audio, raf, caf, fadeMs = 40, loadTimeoutMs = 10000 } = {}) {
    this.audio = audio ?? new Audio();
    this.audio.preload = 'auto';
    this.raf = raf ?? ((cb) => requestAnimationFrame(cb));
    this.caf = caf ?? ((id) => cancelAnimationFrame(id));
    this.fade = fadeMs / 1000;
    this.loadTimeoutMs = loadTimeoutMs;
    this.volume = 0.8;
    this.limit = 0;
    this.frame = null;
    this.token = 0;
    this.playing = false;
    this.onProgress = null;
    this.onEnd = null;
  }

  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, v));
    if (!this.playing) this.audio.volume = this.volume;
  }

  load(url) {
    this.stop();
    const a = this.audio;
    return new Promise((resolve, reject) => {
      let timer;
      const finish = (fn, arg) => {
        clearTimeout(timer);
        a.removeEventListener('canplaythrough', ok);
        a.removeEventListener('error', bad);
        fn(arg);
      };
      const ok = () => finish(resolve);
      const bad = () => finish(reject, new Error('audio-error'));
      timer = setTimeout(() => finish(reject, new Error('audio-timeout')), this.loadTimeoutMs);
      a.addEventListener('canplaythrough', ok);
      a.addEventListener('error', bad);
      a.src = url;
      a.load();
    });
  }

  async play(limit) {
    this.stop();
    const token = this.token;
    this.limit = limit;
    this.audio.currentTime = 0;
    this.audio.volume = this.volume;
    try {
      await this.audio.play();
    } catch (err) {
      if (token === this.token) throw err;
      return;
    }
    if (token !== this.token) {
      this.audio.pause();
      return;
    }
    this.playing = true;
    this.#tick(token);
  }

  #tick(token) {
    this.frame = this.raf(() => {
      if (token !== this.token) return;
      const t = this.audio.currentTime;
      const remaining = this.limit - t;
      this.onProgress?.(Math.min(t, this.limit), this.limit);
      if (remaining <= 0 || this.audio.ended) {
        this.stop();
        this.onEnd?.();
        return;
      }
      this.audio.volume = remaining < this.fade ? this.volume * (remaining / this.fade) : this.volume;
      this.#tick(token);
    });
  }

  stop() {
    this.token++;
    if (this.frame != null) this.caf(this.frame);
    this.frame = null;
    this.audio.pause();
    this.audio.volume = this.volume;
    this.playing = false;
  }

  destroy() {
    this.stop();
    this.audio.removeAttribute?.('src');
    this.onEnd = this.onProgress = null;
  }
}
```

Check the fade test: limit 1 and t = 0.98 leave remaining = 0.02, so volume = 1 × 0.02 / 0.04 = 0.5. ✓

**Step 4:** Run `npx vitest run src/audio`. Expected: PASS.

**Step 5:** `git add src/audio && git commit -m "feat: StagePlayer with clean stage cutoff"`

---

### Task 8: iTunes service

**Files:**
- Create: `src/services/itunes.js`, `src/utils/throttle.js`
- Test: `src/services/itunes.test.js`

**Step 1: Failing test**

```js
// src/services/itunes.test.js
import { describe, it, expect, vi } from 'vitest';
import {
  searchUrl, lookupUrl, toTrack, getJson, HttpError, pickBestMatch, lookupTracks,
} from './itunes.js';

const raw = (o = {}) => ({
  wrapperType: 'track', kind: 'song', trackId: 1, trackName: 'Yesterday',
  artistName: 'The Beatles', collectionName: 'Help!',
  artworkUrl100: 'https://x/100x100bb.jpg', previewUrl: 'https://p/1.m4a',
  releaseDate: '1965-08-06T07:00:00Z', primaryGenreName: 'Rock', ...o,
});

describe('urls', () => {
  it('builds search and lookup urls', () => {
    expect(searchUrl('hey jude', { country: 'ES', limit: 5 })).toBe(
      'https://itunes.apple.com/search?term=hey+jude&media=music&entity=song&limit=5&country=ES'
    );
    expect(lookupUrl([1, 2], { country: 'US' })).toBe(
      'https://itunes.apple.com/lookup?id=1%2C2&country=US'
    );
  });
});

describe('toTrack', () => {
  it('maps a song result', () => {
    expect(toTrack(raw())).toEqual({
      id: 1, title: 'Yesterday', artist: 'The Beatles', album: 'Help!',
      artwork: 'https://x/600x600bb.jpg', previewUrl: 'https://p/1.m4a', year: 1965, genre: 'Rock',
    });
  });
  it('drops results without a preview or non-songs', () => {
    expect(toTrack(raw({ previewUrl: undefined }))).toBeNull();
    expect(toTrack(raw({ kind: 'music-video' }))).toBeNull();
  });
});

describe('getJson', () => {
  it('uses fetch when it works', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ a: 1 }) }));
    const jsonpImpl = vi.fn();
    await expect(getJson('u', { fetchImpl, jsonpImpl })).resolves.toEqual({ a: 1 });
    expect(jsonpImpl).not.toHaveBeenCalled();
  });
  it('falls back to JSONP on network/CORS failure', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const jsonpImpl = vi.fn(async () => ({ b: 2 }));
    await expect(getJson('u', { fetchImpl, jsonpImpl })).resolves.toEqual({ b: 2 });
  });
  it('surfaces HTTP errors (e.g. 403 rate limit) without fallback', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 403 }));
    const jsonpImpl = vi.fn();
    await expect(getJson('u', { fetchImpl, jsonpImpl })).rejects.toBeInstanceOf(HttpError);
    expect(jsonpImpl).not.toHaveBeenCalled();
  });
});

describe('pickBestMatch', () => {
  const tracks = [
    toTrack(raw({ trackId: 1, trackName: 'Yesterday (Remastered 2009)', artistName: 'The Beatles' })),
    toTrack(raw({ trackId: 2, trackName: 'Yesterday', artistName: 'Some Cover Band' })),
  ];
  it('prefers title+artist agreement', () => {
    expect(pickBestMatch(tracks, { title: 'Yesterday', artist: 'The Beatles' }).id).toBe(1);
  });
  it('returns null when nothing is close', () => {
    expect(pickBestMatch(tracks, { title: 'Bohemian Rhapsody', artist: 'Queen' })).toBeNull();
  });
});

describe('lookupTracks', () => {
  it('chunks ids and returns a Map by id', async () => {
    const getJsonImpl = vi.fn(async (url) => {
      const ids = new URL(url).searchParams.get('id').split(',').map(Number);
      return { results: ids.map((id) => raw({ trackId: id })) };
    });
    const ids = Array.from({ length: 160 }, (_, i) => i + 1);
    const map = await lookupTracks(ids, { country: 'US', chunk: 150, getJsonImpl });
    expect(getJsonImpl).toHaveBeenCalledTimes(2);
    expect(map.size).toBe(160);
    expect(map.get(42).id).toBe(42);
  });
});
```

**Step 2:** Run `npx vitest run src/services/itunes.test.js`. Expected: FAIL.

**Step 3: Implement**

```js
// src/utils/throttle.js
/** Serializes async calls with at least `minIntervalMs` between starts. */
export function createThrottle(minIntervalMs, now = () => Date.now(), wait = (ms) => new Promise((r) => setTimeout(r, ms))) {
  let last = -Infinity;
  let chain = Promise.resolve();
  return (fn) => {
    const run = chain.then(async () => {
      const delay = last + minIntervalMs - now();
      if (delay > 0) await wait(delay);
      last = now();
      return fn();
    });
    chain = run.catch(() => {});
    return run;
  };
}
```

```js
// src/services/itunes.js
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
```

Check the lookup URL expectation: `URLSearchParams` encodes `,` as `%2C`. The test expects `id=1%2C2`. ✓

**Step 4:** Run `npx vitest run src/services/itunes.test.js`. Expected: PASS.

**Step 5:** `git add src/services/itunes.* src/utils/throttle.js && git commit -m "feat: iTunes client with JSONP fallback, batch lookup, best-match"`

---

### Task 9: Playlists — import parsing, custom CRUD, track loading

**Files:**
- Create: `src/services/playlists.js`
- Test: `src/services/playlists.test.js`

**Step 1: Failing test**

```js
// src/services/playlists.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseImport, ImportError, listCustom, saveCustom, deleteCustom, loadPlaylistTracks,
} from './playlists.js';

beforeEach(() => localStorage.clear());

describe('parseImport', () => {
  it('parses the JSON object form', () => {
    const r = parseImport('{"name":"Mine","tracks":[{"title":"Yesterday","artist":"The Beatles"}]}');
    expect(r).toEqual({ name: 'Mine', tracks: [{ title: 'Yesterday', artist: 'The Beatles' }] });
  });
  it('parses a bare JSON array and keeps numeric ids', () => {
    const r = parseImport('[{"title":"A","artist":"B","id":5}]');
    expect(r.tracks).toEqual([{ title: 'A', artist: 'B', id: 5 }]);
  });
  it('parses "Title - Artist" lines, skipping blanks and # comments', () => {
    const r = parseImport('# my list\nYesterday - The Beatles\n\nHey Jude – The Beatles');
    expect(r.tracks).toEqual([
      { title: 'Yesterday', artist: 'The Beatles' },
      { title: 'Hey Jude', artist: 'The Beatles' },
    ]);
  });
  it('reports the line number of a bad text line', () => {
    expect(() => parseImport('Yesterday - The Beatles\nno separator here')).toThrow(/line 2/);
  });
  it('reports the index of a bad JSON track', () => {
    expect(() => parseImport('{"tracks":[{"title":"A","artist":"B"},{"title":""}]}')).toThrow(/track 2/);
  });
  it('rejects empty input and malformed JSON', () => {
    expect(() => parseImport('   ')).toThrow(ImportError);
    expect(() => parseImport('{"tracks": [')).toThrow(/JSON/);
  });
});

describe('custom playlist CRUD', () => {
  it('saves, lists and deletes', () => {
    const p = saveCustom({ name: 'X', tracks: [] });
    expect(p.id).toMatch(/^c_/);
    expect(listCustom()).toHaveLength(1);
    saveCustom({ ...p, name: 'Y' });
    expect(listCustom()[0].name).toBe('Y');
    deleteCustom(p.id);
    expect(listCustom()).toEqual([]);
  });
});

describe('loadPlaylistTracks', () => {
  it('looks up ids in one batch and resolves id-less tracks by title', async () => {
    const lookup = vi.fn(async (ids) => new Map(ids.map((id) => [id, { id, title: `T${id}`, artist: 'A', previewUrl: 'p' }])));
    const resolve = vi.fn(async () => ({ id: 99, title: 'New', artist: 'A', previewUrl: 'p' }));
    const onProgress = vi.fn();
    const { tracks, resolvedIds } = await loadPlaylistTracks(
      { tracks: [{ id: 1, title: 'T1', artist: 'A' }, { title: 'New', artist: 'A' }] },
      { country: 'US', lookup, resolve, onProgress }
    );
    expect(lookup).toHaveBeenCalledWith([1], expect.anything());
    expect(tracks.map((t) => t.id)).toEqual([1, 99]);
    expect(resolvedIds).toEqual([1, 99]);
    expect(onProgress).toHaveBeenLastCalledWith(2, 2);
  });
});
```

**Step 2:** Run `npx vitest run src/services/playlists.test.js`. Expected: FAIL.

**Step 3: Implement**

```js
// src/services/playlists.js
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
```

**Step 4:** Run `npx vitest run src/services/playlists.test.js`. Expected: PASS. Then run the whole suite with `npm test`. Expected: all green.

**Step 5:** `git add src/services/playlists.* && git commit -m "feat: playlist import parsing, custom CRUD, track loading"`

---

### Task 10: Seed playlists (dev-time resolution script + data)

**Files:**
- Create: `scripts/build-seeds.mjs`, `scripts/seeds/*.txt` (one per playlist), `src/data/seedPlaylists.json` (generated)

**Step 1: Author seed text files.** Write one file per category. Each file has a header, then 50 well-known, clearly recognizable songs as `Title - Artist`:

```
# id: 80s
# code: A3
# name: The 80s
# color: pink
Billie Jean - Michael Jackson
Take On Me - a-ha
...
```

| id | code | name | color band |
|---|---|---|---|
| pop | A1 | Pop Hits | pink |
| rock | A2 | Rock Classics | red |
| 70s | A3 | The 70s | amber |
| 80s | A4 | The 80s | pink |
| 90s | B1 | The 90s | cyan |
| 2000s | B2 | The 2000s | cyan |
| 2010s | B3 | The 2010s | pink |
| hiphop | B4 | Hip-Hop | amber |
| dance | C1 | Dance & Electronic | cyan |
| latin | C2 | Latin Hits | amber |

Pick songs whose titles are recognizable and distinct. Avoid near-duplicate titles inside one list, and avoid songs best known only by a remix.

**Step 2: Write `scripts/build-seeds.mjs`**

```js
// Resolves scripts/seeds/*.txt to iTunes track IDs → src/data/seedPlaylists.json
// Usage: npm run seeds   (≈3s per uncached song; cache in scripts/.seed-cache.json)
import { readFile, writeFile, readdir } from 'node:fs/promises';
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
await writeFile(OUT, JSON.stringify(playlists, null, 2) + '\n');
console.log(`Wrote ${OUT.pathname}`);
```

**Step 3: Run it.** Run `npm run seeds`. Expect about 25 minutes for 500 songs on the first run. Use `run_in_background`; the run is resumable from its cache.
Expected: each playlist logs 45 or more tracks. For every `✗ no match` line, fix the spelling in the `.txt` file or swap in another song, then rerun. Cached songs are skipped.

**Step 4: Verify** that `src/data/seedPlaylists.json` exists, that each of the 10 playlists has at least 40 tracks, and that all ids are integers.

**Step 5: Commit**

```bash
git add scripts src/data
git commit -m "feat: curated seed playlists resolved to iTunes ids"
```

---

### Task 11: Visual system — direction contract, tokens, fonts, global styles

**Before editing:** read Impeccable's `reference/craft-floor.md` from the impeccable skill directory. Write the surface brief's `## Direction contract` with the impeccable `surface-brief write` command, covering:
- THESIS / OWN-WORLD / STORY / FIRST VIEWPORT / FORM: "cabinet with a jukebox inside", from the design doc §3
- `seed: none (brief-pinned direction)`
- the verbatim FINISH line

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`, `src/styles/fonts.css`, `public/favicon.svg`
- Modify: `src/main.jsx` (import styles)

**Tokens (`tokens.css`):**
- Ground `--bg: #0f051d`. Raised surfaces are two steps lighter and violet-tinted, e.g. `--bg-2: #1a0b30` and `--bg-3: #26113f`.
- Roles:
  - `--pink` (player action, ≈`#ff2e97`)
  - `--cyan` (audio/progress, ≈`#20e3ff`)
  - `--amber` (points, ≈`#ffb627`)
  - `--red` (miss/lives, ≈`#ff3b3b`)
  - `--ink` (≈`#f4ecff`) and `--ink-dim` (≈`#a99bc4`)
- Each role gets a `-glow` variant as a `box-shadow`/`text-shadow` stack (tight core plus soft halo). Glows go on interactive or "lit" elements only, never on body text.
- Type scale with `clamp()`, readable from across a room on a 1080p TV at 3m: the play-screen score sits at a minimum of about 32px on phones and about 72px on large screens.
- Spacing scale (4-based), radii (`--r-pill`, `--r-strip: 6px`), and motion tokens: `--t-fast: 120ms`, `--t-med: 240ms`, plus `--ease-press`.

**Fonts (`fonts.css`):** import the `@fontsource` packages for Monoton, Bungee and Barlow Semi Condensed (400, 600). Add an `@font-face` for DSEG7 Classic Bold from `node_modules/dseg/fonts/` (check the exact path after install with `ls node_modules/dseg/fonts`). Set `font-display: swap` throughout.

**Global (`global.css`):**
- `html, body` background `--bg` and color `--ink`
- `body` font Barlow Semi Condensed
- one faint scanline overlay on `body::after` (`repeating-linear-gradient`, ≤4% opacity, `pointer-events: none`)
- focus-visible ring in cyan
- `@media (prefers-reduced-motion: reduce)` disables flicker, shake and confetti

**Acceptance:** `npm run dev` shows the correct ground color and fonts loading from the dev server only. The Network tab shows no Google Fonts host.

**Commit:** `git commit -m "feat: neon cabinet design tokens, fonts, global styles"`

---

### Task 12: Primitive components

**Files** (each `.jsx` has a sibling `.module.css`):
- `src/components/ArcadeButton.jsx`
  - `({ variant: 'pink'|'cyan'|'amber', size: 'xl'|'md'|'sm', icon?, children, ...buttonProps })`
  - A round or pill arcade button with a concave top.
  - On `:active` it presses: the inset shadow deepens and it moves `translateY(1px)`.
  - Disabled reads as unlit: no glow, dim ink.
- `src/components/Marquee.jsx`
  - `({ flash })`
  - "HEDGEGUESSER" in Monoton, pink tube with a cyan outline. An irregular flicker keyframe runs on 2–3 letters.
  - `flash` triggers a 600ms full-brightness pulse.
- `src/components/SegmentScore.jsx`
  - `({ value, digits = 6, label })`
  - DSEG7 amber digits over dim "8888" ghost segments.
  - Rolls up from the previous value over 600ms with rAF; instant under reduced motion.
- `src/components/LedPips.jsx`: `({ total, lit, color })`. Lives use red.
- `src/components/TitleStrip.jsx`
  - `({ code, name, count, color, selected, status, onToggle })`
  - A jukebox title card: code badge left, name, song count, color band.
  - `selected` lights it. `status` shows "resolving 12/50" or "unavailable".
  - Rendered as a `button` with `aria-pressed`.

**Acceptance:** add a temporary `#/kit` route that shows every component in every state. Inspect it at 390px and 1440px, then remove the route before committing.

**Commit:** `git commit -m "feat: arcade primitives (button, marquee, segment score, pips, title strip)"`

---

### Task 13: App shell, routing, settings context

**Files:**
- Create: `src/state/useHashRoute.js`, `src/state/SettingsContext.jsx`
- Modify: `src/App.jsx`

**Routing:**
- `useHashRoute()` returns `{ path, params, navigate }`, parsed from `location.hash`.
- Routes: `#/` (home), `#/play`, `#/game`, `#/scores`, `#/playlists`, `#/playlists/:id`, `#/settings`. Unknown routes go to `#/`.
- Hash routing keeps GitHub Pages deep links working with no 404 setup.

**Settings:** `SettingsContext` holds `[settings, updateSettings]`. It's initialized with `mergeSettings(load('settings'))` and persists through `save('settings', …)` on change.

**App:**
- `App` renders `<SettingsProvider><GameProvider>…</GameProvider></SettingsProvider>` and the routed screen.
- Screen changes cross-fade over `--t-med`.

**Commit:** `git commit -m "feat: hash routing and settings context"`

---

### Task 14: Home (attract mode) and Play setup (jukebox)

**Files:**
- `src/screens/Home.jsx`
- `src/screens/PlaySetup.jsx`
- `src/services/catalog.js`: `getAllPlaylists()` merges seed JSON and custom playlists into a common shape `{ id, code, name, color, tracks, custom }`. Custom codes are `D1…`.

**Home:**
- Marquee at the top.
- A big **PRESS START** pink arcade button that goes to `#/play`.
- Below it, the "attract" panel cycles every 4s between the Challenge and Endless top-10 tables (static under reduced motion).
- Secondary buttons: PLAYLISTS, HIGH SCORES, SETTINGS.

**PlaySetup:**
1. A mode toggle with two large cards: **20-SONG CHALLENGE** and **ENDLESS (♥♥♥)**. Each card states its rule in one line.
2. A jukebox grid of `TitleStrip`s grouped into "House selection" (seed) and "Your playlists" (custom). Multi-select is allowed. The total songs selected are shown live.
3. An **INSERT COIN → START** button, enabled once at least one playlist is selected.
   - On start it calls `game.start({ mode, playlistIds })` and goes to `#/game`.
   - If fewer than 20 songs are selected in Challenge, show the line "Short run: N songs".

**Commit:** `git commit -m "feat: attract-mode home and jukebox play setup"`

---

### Task 15: Game provider (wires reducer + StagePlayer + loading)

**Files:**
- Create: `src/state/GameContext.jsx`, `src/utils/shuffle.js` (Fisher–Yates, with a test in `src/utils/shuffle.test.js` checking it's a permutation and doesn't mutate the input)

**GameProvider exposes:**

```
{ state, phase, error, loadProgress, progress, isPlaying,
  start({mode, playlistIds}), play(), guess(text), skip(), buyHint(type), next(), quit() }
```

- **`phase`:** `'idle' | 'loading' | 'ready' | 'error'`. This is the async status around the reducer's `state.status`.
- **`start`:**
  - Load each playlist via `loadPlaylistTracks(..., { useCache: true, onProgress })`, dedupe by id and shuffle.
  - If there are fewer than `minPlayableSongs` tracks, set `error = 'not-enough'`.
  - On a network error, set `error = 'offline'` (renders OUT OF ORDER).
  - For custom playlists that just got ids resolved, persist the ids with `saveCustom`.
  - Then dispatch `START`.
- **Current track changes:** `player.load(track.previewUrl)`, then `phase = 'ready'`. A failure dispatches `REPLACE_CURRENT`. Also prefetch the next track with `new Audio(url)` set to `preload='auto'`.
- **`play()`:** `player.play(settings.stages[state.stage])`. `progress` is `{ t, limit }`, updated from `player.onProgress`.
- **On reveal:** auto-play the full preview with `player.play(30)`.
- **`next()`:** in endless mode, at the last track, pass `refill` = the shuffled pool minus the last 5 played. Calling `next()` stops the player.
- **`guess` / `skip` / `buyHint`:** they dispatch. `guess` and `skip` stop the player first.
- **Cleanup:** `player.destroy()` on unmount. The volume follows settings.

**Commit:** `git commit -m "feat: game provider wiring audio, loading and refill"`

---

### Task 16: Game screen

**Files:**
- `src/screens/Game.jsx`
- `src/components/Equalizer.jsx`
- `src/components/StageLadder.jsx`
- `src/components/GuessInput.jsx`
- `src/components/AttemptLog.jsx`
- `src/components/HintPanel.jsx`

**Layout (single column, max-width ~720px, centered):**
1. **Status strip:** mode label · round "07 / 20" (Endless shows "SONG 7") · `LedPips` lives (Endless only) · `SegmentScore`.
2. **CRT window:** `Equalizer`, 16–24 cyan LED bars.
   - While playing, the bars bounce on pseudo-random targets seeded per track, eased each frame and scaled by `progress`.
   - When idle, the bars sit low and dim.
   - It's a `canvas` or CSS transforms, aria-hidden.
3. **`StageLadder`:**
   - Four segments with flex-grow proportional to their stage durations. Stage 1 gets a minimum visual width so 0.5s stays tappable and visible.
   - Locked segments are dark. The current stage is lit cyan. Used stages are dim with a red tick for a miss or skip.
   - A playhead line sweeps across using `progress`.
   - Labels below: `0.5s · 5s · 15s · 30s`, taken from settings.
4. **Play:** one `ArcadeButton size="xl"` in pink. Its label is "PLAY 0.5s", using the current limit, and it shows a stop square while playing. It's disabled with a "LOADING…" label until `phase==='ready'`.
5. **`GuessInput`:**
   - Text input with a combobox listbox (ARIA 1.2 combobox pattern).
   - Suggestions: pool titles (deduped by normalized title) that contain or fuzzy-start-with the typed text, max 6, shown after 2 characters.
   - Arrow keys and Enter select. Enter with no highlight submits the raw text. A submit arrow button sits inside the field.
   - The input clears after a guess.
6. **Secondary row:** SKIP (+N s, cyan sm) and HINT (amber sm, opens `HintPanel`).
7. **`AttemptLog`:** four rows. A missed guess shows a red "MISS" stamp and the text; a skip shows "SKIPPED"; empty rows are dim dashes. A new row shakes the strip by 6px for 300ms (disabled under reduced motion).
8. **`HintPanel`:**
   - Four hint tiles with name and cost in amber. A tile is disabled when unaffordable or used.
   - A bought hint flips to show its `hintText`. Hints stay visible for the rest of the song.

**Keyboard:**
- Space plays (when focus isn't in the input).
- Enter guesses.
- `Ctrl+→` skips.

**Phone:** the play button and input sit in the lower half of the screen within thumb reach. The status strip stays compact at the top.

**Room scale:** at ≥1200px the whole column scales with clamp tokens. The score and ladder labels must be readable at 3m.

**Commit:** `git commit -m "feat: game screen (equalizer, stage ladder, guess input, hints)"`

---

### Task 17: Reveal and confetti

**Files:** `src/components/Reveal.jsx`, `src/components/Confetti.jsx`

**Reveal (`state.status === 'reveal'`):** replaces the input area in place, without a modal.
- 600×600 artwork in a CRT-style bezel, plus title, artist and year.
- **Win:** "+1000" in amber rolls into the score, the Marquee flashes, and `Confetti` fires.
- **Lose:** "THE SONG WAS…" in red. Endless also shows a "−1 ♥" pip animation.
- A **NEXT ▸** pink button (Enter works too). The last song shows **RESULTS ▸** instead.

**Confetti:** a canvas overlay of about 120 square "pixels" in pink, cyan and amber over 1.2s, using gravity and drift. It removes itself when done and is skipped under reduced motion.

**Commit:** `git commit -m "feat: reveal panel and pixel confetti"`

---

### Task 18: Results, initials entry, high scores

**Files:** `src/screens/Results.jsx`, `src/components/InitialsEntry.jsx`, `src/screens/HighScores.jsx`, `src/services/scores.js` (load/save per mode via `readTable`/`insertScore`)

**Results (`state.status === 'over'`):**
- "GAME OVER" in the marquee style, the final score, and stats: songs guessed, average stage, best streak.
- If `qualifies`, show `InitialsEntry`:
  - three letter slots, arcade style
  - ↑/↓ cycles A–Z0–9, ←/→ moves between slots, and typing works too
  - on phone, a plain text input with `maxLength=3`
  - ENTER saves the score and goes to HighScores with the new row highlighted
- Buttons: PLAY AGAIN (same setup), HOME.

**HighScores:** tabs for Challenge and Endless, each showing a top-10 table of rank, initials, score and date.

**Commit:** `git commit -m "feat: results, arcade initials entry, high-score tables"`

---

### Task 19: Playlist editor (search, add, import)

**Files:** `src/screens/Playlists.jsx` (list), `src/screens/PlaylistEditor.jsx`, `src/components/TrackRow.jsx`

**List screen:**
- The player's playlists as `TitleStrip`s, plus a **+ NEW PLAYLIST** button and an **IMPORT** button.
- Seed playlists can't be edited, but they can be duplicated into a custom copy.

**Editor:**
- Editable name.
- Search box: debounced 400ms, calls `searchTracks`, shows up to 15 results as `TrackRow`s (art thumb, title, artist, year, and a ▶ 3s preview button).
- **+ ADD** puts the result's `{id,title,artist}` into the playlist.
- The current tracks are listed below with remove buttons and a count.
- Changes autosave via `saveCustom` and confirm with a quiet "Saved" indicator.
- Delete playlist asks for confirmation inline.
- Search errors: a 403 shows "iTunes is busy — try again in a minute"; offline shows "Can't reach iTunes".

**Import dialog:**
- A textarea with the format hint (example JSON and example lines). PARSE runs `parseImport`, and an error appears inline under the field with the line or track number.
- After a successful parse, the tracks preview, then SAVE stores the playlist.
- Id-less tracks resolve the first time the playlist is played. Tell the user "N songs will be matched on first play".

**Commit:** `git commit -m "feat: custom playlist editor with search and import"`

---

### Task 20: Settings, error states, empty states

**Files:** `src/screens/Settings.jsx`, `src/components/OutOfOrder.jsx`

**Settings:**
- Stage durations: four number inputs (seconds, step 0.5). They validate live with `validStages` and show an inline error.
- Stage points: four inputs. Lives: 1–9. Challenge length: 1–50.
- Hint costs: four inputs. Volume: a slider, with a test-tone-free preview using the last track.
- iTunes country: a select of common two-letter country codes.
- **RESET DEFAULTS**, and **RESET ALL DATA** behind a two-step confirm that calls `clearAll()`.

**OutOfOrder:**
- A cabinet "OUT OF ORDER" sign (amber tape style).
- The message names the cause: offline, iTunes busy, or not enough playable songs.
- RETRY and BACK buttons.

**Empty states:**
- No custom playlists: "No playlists yet — build one by searching, or paste a list."
- No high scores: the attract panel shows "No scores yet — be the first."

**Commit:** `git commit -m "feat: settings screen and error/empty states"`

---

### Task 21: Deploy workflow and README

**Files:** `.github/workflows/deploy.yml`, `README.md`

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

`README.md` covers:
- what the game is
- `npm install`, `npm run dev`, `npm test` and `npm run build`
- how to rebuild seeds (`npm run seeds`)
- the import formats
- where to change stage timings (`src/config/gameConfig.js` or the Settings screen)
- Pages setup: Settings → Pages → Source: GitHub Actions

**Verify:** `npm run build` succeeds. `npx vite preview` serves `dist/`, and the app works under a sub-path (open `http://localhost:4173/`; relative asset URLs confirm `base: './'`).

**Commit:** `git commit -m "chore: GitHub Pages workflow and README"`

---

### Task 22: Verification and design finish

1. `npm test`: all green.
2. Play through in the built-in browser at 390×844 (phone) and 1440×900 (desktop/TV):
   - a full Challenge run (short playlist OK)
   - an Endless run to game over
   - each hint
   - typo guesses and wrong-song guesses
   - Skip to stage 4
   - initials entry
   - creating a playlist via search and importing via both formats
   - settings changes taking effect, including custom stage durations
   - going offline (DevTools) to see OUT OF ORDER
3. Confirm the 0.5s stage cuts cleanly with no audible click or overrun beyond one frame. Check `onProgress`'s final `t` in the console.
4. Run the Impeccable detector: `impeccable detect --json src`. Fix the mechanical findings.
5. Capture `.impeccable/review/desktop.png` and `mobile.png`. Spawn `impeccable-finish-reviewer` with the direction contract and screenshots, then act on its disposition.
6. Spawn `impeccable-documenter` to write `DESIGN.md` and `.impeccable/design.json` from the built world.
7. Final commit: `git commit -m "docs: DESIGN.md from finished build"`

**Not in this plan (user step):** creating the GitHub repo under the Donshorti account and pushing. Do this only when the user says so.
