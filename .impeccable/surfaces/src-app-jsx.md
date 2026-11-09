---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: ["src/screens"]
---

# HedgeGuesser — app surfaces (Home, Play setup, Game, Results, Playlists, Settings)

Scope: the whole single-page app. Mode: Experience on the Game screen (the song and the guess lead); Operate on Playlists/Settings (precision, familiar patterns, same world).
Audience: solo phone players (headphones, one hand) and groups around a laptop/TV (read from ~3m). Task: hear a slice, type a title, climb the stages.
Constraints: brief-pinned world (neon retro arcade, ground #0f051d, pink/cyan glows); self-hosted fonts; static GitHub Pages; reduced-motion respected.
Memorable moment: the stage ladder lighting segment by segment, then the marquee flash + 7-segment roll-up + pixel confetti on a hit.

## Direction contract

THESIS: The app is a coin-op cabinet with a jukebox inside — one physical machine the player stands in front of. It refuses the category default of a dark web page with glowing card borders and a centred form.

OWN-WORLD: Ground #0f051d with violet-tinted raised panels like cabinet side-art. Neon-tube marquee lettering (Monoton) only for the name; Bungee sign lettering for controls and headings; Barlow Semi Condensed for reading; DSEG7 amber digits for score. Colour has jobs: pink = player action, cyan = audio/progress, amber = points, red = misses/lives. Round concave arcade buttons that physically depress; LED segments and pips; jukebox title strips with codes (A1…C2) and colour bands; a faint scanline veil that never touches text contrast.

STORY: The player sees an idle cabinet cycling high scores, presses START, punches jukebox strips to pick music, then stands at the play deck: listen, guess, climb. They believe the game is fair (typos forgiven, wrong songs not) and want one more run to put their initials on the board.

FIRST VIEWPORT: Game screen — status strip at top (round 07/20, red life pips, amber 7-segment score at the right); below it a CRT window holding the cyan LED equalizer, full column width; under it the four-segment stage ladder sized by duration with a sweeping playhead and duration labels; then the dominant pink arcade PLAY button (the largest object on screen, centred); then the guess field with autocomplete and SKIP/HINT as smaller arcade buttons; attempt log of four rows below. On phones the play button and input sit in the lower half for thumbs.

FORM: Coin-op cabinet + jukebox selector (brief-pinned world, first on the ordered list; no roll). seed: none (brief-pinned direction)

Signature interaction: the stage ladder — segments light as stages unlock, the playhead sweeps during playback, a hit triggers marquee flash, score roll-up and pixel-square confetti; a miss stamps MISS with a short shake. Motion grammar: physical (press, roll, flicker), short (120–600ms), off under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
