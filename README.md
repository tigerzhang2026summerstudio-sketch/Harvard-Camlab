# The Painted Cave: Visualizing the Pure Land

An interactive, real-time audiovisual installation for the Harvard CAMLab Cave —
a browser-based piece controlled live by an Akai MPK Mini MK3, in which a
luminous Pure Land paradise (after *The Sutra on the Contemplation of Amitāyus*
and the murals of Dunhuang Cave 217) is visualized into being out of particles,
and dissolves back into darkness.

## Run — no terminal needed

**Double-click `Start Painted Cave.command`** (a shortcut is also on the
Desktop). It starts the show and opens Chrome by itself; on the very first
run it installs its two libraries (needs internet, ~1 minute). Close the
little window it opens to stop the show. A Node runtime is bundled in
`tools/`, so nothing has to be installed on the computer.

<details><summary>Manual run (developers)</summary>

```bash
npm install
npm run dev      # → http://localhost:5173
npm run build    # static bundle in dist/
```

Requires Chrome or Edge (Web MIDI). Node 20+ — or use the bundled
`tools/node-v22.17.0-darwin-arm64/bin`. If `tools/` is ever missing,
download Node LTS from https://nodejs.org and re-extract it there.
</details>

## Connecting the MPK Mini MK3

Plug it in via USB (before or after launch — hot-plug is handled), and allow
MIDI when Chrome asks. Press `M` to open the **MIDI monitor**: every message
appears with its raw numbers (`type · channel · note/CC # · value → what it
mapped to`). If a control shows `(unmapped)`, either edit
`src/config/midiMap.js` (all defaults live there, commented), or press `D`
and use **MIDI-learn**: click *learn* next to a slot, move that control,
done — learned bindings persist in the browser. *reset map* clears them.

## Playing without hardware (keyboard fallback)

Keyboard play turns on automatically when no MIDI device is present —
toggle it manually with **`` ` `` (backquote)**.

| Zone | Keys |
| ---- | ---- |
| 25 keys (Act 1) | bottom row `Z X C V B N M` = piano octave C3, sharps on `S D G H J`; top row `Q W E R T Y U I O P [ ] \` = chromatic run C4→C5 |
| 8 knobs (Act 2) | `←`/`→` select K1–K8, `↑`/`↓` turn |
| 16 pads (Act 3) | digits `1–8` fire pads, `9` flips bank A/B |

While keyboard play is ON, letters are notes — so use **Shift** for the
global toggles (Shift+M, Shift+D, …). With a MIDI device connected and
keyboard play OFF, plain letters work.

## The sixteen contemplations — one story per pad

The Contemplation Sutra teaches sixteen visualizations; the MPK has
sixteen pads. Each press shows the story's caption and plays its vision
(edit in `config.js` → `act3.padMap` / `stories`):

| Pad | Story | Vision |
| --- | ----- | ------ |
| A1 | 第一观 The Setting Sun | an ember sun sinks in the west (+ Cave 217 mural of Vaidehī before the sun) |
| A2 | 第二观 Water & Ice | a clear wave sweeps the ground |
| A3 | 第三观 The Beryl Ground | the freeze surges (fills the ground meter) |
| A4 | 第七观 The Lotus Throne | the throne story |
| A5 | 第八观 The Image | the Buddha half-condenses — an image only |
| A6 | 第九观 The True Body | the Buddha mural fully assembles |
| A7 / A8 | 第十/十一观 The Bodhisattvas | Avalokiteśvara / Mahāsthāmaprāpta |
| B1 | 第十二观 The Universal Vision | side murals condense + flowers rain |
| B2 | 第十三观 The Mixed Vision | the vision flickers (+ music-sky mural) |
| B3 / B4 / B5 | 第十四–十六观 The Nine Rebirths | three souls each: high / middle / low lotuses |
| B6 | 开悟 The Awakening | Vaidehī dissolves; the vision holds radiant |
| B7 | 缘起 The Prison | flashback — the Cave 217 prison mural condenses |
| B8 | 归寂 Dissolution | the vision releases into the coda |

The four growth knobs also tell theirs: K1 = 第四观 trees, K2 = 第五观
ponds, K3 = 第六观 towers of music, K4 = the wind (captions appear the
first time each is raised).

Keyboard: digits `1–8` are the pads of the current bank; `9` flips bank A/B.

## Key toggles

| Key | Action |
| --- | ------ |
| `F` | Fullscreen |
| `H` | Re-show the opening tutorial |
| `C` | Captions on/off (also pad B7) |
| `M` | MIDI monitor |
| `D` | Debug panel (FPS, act meters, MIDI-learn, act jump buttons) |
| `` ` `` | Keyboard play on/off |
| `A` | Auto/attract mode: after 30 s idle the piece plays its whole arc by itself |
| `R` | Reset to the prologue |
| `0` | Mute |

