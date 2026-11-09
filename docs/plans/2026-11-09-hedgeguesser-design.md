# HedgeGuesser — Design

Date: 2026-11-09
Status: Approved (brainstorming)

A Heardle-style song-guessing game. Fully static Vite + React app deployed to GitHub Pages. Product context lives in `PRODUCT.md`.

## 1. Architecture

Vite + React with built-in hooks (`useReducer` + context). No state library. Game logic (matching, scoring, stage progression) lives in framework-free modules that are unit-tested with Vitest.

```
src/
  config/        gameConfig.js        stages [0.5,5,15,30], points, lives, hint costs
  data/          seedPlaylists.json   curated "Title — Artist" lists per genre/decade
  services/      itunes.js            search, fetch with JSONP fallback, result cache
                 storage.js           localStorage, versioned keys (hg:v1:*), safe reset
  audio/         StagePlayer.js       HTML5 audio wrapper, cuts off at stage limit
  utils/         fuzzyMatch.js, normalize.js, shuffle.js, scoring.js
  state/         gameReducer.js, GameContext.jsx
  components/    Marquee, Equalizer, StageLadder, ArcadeButton, GuessInput,
                 AttemptLog, HintPanel, SegmentScore, Confetti, TitleStrip…
  screens/       Home (attract), PlaylistPicker (jukebox), Game, Reveal, Results,
                 InitialsEntry, HighScores, PlaylistEditor, Settings
  styles/        tokens.css, global.css, component CSS modules
.github/workflows/deploy.yml   build + publish to Pages on push to main
vite.config.js                  base: './'
```

**Data flow:** the player picks a mode and one or more playlists, and each playlist's songs are resolved:
- **Seed playlist:** each "Title — Artist" pair is searched on iTunes (`entity=song`, `limit` small). The best match by title/artist similarity that has a `previewUrl` wins. Results are cached in localStorage so later runs need no network.
- **Custom playlist:** stores the resolved track objects directly.

The resolved songs are shuffled into a queue. Each song's audio is fully preloaded (`canplaythrough`) before Play is enabled.

**Technical calls**
- **iTunes fetch:** `fetch` first, JSONP (`&callback=`) fallback, because CORS headers on the iTunes API have been inconsistent.
- **Equalizer:** animated from player state and playhead, not Web Audio analysis. Cross-origin previews fed into an AnalyserNode can be muted by CORS.
- **StagePlayer:**
  - plays from 0 and watches `currentTime` on a `requestAnimationFrame` loop
  - starts a ~40 ms volume fade just before the limit, then pauses and rewinds
  - exposes `play(limit)`, `stop()`, `onProgress`, `onEnd`
  - guards against overlapping play calls

## 2. Gameplay

**Round:** four attempts, one per stage. Play replays from 0:00 to the current stage limit. A wrong guess or Skip unlocks the next stage, and wrong guesses are listed in the attempt log. A correct guess, or failing stage 4, leads to the Reveal: art, title, artist, year, and the full preview until the player presses Next.

**Scoring** (all values in `gameConfig.js` and editable in Settings):
- Points by stage: 1000 / 500 / 250 / 100.
- **Challenge:** 20 songs. If the selection has fewer playable songs, the run is shortened and the start screen says so.
- **Endless:** 3 lives, a failed song costs one, and the run ends at zero lives.
- **High scores:** top 10 per mode, saved with three-letter initials.

**Hints** cost points:

| Hint | Cost |
|---|---|
| Release year | 100 |
| Genre | 100 |
| Artist initials | 200 |
| First letter of title | 300 |

A hint can't be bought if the player can't afford it.

**Matching** (title required; artist alone never counts):
- Normalize both sides:
  - lowercase, strip accents and punctuation
  - drop bracketed or parenthesized suffixes, " - Live/Remaster…" tails, and "feat./ft." clauses
  - `&`→`and`, ignore a leading "the", collapse whitespace
- If the guess contains " - ", only the part before it is checked as the title.
- **Accept** on an exact match after normalizing, or when the edit distance stays within the limit:
  - 1 for titles of 5 characters or fewer
  - 2 for titles of 6–12 characters
  - `floor(0.15 × length)` for longer titles
- **Reject** guesses under 3 characters unless the title itself is that short.
- **Autocomplete** suggests titles from the active pool. A picked suggestion goes through the same check.

## 3. Visual direction — "the cabinet"

The world is pinned by the brief: neon retro arcade, ground `#0f051d`, neon pink and cyan glows. It's rendered as a coin-op cabinet with a jukebox inside.

- **Marquee:** "HEDGEGUESSER" in neon-tube lettering (Monoton) with an irregular flicker, disabled under `prefers-reduced-motion`.
- **Attract mode (Home):** cycles the high-score table. The primary action is PRESS START.
- **Jukebox selector:** each playlist is a title strip with a code (A1, B4…), song count and genre color band. Custom playlists get their own row. Seed strips show a resolve counter while loading.
- **Play screen,** top to bottom:
  1. Status strip: round, lives as LED pips, score in amber 7-segment digits that roll up.
  2. CRT window with the LED spectrum equalizer.
  3. Stage ladder: four LED segments with widths proportional to their durations. They light as stages unlock, and a playhead sweeps while audio plays.
  4. The huge round Play arcade button.
  5. Guess field with autocomplete. Skip and Hint as smaller arcade buttons.
- **Color roles:**
  - pink: player actions
  - cyan: audio and progress
  - amber: points and score
  - red: misses and lives
- **Type:**
  - Monoton: logo only
  - Bungee: buttons and headings
  - Barlow Semi Condensed: body and inputs
  - DSEG7: score digits
  - All self-hosted via npm (`@fontsource/*`, `dseg`).
- **Feel:**
  - buttons press down physically (inset shadow plus a 1px drop)
  - a correct guess flashes the marquee, rolls up the score and bursts pixel-square confetti
  - a wrong guess stamps MISS on the attempt row with a short shake
  - scanlines are a faint overlay and never reduce text contrast
- **Layout:** one column built around the Play button. On phones, controls are thumb-reachable at the bottom. On laptop/TV, the same layout scales with `clamp()` type so a room can read it.

## 4. Errors, testing, deploy

**Errors**
- **No preview or a broken MP3:** the song is skipped and replaced from the pool.
- **iTunes unreachable:** an OUT OF ORDER screen with Retry. Cached songs still play.
- **Seed playlist:** playable once 8 or more songs resolve.
- **Import:** JSON or track-list text is validated, with an inline error that names the problem. Nothing is saved until it parses.
- **Storage:** versioned keys. Corrupt data resets to defaults.
- **Audio:** starts only from a user gesture.

**Import formats:**
- **JSON:** `{ "name": "...", "tracks": [{ "title": "...", "artist": "..." }] }`.
- **Plain text:** one `Title - Artist` line per track. Both formats are resolved through iTunes like seed lists.

**Testing (Vitest):**
- fuzzy-match table: near-misses that must pass, different songs that must fail
- scoring and the reducer
- storage, including corruption recovery
- StagePlayer timing with a fake audio element

**Deploy:** a GitHub Actions workflow builds and publishes to Pages on push to `main`. The repo is local only until the user says to publish, then it's pushed as the Donshorti account.

## Out of scope (YAGNI)

Accounts and cloud sync, Spotify integration, multiplayer networking, real FFT audio analysis, daily-puzzle mode.
