# The Painted Cave: Visualizing the Pure Land

An interactive, real-time audiovisual installation for the Harvard CAMLab Cave —
a browser-based piece controlled live by an Akai MPK Mini MK3, in which a
luminous Pure Land paradise (after *The Sutra on the Contemplation of Amitāyus*
and the murals of Dunhuang Cave 217) is visualized into being out of particles,
and dissolves back into darkness.

## Run

```bash
npm install
npm run dev      # → http://localhost:5173
npm run build    # static bundle in dist/
```

Requires Chrome or Edge (Web MIDI). Node 20+.

> **Note (this machine):** Node.js is not installed system-wide. A verified
> local copy lives in the Claude session scratchpad; to install permanently,
> get Node LTS from https://nodejs.org.

## Key toggles

| Key | Action |
| --- | ------ |
| `F` | Fullscreen |
| `M` | MIDI monitor *(step 2)* |
| `D` | Debug overlay *(step 4+)* |
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
