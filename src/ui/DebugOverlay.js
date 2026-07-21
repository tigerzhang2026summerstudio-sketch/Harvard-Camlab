/**
 * DebugOverlay — rehearsal tools, never part of the show.
 *
 *   M (Shift+M while keyboard-play is on) → MIDI monitor: every incoming
 *     message with its raw numbers, so mappings can be read and fixed.
 *   D (Shift+D) → debug panel: FPS, device status, mapping slots with
 *     MIDI-learn ("learn" → move a control → bound + saved).
 *
 * Both start hidden ("show mode"): they are plain DOM over the canvas and
 * cost nothing while hidden.
 */
import { config } from '../config/config.js';
import { PHASES } from '../core/StateManager.js';

export class DebugOverlay {
  constructor(midi, state) {
    this.midi = midi;
    this.state = state;
    this.fps = 0;
    this.frames = 0;
    this.fpsClock = 0;
    this.monitorLines = [];
    this.maxLines = 14;

    this.injectStyles();
    this.monitorEl = this.buildMonitor();
    this.panelEl = this.buildPanel();

    midi.on('midi', (m) => this.pushMonitorLine(m));
    midi.on('status', (s) => this.setStatus(s));
    state.on('phase', () => this.refreshActRow());
    this.refreshActRow();

    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      // D and M always work — they are rehearsal tools, and a stray note
      // while opening a panel is harmless.
      if (k === 'm') this.toggle(this.monitorEl);
      if (k === 'd') this.toggle(this.panelEl);
      // The show-altering toggles (C/R/H/A) still need Shift while
      // keyboard-play is on; say so instead of failing silently.
      if (this.midi.fallbackActive && !e.shiftKey && ['c', 'r', 'h', 'a'].includes(k)) {
        this.flashToast(k.toUpperCase());
      }
    });
  }

  toggle(el) { el.style.display = el.style.display === 'none' ? 'block' : 'none'; }

  /** A pressed toggle letter was swallowed by keyboard-play — say so. */
  flashToast(letter) {
    if (!this.toastEl) {
      this.toastEl = document.createElement('div');
      this.toastEl.className = 'dbg dbg-toast';
      document.body.appendChild(this.toastEl);
    }
    this.toastEl.textContent =
      `keyboard-play is ON, so "${letter}" plays notes — press Shift+${letter}, or \` to turn keyboard-play off`;
    this.toastEl.style.display = 'block';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastEl.style.display = 'none'; }, 4500);
  }

  /** Called once per frame from the main loop. */
  tick(dt) {
    this.frames += 1;
    this.fpsClock += dt;
    if (this.fpsClock >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsClock);
      this.frames = 0;
      this.fpsClock = 0;
      if (this.panelEl.style.display !== 'none') {
        this.panelEl.querySelector('#dbg-fps').textContent = `${this.fps} fps`;
        this.refreshMeters();
      }
    }
  }

  refreshMeters() {
    const s = this.state;
    this.panelEl.querySelector('#dbg-meter-fullness').style.width = `${s.fullness * 100}%`;
    this.panelEl.querySelector('#dbg-meter-lushness').style.width = `${s.lushness * 100}%`;
    this.panelEl.querySelector('#dbg-auto').textContent = s.autoEnabled
      ? (s.idleTime >= config.acts.autoIdleSec ? 'auto: playing' : 'auto: armed')
      : 'auto: off';
  }

  refreshActRow() {
    for (const btn of this.panelEl.querySelectorAll('[data-phase]')) {
      btn.classList.toggle('dbg-active', btn.dataset.phase === this.state.phase);
    }
  }

  // ── MIDI monitor ────────────────────────────────────────────────────
  pushMonitorLine(m) {
    const t = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const sem = m.semantic ? `→ ${m.semantic}` : '→ (unmapped)';
    this.monitorLines.push(
      `${t}  ${m.source.slice(0, 12).padEnd(12)} ${m.type.padEnd(9)} ch${String(m.channel + 1).padStart(2)}  #${String(m.d1).padStart(3)}  val ${String(m.d2).padStart(3)}  ${sem}`,
    );
    if (this.monitorLines.length > this.maxLines) this.monitorLines.shift();
    if (this.monitorEl.style.display !== 'none') {
      this.monitorEl.querySelector('#midi-log').textContent = this.monitorLines.join('\n');
    }
  }

  setStatus(s) {
    const label = s.devices.length ? s.devices.join(', ') : 'no MIDI device';
    for (const el of document.querySelectorAll('.dbg-status')) {
      el.textContent = `${label} · keyboard play ${s.fallbackActive ? 'ON' : 'OFF'} · ${s.text}`;
    }
  }

  // ── DOM construction ────────────────────────────────────────────────
  buildMonitor() {
    const el = document.createElement('div');
    el.className = 'dbg dbg-monitor';
    el.style.display = 'none';
    el.innerHTML = `
      <div class="dbg-title">MIDI MONITOR <span class="dbg-hint">M hides · \` toggles keyboard play</span></div>
      <div class="dbg-status"></div>
      <pre id="midi-log">— waiting for input —</pre>`;
    document.body.appendChild(el);
    return el;
  }

  buildPanel() {
    const el = document.createElement('div');
    el.className = 'dbg dbg-panel';
    el.style.display = 'none';

    const slots = [
      { id: 'keys', label: 'Keys zone (learn channel)' },
      { id: 'joyY', label: 'Joystick Y (birds up/down)' },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `knob:${i}`, label: `Knob K${i + 1}` })),
      ...Array.from({ length: 8 }, (_, i) => ({ id: `pad:A:${i}`, label: `Pad A${i + 1}` })),
      ...Array.from({ length: 8 }, (_, i) => ({ id: `pad:B:${i}`, label: `Pad B${i + 1}` })),
    ];

    el.innerHTML = `
      <div class="dbg-title">DEBUG <span id="dbg-fps"></span> <span class="dbg-hint">D hides</span></div>
      <div class="dbg-status"></div>
      <div class="dbg-section">ACT <span id="dbg-auto"></span></div>
      <div id="dbg-phases">${PHASES.map((p) => `<button data-phase="${p}">${p}</button>`).join('')}</div>
      <div class="dbg-meter-row"><span>ground</span><div class="dbg-meter"><div id="dbg-meter-fullness"></div></div></div>
      <div class="dbg-meter-row"><span>lushness</span><div class="dbg-meter"><div id="dbg-meter-lushness"></div></div></div>
      <div class="dbg-section">MAPPING</div>
      <div class="dbg-learn-hint">click <b>learn</b>, then move that control on the MPK</div>
      <div id="dbg-slots"></div>
      <button id="dbg-reset">reset map to MK3 defaults</button>`;

    for (const btn of el.querySelectorAll('[data-phase]')) {
      btn.addEventListener('click', () => this.state.go(btn.dataset.phase));
    }

    const slotsEl = el.querySelector('#dbg-slots');
    for (const slot of slots) {
      const row = document.createElement('div');
      row.className = 'dbg-slot';
      row.innerHTML = `<span>${slot.label}</span><button>learn</button>`;
      const btn = row.querySelector('button');
      btn.addEventListener('click', () => {
        this.midi.cancelLearn();
        for (const b of slotsEl.querySelectorAll('button')) b.textContent = 'learn';
        btn.textContent = 'listening…';
        this.midi.startLearn(slot.id, (bound) => { btn.textContent = `✓ ${bound}`; });
      });
      slotsEl.appendChild(row);
    }
    el.querySelector('#dbg-reset').addEventListener('click', () => this.midi.resetMap());

    document.body.appendChild(el);
    return el;
  }

  injectStyles() {
    const css = document.createElement('style');
    css.textContent = `
      .dbg {
        position: fixed; z-index: 10; color: #cfe3f5;
        background: rgba(4, 10, 18, 0.82); border: 1px solid rgba(120,160,200,0.25);
        border-radius: 6px; padding: 10px 12px;
        font: 11px/1.5 ui-monospace, Menlo, monospace;
      }
      .dbg-monitor { left: 14px; bottom: 14px; min-width: 520px; }
      .dbg-toast {
        left: 50%; transform: translateX(-50%); bottom: 60px;
        color: #e8c15a; border-color: rgba(232,193,90,0.4); display: none;
      }
      .dbg-panel { right: 14px; top: 14px; width: 300px; max-height: 84vh; overflow-y: auto; }
      .dbg-title { color: #e8c15a; letter-spacing: 0.12em; margin-bottom: 6px; }
      .dbg-hint { color: #6f87a0; float: right; letter-spacing: 0; }
      .dbg-status { color: #8fb7d9; margin-bottom: 6px; }
      .dbg pre { margin: 0; white-space: pre; }
      .dbg-learn-hint { color: #6f87a0; margin-bottom: 6px; }
      .dbg-slot { display: flex; justify-content: space-between; align-items: center; padding: 1px 0; }
      .dbg button {
        background: #12263a; color: #cfe3f5; border: 1px solid rgba(120,160,200,0.35);
        border-radius: 4px; font: inherit; cursor: pointer; padding: 1px 8px;
      }
      .dbg button:hover { background: #1b3a55; }
      .dbg button.dbg-active { background: #e8c15a; color: #10131a; border-color: #e8c15a; }
      .dbg-section { color: #e8c15a; letter-spacing: 0.12em; margin: 10px 0 4px; }
      #dbg-phases { display: flex; gap: 4px; margin-bottom: 6px; }
      #dbg-phases button { flex: 1; padding: 1px 2px; }
      .dbg-meter-row { display: flex; align-items: center; gap: 6px; margin: 3px 0; }
      .dbg-meter-row > span { width: 60px; color: #8fb7d9; }
      .dbg-meter { flex: 1; height: 5px; background: #0d1926; border-radius: 3px; overflow: hidden; }
      .dbg-meter > div { height: 100%; width: 0%; background: linear-gradient(90deg, #1e6fb0, #e8c15a); }
      #dbg-reset { margin-top: 8px; width: 100%; }`;
    document.head.appendChild(css);
  }
}
