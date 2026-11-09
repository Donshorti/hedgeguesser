---
name: HedgeGuesser
description: A coin-op cabinet with a jukebox inside; neon retro song-guessing game.
colors:
  cabinet-night: "#0f051d"
  side-art-violet: "#1a0b30"
  housing-violet: "#26113f"
  unlit-segment: "#341a52"
  bezel-black: "#0a0314"
  hairline: "rgba(196, 160, 255, 0.14)"
  hairline-strong: "rgba(196, 160, 255, 0.26)"
  tube-white: "#f4ecff"
  dim-lilac: "#a99bc4"
  cap-ink: "#12041f"
  player-pink: "#ff2e97"
  player-pink-hi: "#ff8cc6"
  player-pink-lo: "#b3005f"
  player-pink-off: "#3d1236"
  audio-cyan: "#20e3ff"
  audio-cyan-hi: "#a6f4ff"
  audio-cyan-lo: "#0089a8"
  audio-cyan-off: "#0f2a3e"
  points-amber: "#ffb627"
  points-amber-hi: "#ffe09a"
  points-amber-lo: "#b06d00"
  points-amber-off: "#3a2414"
  miss-red: "#ff3b3b"
  miss-red-hi: "#ff9a9a"
  miss-red-lo: "#a30f1b"
  miss-red-off: "#3a0f1e"
typography:
  display:
    fontFamily: "Monoton, Bungee, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 0.9rem + 4.4vw, 5.5rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0em"
  headline:
    fontFamily: "Bungee, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 1.3rem + 2.6vw, 3.75rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0.04em"
  title:
    fontFamily: "Bungee, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 1.1rem + 1.3vw, 2.5rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "0.04em"
  body:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 0.98rem + 0.4vw, 1.375rem)"
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, system-ui, sans-serif"
    fontSize: "clamp(1.0625rem, 0.98rem + 0.4vw, 1.375rem)"
    fontWeight: 600
    lineHeight: 1.25
  label:
    fontFamily: "Bungee, system-ui, sans-serif"
    fontSize: "clamp(0.9375rem, 0.84rem + 0.45vw, 1.375rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.04em"
  plate:
    fontFamily: "Bungee, system-ui, sans-serif"
    fontSize: "clamp(0.8125rem, 0.78rem + 0.15vw, 0.9375rem)"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.08em"
  score:
    fontFamily: "DSEG7 Classic, ui-monospace, monospace"
    fontSize: "clamp(2rem, 1rem + 4.2vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
rounded:
  segment: "3px"
  strip: "6px"
  panel: "14px"
  window: "18px"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "20px"
  s-6: "24px"
  s-8: "32px"
  s-10: "40px"
  s-12: "48px"
  s-16: "64px"
  gutter: "clamp(16px, 4vw, 48px)"
  column-max: "720px"
  tap-min: "44px"
components:
  button-pink:
    backgroundColor: "{colors.player-pink}"
    textColor: "{colors.cap-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "60px"
  button-cyan:
    backgroundColor: "{colors.audio-cyan}"
    textColor: "{colors.cap-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "60px"
  button-amber:
    backgroundColor: "{colors.points-amber}"
    textColor: "{colors.cap-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "60px"
  button-red:
    backgroundColor: "{colors.miss-red}"
    textColor: "{colors.cap-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "60px"
  button-neutral:
    backgroundColor: "{colors.housing-violet}"
    textColor: "{colors.tube-white}"
    typography: "{typography.plate}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "48px"
  button-disabled:
    backgroundColor: "{colors.player-pink-off}"
    textColor: "{colors.dim-lilac}"
    rounded: "{rounded.pill}"
  button-xl:
    backgroundColor: "{colors.player-pink}"
    textColor: "{colors.cap-ink}"
    rounded: "{rounded.pill}"
    size: "clamp(9.5rem, 6rem + 13vw, 13.5rem)"
  title-strip:
    backgroundColor: "{colors.housing-violet}"
    textColor: "{colors.tube-white}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.strip}"
    padding: "16px 16px 12px 12px"
    height: "64px"
  title-strip-selected:
    backgroundColor: "#3a1450"
    textColor: "{colors.tube-white}"
    rounded: "{rounded.strip}"
  guess-input:
    backgroundColor: "{colors.bezel-black}"
    textColor: "{colors.tube-white}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.panel}"
    padding: "0 64px 0 16px"
    height: "56px"
  segment-score:
    backgroundColor: "#07020d"
    textColor: "{colors.points-amber}"
    typography: "{typography.score}"
  panel:
    backgroundColor: "{colors.housing-violet}"
    textColor: "{colors.tube-white}"
    rounded: "{rounded.panel}"
    padding: "32px 24px"
