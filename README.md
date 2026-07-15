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

## Key toggles

| Key | Action |
| --- | ------ |
| `F` | Fullscreen |
| `M` | MIDI monitor |
| `D` | Debug panel (FPS, device status, MIDI-learn) |
| `` ` `` | Keyboard play on/off |
| `A` | Auto/attract mode *(step 4+)* |
| `R` | Reset to prologue *(step 4+)* |
| `0` | Mute *(step 9)* |

## Three-projector Cave layout

Edit `src/config/config.js`: set `worldWidth: 5760, worldHeight: 1080` and run
fullscreen across the spanned desktop. All layout is computed in world units —
no code changes needed.

## Assets

- `assets/murals/` — Cave 217 mural JPG/PNGs (placeholders ship; see step 8)
- `assets/music/` — `prologue / part1 / part2 / part3 / coda` .mp3/.ogg (step 9)
- `assets/fonts/` — caption serif

*(README grows with each build step: MIDI mapping, keyboard fallback, etc.)*
