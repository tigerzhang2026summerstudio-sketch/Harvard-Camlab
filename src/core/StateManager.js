/**
 * StateManager — the dramaturgy. Owns the seven-phase arc:
 *
 *   prologue → prison (first key: Vaidehī's story, key-paced)
 *            → act1 (story told) → act2 (ground full + soft minimum)
 *            → act3 (lushness + soft minimum) → coda (dissolution pad)
 *            → epilogue (one lotus in the dark) → …pause… → prologue
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

export const PHASES = ['prologue', 'prison', 'act1', 'act2', 'act3', 'coda', 'epilogue'];

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
    this.prisonStep = 0;                  // which line of Vaidehī's story
    this.prisonLineAt = 0;                // phaseTime the line appeared
  }

  on(type, cb) {
    (this.listeners[type] ??= new Set()).add(cb);
    return () => this.listeners[type].delete(cb);
  }

  emit(type, payload) {
    this.listeners[type]?.forEach((cb) => cb(payload));
  }

  /** Act 2 lushness — 1 only when EVERY dial has passed its target. */
  get lushness() {
    const t = config.acts.act2DialTarget;
    let sum = 0;
    for (const k of this.knobs) sum += Math.min(1, k / t);
    return clamp01(sum / this.knobs.length);
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
    } else if (phase === 'act2' || phase === 'act3') {
      // Whether reached by playing or by a rehearsal jump, these acts stand
      // on a finished ground.
      this.fullness = Math.max(this.fullness, 1);
    }
    this.emit('phase', { phase, prev });
    if (phase === 'prison') {
      this.prisonStep = 0;
      this.prisonLineAt = 0;
      this.emit('prisonLine', { index: 0 });
    }
  }

  /** Next line of the prison story; the last line opens Act I. */
  prisonAdvance() {
    this.prisonLineAt = this.phaseTime;
    this.prisonStep += 1;
    if (this.prisonStep >= config.prison.lines.length) this.go('act1');
    else this.emit('prisonLine', { index: this.prisonStep });
  }

  reset() { this.go('prologue'); }
  toggleAuto() { this.autoEnabled = !this.autoEnabled; return this.autoEnabled; }

  // ── Input routing (real MIDI and autopilot both come through here) ───
  onKey(e, synthetic = false) {
    this.touch(synthetic);
    if (e.on && this.phase === 'prologue') this.go('prison');
    else if (e.on && this.phase === 'prison') {
      // Keys pace the story — debounced so a chord doesn't skip lines.
      if (this.phaseTime - this.prisonLineAt > 1.2) this.prisonAdvance();
    }
    if (e.on && this.phase === 'act1') {
      this.fullness = clamp01(this.fullness + e.velocity * config.acts.act1EnergyPerStrike);
      // (act1 → act2 is checked per-frame in update(): the meter AND the
      //  act's soft minimum runtime both have to be satisfied.)
    }
    this.emit('key', e);
  }

  onKnob(e, synthetic = false) {
    this.touch(synthetic);
    this.knobs[e.index] = e.value;
    // NOTE: the act2→act3 transition is checked per-frame in update(),
    // not here — checking only on knob events missed the case where the
    // dials were finished quickly (or early) and then left alone.
    this.emit('knob', e);
  }

  onPad(e, synthetic = false) {
    this.touch(synthetic);
    // The dissolution pad (see config.act3.padMap) ends the vision — but
    // not before Act III has had its soft-minimum runtime.
    const action = config.act3.padMap[`${e.bank}${e.index + 1}`];
    if (e.on && this.phase === 'act3' && action === 'dissolution'
        && this.phaseTime >= config.acts.act3MinSec) {
      this.go('coda');
    }
    this.emit('pad', e);
  }

  touch(synthetic) {
    if (!synthetic) this.idleTime = 0; // real hands pause the autopilot
  }

  // ── Per-frame ────────────────────────────────────────────────────────
  update(dt) {
    this.phaseTime += dt;
    this.idleTime += dt;

    // The prison story advances itself if no key hurries it along.
    if (this.phase === 'prison'
        && this.phaseTime - this.prisonLineAt >= config.prison.lineSec) {
      this.prisonAdvance();
    }

    // Act 1 → Act 2: the ground is full AND the act has had its minimum.
    // FAILSAFE: a long act with a half-flooded ground advances anyway —
    // the installation must never stall on a soft-playing visitor.
    if (this.phase === 'act1'
        && ((this.phaseTime >= config.acts.act1MinSec
          && this.fullness >= config.acts.act1FullnessTarget)
        || (this.phaseTime >= config.acts.act1FailsafeSec
          && this.fullness >= 0.4))) {
      this.fullness = Math.max(this.fullness, 1);
      this.go('act2');
    }

    // Act 2 → Act 3 whenever every dial stands past its target — checked
    // continuously so it can never be missed, with a dwell so the act
    // always gets its moment even if the dials were finished early.
    if (this.phase === 'act2'
        && this.phaseTime >= config.acts.act2MinSec
        && this.lushness >= 1) {
      this.go('act3');
    }

    // Coda dissolves on a timer, then the epilogue: one lotus remains.
    if (this.phase === 'coda'
        && this.phaseTime >= config.acts.codaFadeSec + 3) {
      this.go('epilogue');
    }
    if (this.phase === 'epilogue'
        && this.phaseTime >= config.acts.epilogueSec + config.acts.loopPauseSec) {
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
      case 'prison': {
        // Rare, soft strikes — the auto-advance timer paces the story.
        this.onKey({ on: true, note: 45 + pick([0, 3, 7]), velocity: 0.3 }, true);
        this.autoWait = rand(8, 11);
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
        // All eight dials must be finished before the throne will rise —
        // favor whichever is furthest behind.
        let index = Math.floor(Math.random() * 8);
        for (let i = 0; i < 8; i += 1) if (this.knobs[i] < this.knobs[index]) index = i;
        if (Math.random() < 0.35) index = Math.floor(Math.random() * 8);
        this.onKnob({ index, value: clamp01(lerp(this.knobs[index], 1, 0.12) + 0.01) }, true);
        this.autoWait = rand(0.15, 0.4);
        break;
      }
      case 'act3': {
        // The sixteen contemplations exactly as a performer with eight
        // pads plays them: 1–7, then pad 8 again and again to continue
        // the sutra through to the dissolution.
        const script = [
          { bank: 'A', index: 0, wait: 10 },  // 一 the setting sun
          { bank: 'A', index: 1, wait: 7 },   // 二 water & ice
          { bank: 'A', index: 2, wait: 7 },   // 三 the beryl ground
          { bank: 'A', index: 3, wait: 6 },   // 四 the jeweled trees
          { bank: 'A', index: 4, wait: 6 },   // 五 the ponds
          { bank: 'A', index: 5, wait: 6 },   // 六 the towers of music
          { bank: 'A', index: 6, wait: 7 },   // 七 the lotus throne
          { bank: 'A', index: 7, wait: 8 },   // pad 8 → 八 the image
          { bank: 'A', index: 7, wait: 8 },   //       → 九 the true body
          { bank: 'A', index: 7, wait: 6 },   //       → 十 Avalokiteśvara
          { bank: 'A', index: 7, wait: 7 },   //       → 十一 Mahāsthāmaprāpta
          { bank: 'A', index: 7, wait: 9 },   //       → 十二 universal vision
          { bank: 'A', index: 7, wait: 8 },   //       → 十三 the mixed vision
          { bank: 'A', index: 7, wait: 5 },   //       → 十四 highest rebirths
          { bank: 'A', index: 7, wait: 5 },   //       → 十五 middle rebirths
          { bank: 'A', index: 7, wait: 6 },   //       → 十六 lowest rebirths
          { bank: 'A', index: 7, wait: 12 },  //       → awakening — long hold
          { bank: 'A', index: 7, wait: 2 },   //       → dissolution → coda
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
