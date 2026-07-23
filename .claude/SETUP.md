# Painted Cave — machine / dev-server setup

This is its own project (own git repo, own GitHub: `Harvard-Camlab`).
It is **not** part of the `股票`/stock project — do painted-cave work in a
session rooted here (`~/Desktop/Harvard Camlab/painted-cave`), not from 股票.

## Stack
Vite + vanilla JS + Three.js (GPU particles) + Tone.js. MIDI / OSC / keyboard
controlled, for the Harvard CAMLab Cave (three-projector 48:9 wall, 5760×1080).
`npm run dev` → http://localhost:5173. `npm run build` → static `dist/`.

## This machine's quirks (macOS, ~/Desktop)
- **No system Node.** A checksum-verified Node v22.17.0 darwin-arm64 is bundled
  in `tools/` (gitignored) — re-download from nodejs.org/dist if missing.
- **TCC blocks a Desktop cwd:** the preview harness can't read `~/Desktop`, and
  Node dies (`uv_cwd EPERM`) if launched with a Desktop cwd. So the dev server
  is run from a **scratchpad rsync copy** under `/private/tmp/...`, via a wrapper
  script that `cd`s into the copy and execs vite. The committed
  `.claude/launch.json` uses the canonical `npm run dev`; on this machine set up
  the scratchpad copy per below and point a session-local launch config at the
  wrapper instead.
- **The macOS /tmp cleaner purges scratchpad files after ~3 days.** Cheapest
  rebuild: `cp -R tools/node-v22.17.0-darwin-arm64` into the new scratchpad
  (don't re-download), rsync the project, `npm install` (fast, lockfile), write
  the wrapper, point the launch config at it.
- After editing source, re-sync the scratchpad copy (rsync; keep excludes
  anchored — a bare `--exclude dist` once clobbered `node_modules/vite/dist`).
- The performer's learned MIDI map persists in Chrome localStorage for
  localhost:5173 (key `paintedcave.midimap.v2`), not in any file.
