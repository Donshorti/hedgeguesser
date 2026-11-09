# HedgeGuesser

A neon arcade song-guessing game. Hear a slice of a song — half a second first — and type its title. Miss or skip and the next slice gets longer (0.5s → 5s → 15s → 30s); the sooner you get it, the more points. Play a 20-song **Challenge** or **Endless** with three lives, buy hints with your score, and put your initials on the high-score board.

Previews and artwork come from the public iTunes Search API. Everything else (playlists, settings, high scores) lives in your browser's `localStorage`. There is no backend: the build is a static site.

## Develop

Requires Node 20+.

```sh
npm install      # dependencies
npm run dev      # dev server at http://localhost:5173
npm test         # unit tests (Vitest)
npm run build    # production build into dist/
npm run preview  # serve dist/ at http://localhost:4173
```

The build uses relative asset URLs (`base: './'` in `vite.config.js`), so `dist/` works from any sub-path, including a GitHub Pages project URL.

## Seed playlists

The built-in jukebox playlists are generated from the plain-text lists in `scripts/seeds/` (a few `# id:` / `# code:` / `# name:` header lines, then one `Title - Artist` per line). Results are cached in `scripts/.seed-cache.json`. After editing them, rebuild the bundled data:

```sh
npm run seeds    # resolves each song via iTunes and writes src/data/seedPlaylists.json
```

## Importing a playlist

Custom playlists can be pasted in either format.

JSON — an array of tracks, or an object with a `name` and `tracks`. An optional numeric iTunes track `id` (placeholder below) skips the lookup:

```json
{
  "name": "Road trip",
  "tracks": [
    { "title": "Dreams", "artist": "Fleetwood Mac" },
    { "title": "Mr. Brightside", "artist": "The Killers", "id": 123456789 }
  ]
}
```

Lines — one `Title - Artist` per line (a dash, en dash or em dash with spaces around it; blank lines and lines starting with `#` are ignored):

```
Dreams - Fleetwood Mac
Mr. Brightside - The Killers
```

Songs without an id are matched against iTunes the first time the playlist is played.

## Tuning the game

Default stage timings, points, lives, challenge length and hint costs are in `src/config/gameConfig.js` (`DEFAULT_SETTINGS`). Stages must be four increasing durations between 0 and 30 seconds. A Settings screen for changing these in the app is planned.

## Deploy to GitHub Pages

`.github/workflows/deploy.yml` tests, builds and publishes `dist/` on every push to `main` (or on demand from the Actions tab).

One-time setup: in the repository, open **Settings → Pages** and set **Source** to **GitHub Actions**.
