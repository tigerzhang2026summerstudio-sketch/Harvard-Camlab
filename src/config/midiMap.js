/**
 * midiMap.js — ALL MIDI routing lives here. No magic numbers elsewhere.
 *
 * Defaults follow an Akai MPK Mini MK3 factory preset, but MK3 presets are
 * user-editable, so YOUR unit may differ. To check: press `M` in the app to
 * open the MIDI monitor, move a control, and read the numbers it sends.
 * Fix them here — or click "learn" next to a slot in the debug panel (`D`)
 * and move the control; learned bindings persist in the browser
 * (localStorage) and override these defaults until "reset map" is clicked.
 *
 * Channels are 0-based (MIDI ch 1 = 0, ch 10 = 9). `null` = accept any.
 */

export const midiMapDefaults = {
  // 25 mini keys → Act 1. Any note-on within this range on the keys
  // channel is a "key". MK3 default octave: C2..C4 (36..60); the octave
  // buttons shift this, so the range is generous by default.
  keys: {
    channel: 0,
    noteMin: 21,
    noteMax: 108,
  },

  // 8 knobs K1..K8 → Act 2. MK3 factory: CC 70–77.
  knobs: {
    channel: null,
    ccs: [70, 71, 72, 73, 74, 75, 76, 77],
  },

  // 8 pads × banks A/B → Act 3. MK3 factory: pads send on MIDI ch 10
  // (0-based 9); bank A = notes 36–43, bank B = 44–51.
  // Pads are told apart from keys by CHANNEL, since note numbers overlap.
  pads: {
    channel: 9,
    bankA: [36, 37, 38, 39, 40, 41, 42, 43],
    bankB: [44, 45, 46, 47, 48, 49, 50, 51],
  },

  // Joystick (optional): X = wind direction, Y = camera drift.
  // MK3 factory sends pitch-bend on X; some presets use CC 1/2 — remap here.
  joystick: {
    channel: null,
    xCc: 1,   // if the stick is set to CC mode
    yCc: 2,
    usePitchBendX: true, // MK3 default: X axis is pitch bend
  },
};

/**
 * Computer-keyboard fallback (no hardware needed). Toggle with backquote (`)
 * — it auto-enables when no MIDI input is present. While it is ON, letters
 * play notes, so the global toggles need Shift (Shift+M, Shift+D, …).
 *
 *   notes  — bottom row is a piano octave (sharps on the home row),
 *            top row runs chromatically C4→C5.
 *   pads   — digits 1–8 fire pads in the current bank; 9 flips bank A/B.
 *   knobs  — ←/→ select K1..K8, ↑/↓ turn it (Shift = fine steps).
 */
export const keyboardFallback = {
  toggleKey: '`',
  velocity: 0.8, // fixed strike velocity for fallback notes (0..1)
  notes: {
    // lower octave C3..B3 (classic DAW layout)
    z: 48, s: 49, x: 50, d: 51, c: 52, v: 53, g: 54,
    b: 55, h: 56, n: 57, j: 58, m: 59,
    // upper run C4..C5, straight across the top row
    q: 60, w: 61, e: 62, r: 63, t: 64, y: 65, u: 66,
    i: 67, o: 68, p: 69, '[': 70, ']': 71, '\\': 72,
  },
  padDigits: ['1', '2', '3', '4', '5', '6', '7', '8'],
  bankToggleKey: '9',
  knobStep: 0.05,
  knobFineStep: 0.01,
};
