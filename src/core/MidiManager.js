/**
 * MidiManager — one place where all control input becomes normalized events.
 *
 * Sources: Web MIDI (Akai MPK Mini MK3 or anything else) and a computer-
 * keyboard fallback so the whole piece is playable with no hardware.
 *
 * Emitted events (subscribe with .on(type, cb)):
 *   'key'      {on, note, velocity}            — 25-key zone   (Act 1)
 *   'knob'     {index 0..7, value 0..1}        — K1..K8        (Act 2)
 *   'pad'      {on, bank 'A'|'B', index 0..7, velocity} —      (Act 3)
 *   'joystick' {axis 'x'|'y', value -1..1}
 *   'midi'     raw feed for the on-screen monitor (every message, both sources)
 *   'status'   {text, devices[], fallbackActive}
 *
 * Routing rules live in config/midiMap.js. MIDI-learn overrides are kept in
 * localStorage so the artist's corrections survive reloads.
 */
import { midiMapDefaults, keyboardFallback } from '../config/midiMap.js';

const STORAGE_KEY = 'paintedcave.midimap.v1';

export class MidiManager {
  constructor() {
    this.map = structuredClone(midiMapDefaults);
    this.applyStoredOverrides();

    this.listeners = {};        // type -> Set<cb>
    this.access = null;         // MIDIAccess once granted
    this.devices = [];          // connected input names
    this.fallbackActive = false;
    this.padBank = 'A';         // keyboard-fallback bank
    this.knobValues = new Array(8).fill(0); // fallback knob state (0..1)
    this.knobSelected = 0;      // fallback: which knob arrows address
    this.learning = null;       // {slot, done} while MIDI-learn is armed

    this.initKeyboardFallback();
  }

  on(type, cb) {
    (this.listeners[type] ??= new Set()).add(cb);
    return () => this.listeners[type].delete(cb);
  }

  emit(type, payload) {
    this.listeners[type]?.forEach((cb) => cb(payload));
  }

  // ── Web MIDI ────────────────────────────────────────────────────────
  async init() {
    if (!navigator.requestMIDIAccess) {
      this.setFallback(true);
      this.emit('status', this.status('Web MIDI not supported here — use Chrome/Edge. Keyboard fallback ON.'));
      return;
    }
    try {
      this.access = await navigator.requestMIDIAccess();
      this.access.onstatechange = () => this.bindInputs('device change');
      this.bindInputs('startup');
    } catch {
      this.setFallback(true);
      this.emit('status', this.status('MIDI access denied — keyboard fallback ON.'));
    }
  }

  bindInputs(reason) {
    this.devices = [];
    for (const input of this.access.inputs.values()) {
      this.devices.push(input.name);
      input.onmidimessage = (e) => this.onMidiMessage(e, input.name);
    }
    // No hardware → let the artist play with the computer keyboard.
    if (this.devices.length === 0) this.setFallback(true);
    this.emit('status', this.status(
      this.devices.length
        ? `MIDI connected (${reason}): ${this.devices.join(', ')}`
        : `No MIDI device (${reason}) — keyboard fallback ON (\`) `,
    ));
  }

  status(text) {
    return { text, devices: this.devices, fallbackActive: this.fallbackActive };
  }

  onMidiMessage(e, sourceName) {
    const [statusByte, d1 = 0, d2 = 0] = e.data;
    const kind = statusByte & 0xf0;
    const channel = statusByte & 0x0f;
    if (kind === 0xf0) return; // ignore system/clock messages

    let type = null;
    if (kind === 0x90 && d2 > 0) type = 'noteon';
    else if (kind === 0x80 || (kind === 0x90 && d2 === 0)) type = 'noteoff';
    else if (kind === 0xb0) type = 'cc';
    else if (kind === 0xe0) type = 'pitchbend';
    if (!type) return;

    if (this.learning && this.captureLearn(type, channel, d1)) return;

    const semantic = this.route(type, channel, d1, d2);
    this.emit('midi', { source: sourceName, type, channel, d1, d2, semantic });
  }

  /** Map a raw message to a semantic event; returns a label for the monitor. */
  route(type, channel, d1, d2) {
    const { keys, knobs, pads, joystick } = this.map;
    const chOk = (want) => want === null || want === channel;

    if (type === 'pitchbend' && joystick.usePitchBendX && chOk(joystick.channel)) {
      const value = ((d2 << 7) | d1) / 8192 - 1; // 14-bit → -1..1
      this.emit('joystick', { axis: 'x', value });
      return 'joy X';
    }

    if (type === 'cc') {
      if (chOk(knobs.channel)) {
        const index = knobs.ccs.indexOf(d1);
        if (index !== -1) {
          const value = d2 / 127;
          this.knobValues[index] = value;
          this.emit('knob', { index, value });
          return `K${index + 1}`;
        }
      }
      if (chOk(joystick.channel)) {
        if (d1 === joystick.xCc) { this.emit('joystick', { axis: 'x', value: (d2 / 127) * 2 - 1 }); return 'joy X'; }
        if (d1 === joystick.yCc) { this.emit('joystick', { axis: 'y', value: (d2 / 127) * 2 - 1 }); return 'joy Y'; }
      }
      return null;
    }

    // note on/off: pads are distinguished from keys by channel (numbers overlap)
    const on = type === 'noteon';
    if (chOk(pads.channel)) {
      for (const bank of ['A', 'B']) {
        const index = this.map.pads[bank === 'A' ? 'bankA' : 'bankB'].indexOf(d1);
        if (index !== -1) {
          this.emit('pad', { on, bank, index, velocity: d2 / 127 });
          return `pad ${bank}${index + 1}`;
        }
      }
    }
    if (chOk(keys.channel) && d1 >= keys.noteMin && d1 <= keys.noteMax) {
      this.emit('key', { on, note: d1, velocity: d2 / 127 });
      return 'key';
    }
    return null;
  }

