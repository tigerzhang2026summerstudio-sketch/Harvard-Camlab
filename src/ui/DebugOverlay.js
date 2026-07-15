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
export class DebugOverlay {
  constructor(midi) {
    this.midi = midi;
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

    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // While keyboard-play is on, bare letters are notes — require Shift.
      if (this.midi.fallbackActive && !e.shiftKey) return;
      const k = e.key.toLowerCase();
      if (k === 'm') this.toggle(this.monitorEl);
      if (k === 'd') this.toggle(this.panelEl);
    });
  }

  toggle(el) { el.style.display = el.style.display === 'none' ? 'block' : 'none'; }

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
      }
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
      ...Array.from({ length: 8 }, (_, i) => ({ id: `knob:${i}`, label: `Knob K${i + 1}` })),
      ...Array.from({ length: 8 }, (_, i) => ({ id: `pad:A:${i}`, label: `Pad A${i + 1}` })),
      ...Array.from({ length: 8 }, (_, i) => ({ id: `pad:B:${i}`, label: `Pad B${i + 1}` })),
    ];

    el.innerHTML = `
      <div class="dbg-title">DEBUG <span id="dbg-fps"></span> <span class="dbg-hint">D hides</span></div>
      <div class="dbg-status"></div>
      <div class="dbg-learn-hint">click <b>learn</b>, then move that control on the MPK</div>
      <div id="dbg-slots"></div>
      <button id="dbg-reset">reset map to MK3 defaults</button>`;

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
      #dbg-reset { margin-top: 8px; width: 100%; }`;
    document.head.appendChild(css);
  }
}
