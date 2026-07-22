/**
 * OscManager — OSC input over a WebSocket. The WiFi controller sends the
 * SAME raw MIDI bytes it would over USB, wrapped in OSC at /midi/raw:
 *
 *     /midi/raw  <status:int> <d1:int> <d2:int> <channel:int>
 *
 * so this class is just a transport: it decodes the OSC packet and hands
 * the raw MIDI to MidiManager.ingestOscMidi (wired in main.js via
 * onRawMidi), which does ALL the routing — one map, one MIDI-learn, one
 * monitor, shared with USB MIDI. A legacy semantic scheme (/pc/key, …)
 * is still accepted for non-MIDI senders and emits normalized events
 * directly; both are documented in config/oscConfig.js.
 *
 * Wire format: raw OSC binary (decoded here — bundles + messages, int/
 * float/string args) or JSON {address, args:[…]} for flexibility.
 */
import { oscConfig } from '../config/oscConfig.js';

export class OscManager {
  constructor() {
    this.listeners = {};
    this.ws = null;
    this.live = false;
    this.onLiveChange = null; // main.js hooks this to mute the kbd fallback
    this.onRawMidi = null;    // main.js → MidiManager.ingestOscMidi
  }

  on(type, cb) { (this.listeners[type] ??= new Set()).add(cb); }
  emit(type, payload) { this.listeners[type]?.forEach((cb) => cb(payload)); }

  init() {
    if (!oscConfig.enabled) return;
    this.connect();
  }

  connect() {
    let ws;
    try {
      ws = new WebSocket(oscConfig.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      this.setLive(true);
      console.info(`[osc] connected — ${oscConfig.url}`);
    };
    ws.onclose = () => {
      this.setLive(false);
      this.scheduleReconnect();
    };
    ws.onerror = () => { try { ws.close(); } catch { /* already closing */ } };
    ws.onmessage = (ev) => this.onMessage(ev.data);
  }

  scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), oscConfig.reconnectSec * 1000);
  }

  setLive(live) {
    if (live === this.live) return;
    this.live = live;
    this.onLiveChange?.(live);
  }

  onMessage(data) {
    let messages;
    if (typeof data === 'string') {
      try {
        const m = JSON.parse(data);
        messages = Array.isArray(m) ? m : [m];
      } catch { return; }
    } else {
      messages = decodeOscPacket(new DataView(data));
    }
    for (const m of messages) if (m && m.address) this.route(m.address, m.args || []);
  }

  route(address, a) {
    const { addresses } = oscConfig;
    const num = (v) => (typeof v === 'string' ? parseFloat(v) : v);

    // Primary protocol: raw MIDI over OSC. Forward the four bytes to
    // MidiManager, which routes them exactly like a USB message.
    if (address === addresses.midiRaw) {
      const status = Math.round(num(a[0])) || 0;
      const d1 = Math.round(num(a[1])) || 0;
      const d2 = Math.round(num(a[2])) || 0;
      const channel = Math.round(num(a[3])) || 0;
      this.onRawMidi?.(status, d1, d2, channel);
      return;
    }

    // ── Legacy semantic scheme (optional; for non-MIDI OSC senders) ──
    if (address === addresses.key) {
      const note = Math.round(num(a[0]));
      const vel = num(a[1]) ?? 0;
      this.emit('key', { on: vel > 0, note, velocity: Math.max(0, Math.min(1, vel)) });
    } else if (address === addresses.knob) {
      this.emit('knob', { index: Math.round(num(a[0])), value: Math.max(0, Math.min(1, num(a[1]))) });
    } else if (address === addresses.pad) {
      const bank = (a[0] === 1 || a[0] === 'B' || a[0] === 'b') ? 'B' : 'A';
      const vel = num(a[2]) ?? 1;
      this.emit('pad', { on: vel > 0, bank, index: Math.round(num(a[1])), velocity: vel });
    } else if (address === addresses.joy) {
      const axis = (a[0] === 1 || a[0] === 'y' || a[0] === 'Y') ? 'y' : 'x';
      this.emit('joystick', { axis, value: Math.max(-1, Math.min(1, num(a[1]))) });
    }
  }
}

// ── Minimal OSC binary decoder (address · typetags · i/f/s · #bundle) ──
function decodeOscPacket(dv) {
  const out = [];
  readPacket(dv, 0, dv.byteLength, out);
  return out;
}

function readPacket(dv, start, end, out) {
  if (dv.getUint8(start) === 0x23) { // '#'  → likely "#bundle"
    let p = start + 8 + 8; // skip "#bundle\0" (8) + timetag (8)
    while (p < end) {
      const size = dv.getInt32(p); p += 4;
      readPacket(dv, p, p + size, out);
      p += size;
    }
    return;
  }
  const [address, a1] = readString(dv, start);
  if (address[0] !== '/') return;
  let p = a1;
  const [tags, t1] = readString(dv, p);
  p = t1;
  const args = [];
  for (let i = 1; i < tags.length; i += 1) { // tags[0] is ','
    const t = tags[i];
    if (t === 'i') { args.push(dv.getInt32(p)); p += 4; }
    else if (t === 'f') { args.push(dv.getFloat32(p)); p += 4; }
    else if (t === 's') { const [s, np] = readString(dv, p); args.push(s); p = np; }
    else if (t === 'T') args.push(true);
    else if (t === 'F') args.push(false);
    else break; // unknown type — stop parsing this message
  }
  out.push({ address, args });
}

function readString(dv, start) {
  let p = start;
  while (p < dv.byteLength && dv.getUint8(p) !== 0) p += 1;
  let s = '';
  for (let i = start; i < p; i += 1) s += String.fromCharCode(dv.getUint8(i));
  const next = start + (Math.floor((p - start) / 4) + 1) * 4; // null + pad to 4
  return [s, next];
}