  // ── MIDI-learn ──────────────────────────────────────────────────────
  /** slot: 'keys' | 'knob:N' | 'pad:A:N' | 'pad:B:N' (N is 0-based). */
  startLearn(slot, done) { this.learning = { slot, done }; }
  cancelLearn() { this.learning = null; }

  captureLearn(type, channel, d1) {
    const { slot, done } = this.learning;
    const [kind, a, b] = slot.split(':');
    let bound = null;

    if (kind === 'knob' && type === 'cc') {
      this.map.knobs.ccs[Number(a)] = d1;
      this.map.knobs.channel = channel;
      bound = `K${Number(a) + 1} ← CC ${d1} ch ${channel + 1}`;
    } else if (kind === 'pad' && type === 'noteon') {
      this.map.pads[a === 'A' ? 'bankA' : 'bankB'][Number(b)] = d1;
      this.map.pads.channel = channel;
      bound = `pad ${a}${Number(b) + 1} ← note ${d1} ch ${channel + 1}`;
    } else if (kind === 'keys' && type === 'noteon') {
      this.map.keys.channel = channel;
      bound = `keys ← ch ${channel + 1}`;
    }

    if (bound) {
      this.learning = null;
      this.saveOverrides();
      done?.(bound);
      this.emit('status', this.status(`learned: ${bound}`));
      return true; // message consumed by learn, not routed
    }
    return false;
  }

  saveOverrides() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.map)); } catch { /* private mode */ }
  }

  applyStoredOverrides() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) this.map = { ...this.map, ...JSON.parse(stored) };
    } catch { /* ignore corrupt/unavailable storage */ }
  }

  resetMap() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    this.map = structuredClone(midiMapDefaults);
    this.emit('status', this.status('mapping reset to MK3 defaults'));
  }

  // ── Computer-keyboard fallback ──────────────────────────────────────
  setFallback(active) {
    if (this.fallbackActive === active) return;
    this.fallbackActive = active;
    this.emit('status', this.status(`keyboard fallback ${active ? 'ON' : 'OFF'} (\`)`));
  }

  initKeyboardFallback() {
    const kb = keyboardFallback;
    const held = new Set(); // suppress key-repeat

    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === kb.toggleKey) { this.setFallback(!this.fallbackActive); return; }
      if (!this.fallbackActive || e.shiftKey) return; // Shift+letter = app toggles
      const key = e.key.toLowerCase();

      // knobs: arrows select and turn
      if (key.startsWith('arrow')) {
        e.preventDefault();
        if (key === 'arrowleft') this.knobSelected = (this.knobSelected + 7) % 8;
        if (key === 'arrowright') this.knobSelected = (this.knobSelected + 1) % 8;
        if (key === 'arrowup' || key === 'arrowdown') {
          const step = kb.knobStep * (key === 'arrowup' ? 1 : -1);
          const i = this.knobSelected;
          this.knobValues[i] = Math.min(1, Math.max(0, this.knobValues[i] + step));
          this.emit('knob', { index: i, value: this.knobValues[i] });
        }
        this.emit('midi', {
          source: 'kbd', type: 'cc', channel: 0,
          d1: this.map.knobs.ccs[this.knobSelected],
          d2: Math.round(this.knobValues[this.knobSelected] * 127),
          semantic: `K${this.knobSelected + 1}`,
        });
        return;
      }

      if (held.has(key)) return;

      if (key === kb.bankToggleKey) {
        held.add(key);
        this.padBank = this.padBank === 'A' ? 'B' : 'A';
        this.emit('midi', { source: 'kbd', type: 'bank', channel: 0, d1: 0, d2: 0, semantic: `bank ${this.padBank}` });
        return;
      }

      const padIndex = kb.padDigits.indexOf(key);
      if (padIndex !== -1) {
        held.add(key);
        this.emit('pad', { on: true, bank: this.padBank, index: padIndex, velocity: kb.velocity });
        this.emit('midi', {
          source: 'kbd', type: 'noteon', channel: this.map.pads.channel ?? 9,
          d1: this.map.pads[this.padBank === 'A' ? 'bankA' : 'bankB'][padIndex],
          d2: Math.round(kb.velocity * 127), semantic: `pad ${this.padBank}${padIndex + 1}`,
        });
        return;
      }

      const note = kb.notes[key];
      if (note !== undefined) {
        held.add(key);
        this.emit('key', { on: true, note, velocity: kb.velocity });
        this.emit('midi', {
          source: 'kbd', type: 'noteon', channel: this.map.keys.channel ?? 0,
          d1: note, d2: Math.round(kb.velocity * 127), semantic: 'key',
        });
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (!held.has(key)) return;
      held.delete(key);
      if (!this.fallbackActive) return;

      const padIndex = kb.padDigits.indexOf(key);
      if (padIndex !== -1) {
        this.emit('pad', { on: false, bank: this.padBank, index: padIndex, velocity: 0 });
        return;
      }
      const note = kb.notes[key];
      if (note !== undefined) {
        this.emit('key', { on: false, note, velocity: 0 });
        this.emit('midi', { source: 'kbd', type: 'noteoff', channel: this.map.keys.channel ?? 0, d1: note, d2: 0, semantic: 'key' });
      }
    });
  }
}
