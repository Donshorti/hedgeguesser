# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React (user's stated preference), plain hooks + `useReducer`/context, no state library. Fully static build for GitHub Pages; no backend.

## Users

Music fans playing in two equal scenes: solo on a phone (quick rounds, often with headphones) and with friends around a shared laptop or TV screen (one person types while the group shouts answers). Neither scene is secondary.

## Product Purpose

HedgeGuesser is a song-guessing game. Players hear a song preview in growing slices (0.5s, 5s, 15s, 30s by default) and try to name the title as early as possible. Success: a round feels quick, fair, and tense, and recognizable songs make players want "one more".

## Positioning

Unlike a once-a-day guesser, HedgeGuesser is replayable on demand: a 20-song Challenge, an Endless mode with lives, curated genre/decade playlists, and playlists the player builds or imports themselves, all running locally with no account.

## Operating Context

- Audio comes from iTunes Search API 30-second previews; availability varies by song and region.
- Played with sound on; short stage-1 clip (0.5s) means audio must be preloaded before play.
- Shared-screen play means the guess field, stage progress, and result reveal must read at a distance.

## Capabilities and Constraints

- Modes: 20-Song Challenge (score by stage of correct guess), Endless (until lives run out).
- Correct guess = song title (fuzzy-matched); artist alone is not enough. Autocomplete suggests titles from the active playlist pool.
- Hints are bought with points (release year, genre, artist initials, first letter of title).
- Curated seed playlists ("Title — Artist" lists per genre/decade) resolved to iTunes previews at runtime and cached.
- Custom playlists built by searching, or imported via pasted JSON / track lists. All data in `localStorage`.
- Stage durations configurable in a settings panel.

## Brand Commitments

- Name: **HedgeGuesser**.
- User-pinned aesthetic: neon retro arcade; dark background `#0f051d`; vibrant neon pink and cyan glows, glowing borders, retro typography accents, smooth transitions.

## Evidence on Hand

No logo, artwork, or brand assets exist yet. No player data, testimonials, or stats; none may be invented.

## Product Principles

1. The song is the star: everything on the play screen serves listening and guessing.
2. Fair, not fiddly: forgiving of typos, strict about wrong songs.
3. Instant replay: zero setup between "I want to play" and hearing a clip.
4. Works across the room and in the hand alike.