---

# Design System: HedgeGuesser

## Overview

**Creative North Star: "The Cabinet with a Jukebox Inside"**

HedgeGuesser is one physical machine the player stands in front of. It is not a dark web page with glowing card borders. Every surface is a part of a coin-op cabinet: violet side-art panels, black plastic bezels, recessed LCD and CRT windows, concave arcade caps that drop into their collars, LED pips, and jukebox title strips with selection codes. Light is the material. A thing glows only when it is lit, and it is lit only when it is live or interactive.

Density is low and the column is narrow (720px max), one cabinet face, centred. The type does three jobs with three voices: neon-tube lettering for the name, painted sign lettering for controls and headings, and a condensed sans for reading. Score is the fourth voice: amber seven-segment digits over their own unlit ghost.

Motion is physical and short (120 to 600ms): presses, roll-ups, flickers, a single marquee flash. Under reduced motion every animation collapses to its lit, at-rest frame and decorative particles are removed.

**Key Characteristics:**
- Ground is cabinet-night (#0f051d), with a faint violet radial wash from the top and a whole-screen scanline veil at no more than 3.5% white.
- Colour has jobs: pink for player action, cyan for audio and progress, amber for points, red for misses, lives and destruction.
- Every role colour ships as a set of four: base, highlight, shade, and unlit. Off states show the unlit tube, never a grey.
- Depth is physical: offset-and-blur shadows under things that sit on the cabinet, inset shadows for things set into it.
- Self-hosted fonts only; no third-party font hosts.

## Colors

A near-black violet cabinet lit by four neon tubes, each with a single job.

### Primary
- **Player Pink** (player-pink): every player action. The PLAY cap, the send key, the selected title strip, the focused guess field, the caret, `accent-color`, and text selection. The name's marquee lettering burns in its highlight (player-pink-hi).

### Secondary
- **Audio Cyan** (audio-cyan): audio and progress. The current stage segment, the equalizer, the loading meter, the CRT readout, links, and the global focus ring (3px solid, 3px offset).

### Tertiary
- **Points Amber** (points-amber): points only. Seven-segment score digits, won stages on the ladder, and the selection code plate on a title strip.
- **Miss Red** (miss-red): misses, lives and destructive actions. Life pips, the miss tick on a stage, MISS stamps, and the red arcade button for irreversible actions. Failed-status text uses its highlight (miss-red-hi).

### Neutral
- **Cabinet Night** (cabinet-night): the ground behind everything.
- **Side-Art Violet** (side-art-violet): raised panels, first step; the bottom of panel gradients.
- **Housing Violet** (housing-violet): raised panels, second step; the neutral button cap and suggestion lists.
- **Unlit Segment** (unlit-segment): scrollbar thumbs, hairline-strength fills, the neutral cap's highlight.
- **Bezel Black** (bezel-black): the black plastic around buttons, input slots, pip strips, ladder tracks and code plates.
- **Hairline / Hairline Strong** (hairline, hairline-strong): 1px lilac borders on panels, strips and fields; the strong step for hover and fields.
- **Tube White** (tube-white): primary text, 17.3:1 on the ground.
- **Dim Lilac** (dim-lilac): secondary text, labels, placeholders, disabled caps; 7.7:1 on the ground.
- **Cap Ink** (cap-ink): the label printed on a lit cap or lit chip; at least 5.6:1 on every role colour.

### Named Rules
**The Colour Has Jobs Rule.** Pink acts, cyan plays, amber scores, red misses. Never use a role colour for decoration or for a job that belongs to another. A new surface that needs emphasis picks the role whose job it is, or stays neutral.

**The Unlit Tube Rule.** An off, locked, or disabled thing shows its role's unlit tone (the `-off` value) or a violet neutral, never grey and never a reduced-opacity copy of the lit colour. A disabled control reads as a lamp that is out.

**The Lit Means Live Rule.** Glow (`--*-glow`, `--*-glow-text`) belongs only to lit, interactive or live elements: caps, current segments, pips that are on, the marquee, the score. Body copy and static panels never glow.

## Typography

**Display Font:** Monoton (with Bungee, system-ui)
**Sign Font:** Bungee (with system-ui)
**Body Font:** Barlow Semi Condensed 400/600 (with Arial Narrow, system-ui)
**Score Font:** DSEG7 Classic Bold (with ui-monospace)

**Character:** Neon tube, painted sign, printed manual, LCD readout. Each face is a component of the machine, and each stays in its own place.

### Hierarchy
- **Display** (Monoton 400, clamp 28px to 88px, capped by container width, line-height 1): the HedgeGuesser marquee only. Pink-highlight tubes inside a cyan-outlined backboard.
- **Headline** (Bungee 400, clamp 30px to 60px, line-height 1.05, +0.04em): screen headings and the OUT OF ORDER sign.
- **Title** (Bungee 400, clamp 22px to 40px, line-height 1.05, +0.04em): panel titles; h3 steps down to clamp 18px to 28px.
- **Body** (Barlow Semi Condensed 400, clamp 17px to 22px, line-height 1.5, max 68ch): reading text and descriptions. Track names and typed guesses use weight 600 at line-height 1.25.
- **Label** (Bungee 400, clamp 15px to 22px, uppercase, +0.04em): text printed on arcade caps, stage duration labels, section headings set in dim lilac (+0.06em).
- **Plate** (Bungee 400, clamp 13px to 15px, uppercase, +0.08em): small instrument labels on the cabinet: the score window label, the mode name in the status strip, table headers, small caps.
- **Score** (DSEG7 Classic 700, clamp 32px to 72px, tabular): amber digits over an amber-off ghost of all eights.

### Named Rules
**The Marquee Is the Name Rule.** Monoton sets the word HedgeGuesser and nothing else.

**The Instrument Label Rule.** Small uppercase Bungee plates name a control, a readout or a section. They never sit above a larger heading as a tagline or kicker.

**The Tabular Count Rule.** Every counter, score, time and table number uses `tabular-nums`.

## Layout

One centred column, 720px max, inside a fluid gutter (16px to 48px) that respects safe-area insets. The spacing scale is 4-based (4, 8, 12, 16, 20, 24, 32, 40, 48, 64px). Screens stack vertically with 20px gaps, tightening to 8 to 12px on phones and short laptop windows.

The Game screen is ordered as a cabinet: status strip, CRT window, stage ladder, play deck, guess field, attempt log. On phones and short windows the controls move low into thumb reach and SKIP, PLAY and HINT form one row of round caps. DOM order matches visual order and Tab order. Key breakpoints: 900px width, and 760px and 1000px height. The CRT window grows to push controls down.

Touch targets are at least 44px. Small caps measure 48px including the collar.

## Elevation & Depth

Depth is physical, not ambient. Things that sit on the cabinet (panels, strips, button housings, the marquee board) cast a blurred drop shadow plus a short 2px lip. Things that are set into the cabinet (input slots, LCD and CRT windows, pip strips, ladder tracks, code plates) are carved with inset shadows. Light comes from the neon itself: a tight core plus a soft halo, per role.

### Shadow Vocabulary
- **Panel** (`box-shadow: 0 10px 24px -10px rgba(0,0,0,0.8), 0 2px 0 rgba(0,0,0,0.5)`): panels, title strips, suggestion lists, the marquee board.
- **Housing** (`box-shadow: 0 6px 14px -4px rgba(0,0,0,0.75), 0 2px 0 #05010b`): the black collar around every arcade button.
- **Role glow** (for example pink: `0 0 1px rgba(255,46,151,0.9), 0 0 10px rgba(255,46,151,0.55), 0 0 32px rgba(255,46,151,0.28)`): lit caps, current segments, lit pips, selected strips.
- **Recess** (`inset 0 2px 4px rgba(0,0,0,0.7)` to `inset 0 3px 8px rgba(0,0,0,0.7)`): input slots, tracks, pip strips.

### Named Rules
**The Sits-On or Set-In Rule.** Every surface either sits on the cabinet (drop shadow) or is set into it (inset). Pick one; do not float a card with a soft ambient shadow.

**The One Tube Rule.** The scanline veil covers the whole screen, overlays included, so the screen reads as one tube. It never blocks input and never drops text contrast.

## Shapes

Shape follows the part. Arcade buttons are pills (999px) or full circles for the hero cap and the compact SKIP/HINT flanks. Title strips use tight 6px corners like printed cards. Panels and fields use 14px. The CRT window uses 18px. Ladder segments use 3px. Lamps and pips are circles with a lens highlight at 35% 30%.

## Components

### Buttons (ArcadeButton)
Tactile and physical: a black housing collar holding a concave lit cap.
- **Shape:** pill (999px) for `sm` and `md`; a circle for `xl` (clamp 152px to 216px wide) with a wrapping label.
- **Variants:** pink (player action, the default), cyan (audio), amber (points), red (destructive), neutral (navigation and utility: an unlit housing-violet cap with tube-white text and no glow until hovered or focused).
- **Cap:** a radial highlight pools at the bottom, a shade sits under the top lip, and the role glow surrounds it. Bungee uppercase label in cap-ink with a 1px white printed highlight.
- **Sizes:** `sm` 40px cap (48px with collar), 16px padding, plate size. `md` 50px cap, 24px padding, label size.
- **Hover / Press:** on hover the cap brightens to 1.08. On press the cap drops 1px and the dish deepens, using a 40ms snap and a spring on release (`--ease-press`).
- **Disabled:** the unlit tube. A dark gradient into the role's `-off` tone, dim-lilac label, no glow.
- **Focus:** the cyan ring outside the collar at a 4px offset. Neutral caps also gain a lilac halo.
- **Icons:** authored SVG glyphs on a 24px grid, filled with softened corners, `currentColor`.

### Title Strip (jukebox selector card)
- **Style:** a 6px-corner card with a gradient from housing-violet to side-art-violet, a 1px hairline border, and the panel shadow. A 5px genre colour band runs across the top.
- **Code plate:** a recessed bezel-black plate with the amber Bungee code (A1, B4 and so on).
- **Lamp:** a 14px pink-off lens at the right edge.
- **Selected:** pink border, a violet-magenta gradient, pink glow. The code plate turns pink with cap-ink, and the lamp lights.
- **Unavailable:** flat side-art-violet, band at 30%, dim code and name, lamp out. Hover lifts 1px; press drops 1px.

### Inputs / Fields (guess field)
- **Style:** a recessed slot. Bezel-black fill, hairline-strong border, 14px radius, 56px tall, Barlow 600 at 16px or larger.
- **Focus:** a pink border and a 3px pink halo (`rgba(255,46,151,0.28)`). The caret is pink.
- **Send key:** a 44px pink key inside the slot (10px radius). Unlit pink-off when disabled.
- **Suggestions:** a housing-violet list with the panel shadow. The active row fills pink with cap-ink text. The list opens upward on phones and downward on tall desktops.

### Segment Score
A recessed LCD window (gradient #07020d to #120720, inset shadow, faint amber edge). The DSEG7 amber digits carry a text glow over an amber-off ghost layer. A plate label sits above, right-aligned. On a hit the window flares amber for 600ms.

### LED Pips
A bezel-black pill strip of round lenses (12px to 20px). An unlit pip shows its role's `-off` tone with a lens highlight. A lit pip shows a highlight-to-base radial and the role glow. Red counts lives.

### Stage Ladder (signature)
A recessed bezel track of segments, each sized by its stage duration. Locked segments are housing-violet. The current segment is cyan with glow, a used segment is cyan-off, and a won segment is amber with glow. A missed stage gets a 3px red tick. A 2px tube-white playhead with a cyan halo sweeps during playback. Duration labels sit at each segment's right end in dim Bungee and turn cyan when reached.

### Marquee
The name in Monoton tubes on a dark glass backboard with an inset cyan outline tube. Letters flicker irregularly with step timing and always end lit. A hit flashes the board white-pink for 600ms. Under reduced motion there is no flicker, and the flash is held as a static glow.

### Panels and CRT Window
Panels (loading, out of order, game over) use the strip gradient, a hairline border, 14px radius, the panel shadow, 32px by 24px padding and centred content. The title is a pink sign with text glow. The CRT window is a near-black glass (#07020f) with a faint cyan bloom, a 6px bezel ring and its own scanlines inside the bezel.

## Do's and Don'ts

### Do:
- **Do** pick a role colour by its job: pink for actions, cyan for audio and progress, amber for points, red for misses and destruction.
- **Do** show off states with the role's `-off` tone or a violet neutral, so a disabled control reads as an unlit lamp.
- **Do** use the neutral ArcadeButton for navigation and utility keys, and reserve lit caps for the actions that matter on that screen.
- **Do** keep motion between 120ms and 600ms on `--ease-out` and `--ease-press`. Collapse every animation to its lit final frame under `prefers-reduced-motion`, and remove `[data-decor]` and confetti.
- **Do** keep text at least 44px tap-tall in controls, and keep the score and counters tabular.
- **Do** make every surface either sit on the cabinet (panel or housing shadow) or be set into it (inset).

### Don't:
- **Don't** set anything but the name in Monoton.
- **Don't** glow body copy or static panels; glow is for lit and live things only.
- **Don't** use grey for disabled states, and don't fade a lit colour with opacity to mean off.
- **Don't** let any veil or scanline lower text contrast or intercept input.
- **Don't** put a small uppercase plate above a heading as a kicker; plates label instruments and sections only.
- **Don't** load fonts from third-party hosts; every face is self-hosted and bundled.