(While keyboard play is ON, letters are notes — hold **Shift** with any
toggle key.)

## Quality & performance

`config.js → quality`: `'high'` (300k particle budget + bloom),
`'medium'` (half budget), `'low'` (15% budget, bloom off — for weak GPUs).
All layers and burst counts scale with it. Target is 60 fps on a desktop
GPU; the `D` panel shows live FPS. Device pixel ratio is capped at 2.

## The arc

prologue → **Act I** (keys: flood of light, ground freezes) → **Act II**
(knobs: the world grows and holds) → **Act III** (pads: assembly &
rebirth) → **coda** (dissolution to black) → prologue again. Transitions
fire automatically at the config thresholds (`acts.*`), each marked by a
caption, a soft radiance swell, and a wash of rising motes; the performer
can always linger, jump (`D` panel), or reset (`R`).

## Three-projector Cave layout

Edit `src/config/config.js`: set `worldWidth: 5760, worldHeight: 1080` and run
fullscreen across the spanned desktop. All layout is computed in world units —
no code changes needed.

## Assets

- `assets/murals/` — mural imagery (see below)
- `assets/music/` — the five score tracks (see below)
- `assets/fonts/` — caption serif

### Music & sound

Drop the produced score into `assets/music/` as `prologue`, `part1`,
`part2`, `part3`, `coda` — `.mp3`, `.ogg` or `.wav` (first found wins;
silent `.wav` placeholders ship). Tracks loop and crossfade (equal-power,
~3 s) on every act change; a missing file logs a warning and the show
plays on without it.

Layered on top, always live: Act 1 keys ring pentatonic chimes quantized
to a slow grid (clusters cascade); Act 2's K3 raises a self-playing
plucked layer; Act 3 pads strike deep gongs, grade-pitched bells, and
choir-like swells. Master chain: reverb → limiter; volume in
`config.js → audio`.

**Browsers block sound until a real gesture:** click the stage (or press
any computer key) once — a small ♪ chip reminds you until then. MIDI
input alone cannot unlock audio; this is a Chrome policy, not a bug.

### Adding real Cave 217 murals

Placeholder SVGs ship so the mural-dissolve system runs out of the box.
To use real murals:

1. Crop the detail you want (the Buddha, an apsara, a tableau section).
   Best results: subject on a dark or transparent background — pixels
   darker than `murals.luminanceCutoff` are skipped, so black becomes
   empty space between particles.
2. Drop the JPG/PNG into `assets/murals/`.
3. In `src/config/config.js` → `murals.panels`, set `file:` to the new
   name. `role: 'amitabha'` is the figure summoned by pad A1;
   `role: 'panel'` panels materialize with the throne (add as many as you
   like across the panorama via `x` / `yFrac` / `heightFrac`).
4. `retint` blends photo colors toward the beryl/gold palette (0–1);
   `scatterDist` sets how far the image frays when it dissolves.

Missing files never break the show — they log a console warning and the
procedural silhouettes take over.

*(README grows with each build step: MIDI mapping, keyboard fallback, etc.)*
