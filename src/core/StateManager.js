/**
 * StateManager — the dramaturgy. Owns the eight-phase arc:
 *
 *   intro (attract screen → the flight into Cave 217, on rails)
 *        → prologue → prison (first key: Vaidehī's story, key-paced)
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

export const PHASES = ['intro', 'prologue', 'prison', 'act1', 'act2', 'act3', 'coda', 'epilogue'];

export class StateManager {
  constructor() {
    this.listeners = {};
    this.phase = config.intro.enabled ? 'intro' : 'prologue';
    this.phaseTime = 0;

    // Intro sub-state: the attract screen waits; the flight is on rails.
    this.introMode = 'attract';   // 'attract' | 'flight'
    this.introTime = 0;           // seconds into the flight
    this.introHolding = false;    // a key is currently held (skip gesture)
    this.introHold = 0;           // how long it has been held

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
    if (phase === 'prologue' || phase === 'intro') {
      // The vision has dissolved; the next visualization starts from nothing.
      this.fullness = 0;
      this.knobs.fill(0);
      if (phase === 'intro') this.setIntroMode('attract');
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

  reset() { this.go(config.intro.enabled ? 'intro' : 'prologue'); }
  toggleAuto() { this.autoEnabled = !this.autoEnabled; return this.autoEnabled; }

  // ── Intro sub-state (attract ⇄ flight → prologue) ────────────────────
  setIntroMode(mode) {
    if (mode === this.introMode) return;
    this.introMode = mode;
    this.introTime = 0;
    this.introHolding = false;
    this.introHold = 0;
    this.emit('introMode', { mode });
  }

  /** Attract → the flight lifts off (any key/pad, Space, or autopilot). */
  introLaunch() {
    if (this.phase !== 'intro' || this.introMode === 'flight') return;
    this.setIntroMode('flight');
  }

  /** Esc during the flight — back to the waiting attract screen. */
  introAbort() {
    if (this.phase !== 'intro') return;
    this.setIntroMode('attract');
  }

  /** A held key (holdToSkipSec) jumps straight to the prologue. */
  introSkip() {
    if (this.phase !== 'intro') return;
    this.go('prologue');
  }

  /** IntroFlight calls this when beat 10 fades — the normal handoff. */
  introComplete() {
    if (this.phase !== 'intro' || this.introMode !== 'flight') return;
    this.go('prologue');
  }

  /**
   * The intro consumes ALL performer input: in attract any press
   * launches; in flight a press only arms the hold-to-skip gesture.
   * Returns true so the routers don't emit to the acts.
   */
  introInput(on) {
    if (this.introMode === 'attract') {
      if (on) this.introLaunch();
    } else if (on) {
      this.introHolding = true;
      this.introHold = 0;
    } else {
      this.introHolding = false;
      this.introHold = 0;
    }
    return true;
  }

  // ── Input routing (real MIDI and autopilot both come through here) ───
  onKey(e, synthetic = false) {
    this.touch(synthetic);
    if (this.phase === 'intro') { this.introInput(e.on); return; }
    if (e.on && this.phase === 'prologue') this.go('prison');
    // (In the prison the story keeps its OWN pace — lines advance only
    //  on the lineSec timer, no matter how the keys are played.)
    if (e.on && this.phase === 'act1') {
      this.fullness = clamp01(this.fullness + e.velocity * config.acts.act1EnergyPerStrike);
      // (act1 → act2 is checked per-frame in update(): the meter AND the
      //  act's soft minimum runtime both have to be satisfied.)
    }
    this.emit('key', e);
  }

  onKnob(e, synthetic = false) {
    this.touch(synthetic);
    if (this.phase === 'intro') return; // the flight is on rails — no dials
    this.knobs[e.index] = e.value;
    // NOTE: the act2→act3 transition is checked per-frame in update(),
    // not here — checking only on knob events missed the case where the
    // dials were finished quickly (or early) and then left alone.
    this.emit('knob', e);
  }

  onPad(e, synthetic = false) {
    this.touch(synthetic);
    if (this.phase === 'intro') { this.introInput(e.on); return; }
    // Act 3 runs as a fixed rite (any pad advances it, in order) — the
    // dissolution is reached only THROUGH the rite, so no pad shortcuts
    // the phase here; Act3 calls go('coda') itself at the rite's end.
    this.emit('pad', e);
  }

  touch(synthetic) {
    if (!synthetic) this.idleTime = 0; // real hands pause the autopilot
  }

  // ── Per-frame ────────────────────────────────────────────────────────
  update(dt) {
    this.phaseTime += dt;
    this.idleTime += dt;

    // The intro flight: hold-any-key skips; a failsafe ends the flight
    // even if IntroFlight never calls introComplete (the show can't hang
    // on its own front door).
    if (this.phase === 'intro' && this.introMode === 'flight') {
      this.introTime += dt;
      if (this.introHolding) {
        this.introHold += dt;
        if (this.introHold >= config.intro.holdToSkipSec) this.introSkip();
      }
      if (this.introTime >= config.intro.durationSec + 4) this.introComplete();
    }

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
      // The loop comes back around to the front door: the attract screen
      // waits for the next audience (or straight to the prologue when the
      // intro is disabled).
      this.go(config.intro.enabled ? 'intro' : 'prologue');
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
      case 'intro': {
        // Attract: lift off. In flight: hands folded — it's on rails.
        if (this.introMode === 'attract') this.introLaunch();
        this.autoWait = 2;
        break;
      }
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
        // The rite advances itself: any pad carries it one vision
        // onward, and Act3's busy-gating enforces the pacing — early
        // presses simply wait their turn.
        const index = Math.floor(Math.random() * 8);
        this.onPad({ on: true, bank: 'A', index, velocity: 0.8 }, true);
        this.onPad({ on: false, bank: 'A', index, velocity: 0 }, true);
        this.autoWait = rand(10, 13);
        break;
      }
      default: // coda — hands off, the timer brings the loop around
        this.autoWait = 1;
    }
  }
}
