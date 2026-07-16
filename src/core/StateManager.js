/**
 * StateManager — the dramaturgy. Owns the five-phase arc:
 *
 *   prologue → act1 (first key) → act2 (ground fullness) → act3 (lushness)
 *            → coda (pad B8) → …pause… → prologue again (the loop)
 *
 * It receives normalized input from MidiManager, gates/routes it to the
 * active act, tracks progression meters, and emits:
 *
 *   'phase'  {phase, prev}            — on every transition
 *   'key' | 'knob' | 'pad'            — routed events for visual/audio acts
 *
 * It also contains the auto/attract pilot (toggle `A`): when armed and the
 * performer has been idle, it gently plays the whole arc by itself —
 * through the SAME event path as real input, so it exercises everything.
 */
import { config } from '../config/config.js';
import { clamp01, lerp, pick, rand } from './Clock.js';

export const PHASES = ['prologue', 'act1', 'act2', 'act3', 'coda'];

export class StateManager {
  constructor() {
    this.listeners = {};
    this.phase = 'prologue';
    this.phaseTime = 0;

    this.fullness = 0;                    // Act 1 energy meter (0..1)
    this.knobs = new Array(8).fill(0);    // last seen K1..K8 values
    this.autoEnabled = false;             // `A` arms the attract mode
    this.idleTime = Infinity;             // no interaction yet → attract may start
    this.autoWait = 0;                    // countdown to next autopilot action
    this.autoStep = 0;                    // position in the Act-3 pad script
  }

  on(type, cb) {
    (this.listeners[type] ??= new Set()).add(cb);
    return () => this.listeners[type].delete(cb);
  }

  emit(type, payload) {
    this.listeners[type]?.forEach((cb) => cb(payload));
  }

  /** Act 2 lushness = how far the three "growth" knobs have been raised. */
  get lushness() {
    return clamp01(
      (this.knobs[0] + this.knobs[1] + this.knobs[2]) / 3
      / config.acts.act2LushnessTarget,
    );
  }

  go(phase) {
    if (phase === this.phase) return;
    const prev = this.phase;
    this.phase = phase;
    this.phaseTime = 0;
    this.autoStep = 0;
    if (phase === 'prologue') {
      // The vision has dissolved; the next visualization starts from nothing.
      this.fullness = 0;
      this.knobs.fill(0);
    }
    this.emit('phase', { phase, prev });
  }

  reset() { this.go('prologue'); }
  toggleAuto() { this.autoEnabled = !this.autoEnabled; return this.autoEnabled; }

  // ── Input routing (real MIDI and autopilot both come through here) ───
  onKey(e, synthetic = false) {
    this.touch(synthetic);
    if (e.on && this.phase === 'prologue') this.go('act1');
    if (e.on && this.phase === 'act1') {
      this.fullness = clamp01(this.fullness + e.velocity * config.acts.act1EnergyPerStrike);
      if (this.fullness >= config.acts.act1FullnessTarget) this.go('act2');
    }
    this.emit('key', e);
  }

  onKnob(e, synthetic = false) {
    this.touch(synthetic);
    this.knobs[e.index] = e.value;
    if (this.phase === 'act2' && this.lushness >= 1) this.go('act3');
    this.emit('knob', e);
  }

  onPad(e, synthetic = false) {
    this.touch(synthetic);
    // Pad B8 = "begin dissolution" — the performer ends the vision.
    if (e.on && this.phase === 'act3' && e.bank === 'B' && e.index === 7) this.go('coda');
    this.emit('pad', e);
  }

  touch(synthetic) {
    if (!synthetic) this.idleTime = 0; // real hands pause the autopilot
  }

  // ── Per-frame ────────────────────────────────────────────────────────
  update(dt) {
    this.phaseTime += dt;
    this.idleTime += dt;

    // Coda runs on a timer: dissolve, hold black, then the loop returns.
    if (this.phase === 'coda'
        && this.phaseTime >= config.acts.codaFadeSec + config.acts.loopPauseSec) {
      this.go('prologue');
    }

    if (this.autoEnabled && this.idleTime >= config.acts.autoIdleSec) {
      this.autopilot(dt);
    }
  }

  /** The attract-mode performer: unhurried, a little random, never idle. */
  autopilot(dt) {
    this.autoWait -= dt;
    if (this.autoWait > 0) return;

    switch (this.phase) {
      case 'prologue': {
        this.onKey({ on: true, note: 52, velocity: 0.5 }, true);
        this.autoWait = rand(1.5, 3);
        break;
      }
      case 'act1': {
        // Pentatonic wandering, soft-to-medium strikes.
        const note = 48 + pick([0, 2, 4, 7, 9]) + pick([0, 12]);
        this.onKey({ on: true, note, velocity: rand(0.35, 0.85) }, true);
        this.autoWait = rand(0.3, 1.2);
        break;
      }
      case 'act2': {
        // Raise the growth knobs toward full, brush the refinement knobs.
        const index = Math.random() < 0.8 ? pick([0, 1, 2, 3]) : pick([4, 5, 6, 7]);
        const target = index <= 3 ? 1 : rand(0.3, 0.7);
        this.onKnob({ index, value: clamp01(lerp(this.knobs[index], target, 0.12) + 0.01) }, true);
        this.autoWait = rand(0.15, 0.45);
        break;
      }
      case 'act3': {
        // The assembly, in order; then blossom rain, awakening, dissolution.
        const script = [
          { bank: 'A', index: 0, wait: 4 },   // Amitāyus
          { bank: 'A', index: 1, wait: 2.5 }, // Avalokiteśvara
          { bank: 'A', index: 2, wait: 3 },   // Mahāsthāmaprāpta
          { bank: 'A', index: 3, wait: 1.5 }, // nine grades of rebirth…
          { bank: 'A', index: 5, wait: 1.5 },
          { bank: 'A', index: 7, wait: 1.5 },
          { bank: 'B', index: 1, wait: 1.5 },
          { bank: 'B', index: 3, wait: 2.5 },
          { bank: 'B', index: 4, wait: 4 },   // blossom rain
          { bank: 'B', index: 5, wait: 8 },   // Vaidehī's awakening — long hold
          { bank: 'B', index: 7, wait: 2 },   // dissolution → coda
        ];
        const step = script[Math.min(this.autoStep, script.length - 1)];
        this.onPad({ on: true, bank: step.bank, index: step.index, velocity: 0.8 }, true);
        this.onPad({ on: false, bank: step.bank, index: step.index, velocity: 0 }, true);
        this.autoStep += 1;
        this.autoWait = step.wait;
        break;
      }
      default: // coda — hands off, the timer brings the loop around
        this.autoWait = 1;
    }
  }
}
