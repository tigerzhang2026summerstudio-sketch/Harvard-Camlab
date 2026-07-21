/**
 * AudioManager — Tone.js: the scored background (five tracks, equal-power
 * crossfades on act changes) plus the interactive layers on top:
 *
 *   Act 1  key strikes → pentatonic chime-stone/bell one-shots, quantized
 *          to a slow grid so clusters cascade musically
 *   Act 2  K3 raises a generative self-playing bed (random pentatonic
 *          plucks — "instruments that play themselves")
 *   Act 3  pads → deep gong + slow choir-like swells; grades ring bells
 *          that rise in pitch with the grade
 *
 * Master chain: accents → reverb → limiter → destination; tracks → limiter.
 * Browser autoplay policy: nothing sounds until a click/keypress unlocks
 * the AudioContext (a small chip prompts for it; MIDI alone can't unlock).
 * Missing music files log a warning and the visuals play on unaffected.
 */
import * as Tone from 'tone';
import { config } from '../config/config.js';

const PENTATONIC = [0, 2, 4, 7, 9];

export class AudioManager {
  constructor(state) {
    this.state = state;
    this.unlocked = false;
    this.tracks = {};        // name → { player, gain }
    this.current = null;     // active track name

    this.buildChip();

    state.on('phase', ({ phase }) => this.onPhase(phase));
    state.on('key', (e) => { if (e.on) this.chime(e.note, e.velocity); });
    // Pad stories ring through storyAccent(action) — Act3 resolves which
    // story a pad tells (pad 8 is a sequence) and calls it back.
  }

  /** Called from the corner button's click (a real gesture). Idempotent. */
  async unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.chip.textContent = '♪ …';

    await Tone.start();
    Tone.getDestination().volume.value = config.audio.masterVolumeDb;

    this.buildChain();
    this.buildInstruments();
    await this.loadTracks();

    Tone.getTransport().bpm.value = config.audio.accents.bpm;
    Tone.getTransport().start();
    this.bedLoop.start(0);

    // Fade in whatever phase we are already in.
    this.onPhase(this.state.phase);
    this.ready = true; // clicks during loading are ignored, not queued
    this.refreshChip();
    console.info('[audio] unlocked & running');
  }

  buildChain() {
    const a = config.audio.accents;
    this.limiter = new Tone.Limiter(-3).toDestination();
    this.reverb = new Tone.Reverb({ decay: a.reverbDecaySec, wet: a.reverbWet })
      .connect(this.limiter);
    // The chimes pass through a gentle lowpass so they sit INSIDE the
    // score instead of ringing on top of it.
    this.chimeFilter = new Tone.Filter(a.chimeLowpassHz, 'lowpass').connect(this.reverb);
    this.chimeBus = new Tone.Gain(Tone.dbToGain(a.chimeLevelDb)).connect(this.chimeFilter);
    this.bedBus = new Tone.Gain(Tone.dbToGain(a.bedLevelDb)).connect(this.reverb);
    this.padBus = new Tone.Gain(Tone.dbToGain(a.padLevelDb)).connect(this.reverb);
  }

  buildInstruments() {
    // Chime-stone / small temple bell — softened for unity: lower
    // modulation (less clang), slower attack, longer sustain of tail.
    this.chimeSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 5.07,
      modulationIndex: 7,
      envelope: { attack: 0.006, decay: 2.2, sustain: 0, release: 2.8 },
      modulationEnvelope: { attack: 0.006, decay: 0.3, sustain: 0, release: 0.5 },
      volume: -6,
    }).connect(this.chimeBus);
    this.lastChimeAt = 0; // spacing limiter — flurries thin to a cascade

    // The self-playing layer: soft plucked voice.
    this.pluckSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 2.01,
      modulationIndex: 6,
      envelope: { attack: 0.004, decay: 1.1, sustain: 0, release: 1.4 },
      modulationEnvelope: { attack: 0.004, decay: 0.25, sustain: 0, release: 0.4 },
      volume: -8,
    }).connect(this.bedBus);

    // Deep temple gong for the pads.
    this.gongSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1.4,
      modulationIndex: 18,
      envelope: { attack: 0.004, decay: 5, sustain: 0, release: 6 },
      modulationEnvelope: { attack: 0.004, decay: 1.2, sustain: 0, release: 2 },
      volume: -2,
    }).connect(this.padBus);

    // Wordless-choir-ish swell for the holy figures and the awakening.
    this.choirSynth = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 2,
      envelope: { attack: 2.5, decay: 1, sustain: 0.6, release: 5 },
      modulationEnvelope: { attack: 2.5, decay: 0.5, sustain: 0.4, release: 5 },
      volume: -10,
    }).connect(this.padBus);

    // The dissolution's WIND: brown noise through a swept bandpass whose
    // level follows the coda's three movements (see update()).
    this.windGain = new Tone.Gain(0).connect(this.limiter);
    this.windFilter = new Tone.Filter(500, 'bandpass').connect(this.windGain);
    this.windNoise = new Tone.Noise('brown').connect(this.windFilter);
    this.windNoise.start();

    // The prison's cold DRONE: two low oscillators under a heavy lowpass
    // that lifts when the Buddha arrives (final story line).
    this.droneGain = new Tone.Gain(0).connect(this.limiter);
    this.droneFilter = new Tone.Filter(130, 'lowpass').connect(this.droneGain);
    this.droneOsc1 = new Tone.Oscillator(55, 'sine').connect(this.droneFilter);
    this.droneOsc2 = new Tone.Oscillator(82.5, 'triangle').connect(this.droneFilter);
    this.droneOsc2.volume.value = -9;
    this.droneOsc1.start();
    this.droneOsc2.start();

    // Generative bed: on each half-beat, MAYBE play — density follows K3.
    this.bedLoop = new Tone.Loop((time) => {
      const music = this.state.knobs[2];      // K3
      if (music < 0.05 || Math.random() > music * 0.65) return;
      const deg = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
      const oct = 4 + Math.floor(Math.random() * 2);
      this.pluckSynth.triggerAttackRelease(
        Tone.Frequency(12 * oct + deg + 3, 'midi'), '2n', time,
        0.25 + Math.random() * 0.4,
      );
    }, '8n');
  }

  // ── Score tracks ─────────────────────────────────────────────────────
  async loadTracks() {
    await Promise.all(config.audio.trackNames.map(async (name) => {
      for (const ext of ['mp3', 'ogg', 'wav']) {
        try {
          const buffer = await Tone.ToneAudioBuffer.fromUrl(`/music/${name}.${ext}`);
          const gain = new Tone.Gain(0).connect(this.limiter);
          const player = new Tone.Player(buffer).connect(gain);
          player.loop = true;   // every act can linger; part2 especially
          player.start();
          this.tracks[name] = { player, gain };
          console.info(`[audio] track '${name}' ← ${name}.${ext}`);
          return;
        } catch { /* try the next extension */ }
      }
      console.warn(`[audio] no file for track '${name}' (assets/music/${name}.mp3/.ogg/.wav) — continuing without it`);
    }));
  }

  /**
   * Crossfade to the phase's track. Stone Prison lives ONLY in the
   * prologue/prison scene — every other phase must silence it fully.
   * Plain rampTo (not curve scheduling) so the fade can never be lost
   * to a scheduling exception; each returning track restarts from its
   * top so the score begins fresh, not mid-loop.
   */
  onPhase(phase) {
    if (!this.unlocked) return;
    const name = {
      prologue: 'prologue', prison: 'prologue', act1: 'part1',
      act2: 'part2', act3: 'part3', coda: 'coda', epilogue: 'coda',
    }[phase];
    if (name === this.current) return;
    this.current = name;

    const sec = config.acts.crossfadeSec;
    const now = Tone.now();
    for (const [trackName, { player, gain }] of Object.entries(this.tracks)) {
      const target = trackName === name ? 1 : 0;
      // A track coming back from silence starts again from its top.
      if (target === 1 && gain.gain.value < 0.05) {
        try { player.stop(now); player.start(now); } catch { /* keep playing */ }
      }
      gain.gain.cancelScheduledValues(now);
      gain.gain.rampTo(target, sec);
    }
  }

  /**
   * Per-frame (cheap): the synth beds follow the drama — the storm
   * noise swells and dies with the coda's three movements, the prison
   * drone holds through the opening dark and brightens when the Buddha
   * comes. Both sit far under any real score tracks.
   */
  update() {
    if (!this.unlocked || !this.ready) return;
    const s = this.state;
    const a = config.audio.accents;

    let storm = 0;
    if (s.phase === 'coda') {
      const ct = Math.min(1, s.phaseTime / config.acts.codaFadeSec);
      // matches Act2's visual movements: build, hold through the flood,
      // then collapse to silence with the black.
      storm = ct < 0.2 ? (ct / 0.2) * 0.5
        : ct < 0.62 ? 0.5 + ((ct - 0.2) / 0.42) * 0.5
          : ct < 0.86 ? 1
            : Math.max(0, 1 - (ct - 0.86) / 0.1);
    }
    this.windGain.gain.rampTo(Tone.dbToGain(a.windLevelDb) * storm, 0.3);
    this.windFilter.frequency.rampTo(350 + storm * 950, 0.3);

    const inPrison = s.phase === 'prologue' || s.phase === 'prison';
    this.droneGain.gain.rampTo(inPrison ? Tone.dbToGain(a.droneLevelDb) : 0, 1.5);
    const lifted = s.phase === 'prison' && s.prisonStep >= 5;
    this.droneFilter.frequency.rampTo(lifted ? 420 : 130, 2.5);
  }

  // ── Interactive accents ──────────────────────────────────────────────
  /**
   * Act 1: snap the struck key to a pentatonic chime on the slow grid.
   * UNIFIED with the score: every strike lands in ONE two-octave window
   * of one pentatonic scale (root = config.audio.accents.chimeRoot — set
   * it to the score's key), velocities are compressed, and chimes keep a
   * minimum spacing so fast playing thins to a cascade instead of mud.
   */
  chime(note, velocity) {
    if (!this.unlocked || this.state.phase === 'prologue'
        || this.state.phase === 'prison') return;
    const a = config.audio.accents;
    const now = Tone.now();
    if (now - this.lastChimeAt < a.chimeMinGapSec) return;
    this.lastChimeAt = now;

    const deg = note % 12;
    const snapped = PENTATONIC.reduce((x, b) => (Math.abs(b - deg) < Math.abs(x - deg) ? b : x));
    // Fold the whole keyboard into two octaves: low keys → octave 5,
    // high keys → octave 6. One register, one voice, one scale.
    const oct = note < 60 ? 5 : 6;
    const midi = oct * 12 + snapped + a.chimeRoot;
    const time = Tone.getTransport().nextSubdivision(a.quantize);
    this.chimeSynth.triggerAttackRelease(
      Tone.Frequency(midi, 'midi'), '1n', time, 0.3 + velocity * 0.55,
    );
  }

  /** Act 1: a combo 图案 earns a small flourish above the per-key chimes. */
  comboAccent(family, tier = 1) {
    if (!this.unlocked || this.state.phase === 'prologue') return;
    const now = Tone.now();
    if (family === 'lowHigh') {          // earth + sky: gong below, bell above
      this.gongSynth.triggerAttackRelease('D2', '2n', now, 0.5);
      this.chimeSynth.triggerAttackRelease('A5', '2n', now + 0.35, 0.35);
    } else if (family === 'repeat') {    // the growing mandala climbs with it
      this.chimeSynth.triggerAttackRelease(
        Tone.Frequency(70 + tier * 5, 'midi'), '2n', now, 0.4,
      );
    } else {                             // chord / run: a pentatonic sprinkle
      const root = 72 + config.audio.accents.chimeRoot; // same scale as the chimes
      const n = Math.min(3 + tier, 7);
      for (let i = 0; i < n; i += 1) {
        this.chimeSynth.triggerAttackRelease(
          Tone.Frequency(root + PENTATONIC[i % PENTATONIC.length] + 12 * Math.floor(i / PENTATONIC.length), 'midi'),
          '8n', now + i * 0.13, 0.3,
        );
      }
    }
  }

  /** Act 3: each story rings its own bell/gong/swell. */
  storyAccent(action) {
    if (!this.unlocked || this.state.phase !== 'act3') return;
    const now = Tone.now();

    if (action === 'amitabha' || action === 'awakening') {
      this.gongSynth.triggerAttackRelease('C2', '1m', now, 0.9);
      this.choirSynth.triggerAttackRelease(['C4', 'G4', 'E5'], '1m', now, 0.7);
    } else if (action === 'avalokitesvara' || action === 'mahasthamaprapta') {
      this.gongSynth.triggerAttackRelease('G2', '1m', now, 0.7);
      this.choirSynth.triggerAttackRelease(['G4', 'D5'], '2n', now, 0.55);
    } else if (action === 'sun') {
      this.gongSynth.triggerAttackRelease('D2', '1m', now, 0.6);
      this.choirSynth.triggerAttackRelease(['D4', 'A4'], '1m', now, 0.4);
    } else if (action === 'water') {
      for (let i = 0; i < 4; i += 1) {
        this.chimeSynth.triggerAttackRelease(
          Tone.Frequency(87 - PENTATONIC[i], 'midi'), '4n', now + i * 0.22, 0.3,
        );
      }
    } else if (action === 'groundFreeze') {
      this.gongSynth.triggerAttackRelease('E3', '2n', now, 0.55);
    } else if (action === 'treesStory' || action === 'pondsStory' || action === 'musicStory') {
      for (let i = 0; i < 4; i += 1) {
        this.chimeSynth.triggerAttackRelease(
          Tone.Frequency(63 + PENTATONIC[(i + (action === 'pondsStory' ? 2 : 0)) % PENTATONIC.length] + 12, 'midi'),
          '4n', now + i * 0.2, 0.32,
        );
      }
    } else if (action === 'throne' || action === 'image') {
      this.choirSynth.triggerAttackRelease(['E4', 'B4'], '2n', now, 0.5);
    } else if (action === 'prison') {
      this.gongSynth.triggerAttackRelease('A1', '1m', now, 0.45);
    } else if (action.startsWith('grades')) {
      for (const [i, grade] of (config.act3.gradeGroups[action] ?? []).entries()) {
        this.gongSynth.triggerAttackRelease(
          Tone.Frequency(41 + grade * 3, 'midi'), '2n', now + i * 0.3, 0.5 + grade * 0.04,
        );
      }
    } else if (action === 'universal' || action === 'mixed') {
      for (let i = 0; i < 5; i += 1) {
        const deg = PENTATONIC[i % PENTATONIC.length];
        this.chimeSynth.triggerAttackRelease(
          Tone.Frequency(75 + deg, 'midi'), '4n', now + i * 0.18, 0.35,
        );
      }
    } else if (action === 'dissolution') {
      this.gongSynth.triggerAttackRelease('A1', '1m', now, 1);
    }
  }

  /** Shift + '+' — open the sound (unlocks it the first time). */
  soundOn() {
    if (!this.unlocked) { this.unlock(); return; } // unlock starts unmuted
    if (!this.ready) return;
    Tone.getDestination().mute = false;
    this.refreshChip();
  }

  /** Shift + '-' — close the sound. */
  soundOff() {
    if (!this.unlocked || !this.ready) return; // not unlocked = already silent
    Tone.getDestination().mute = true;
    this.refreshChip();
  }

  toggleMute() {
    const dest = Tone.getDestination();
    dest.mute = !dest.mute;
    this.refreshChip();
    return dest.mute;
  }

  // ── The unlock chip ──────────────────────────────────────────────────
  /**
   * The sound OPTION: an operator control, NOT part of the show. It is
   * hidden by default and only appears while the debug panel is open
   * (D adds body.operator-ui). Clicking it unlocks audio the first time,
   * then toggles mute; Shift + '+' / '−' and '0' work without it showing.
   */
  buildChip() {
    const st = document.createElement('style');
    st.textContent = '#sound-toggle{display:none}'
      + 'body.operator-ui #sound-toggle{display:inline-block}';
    document.head.appendChild(st);

    this.chip = document.createElement('button');
    this.chip.id = 'sound-toggle';
    this.chip.style.cssText = `
      position: fixed; right: 16px; bottom: 16px; z-index: 20;
      padding: 6px 12px; border-radius: 999px; cursor: pointer;
      background: rgba(4,10,18,0.8); border: 1px solid rgba(232,193,90,0.4);
      color: #e8c15a; font: 12px/1.4 ui-monospace, Menlo, monospace;`;
    this.chip.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!this.unlocked) { this.unlock(); return; }
      if (!this.ready) return; // still loading — don't queue toggles
      this.toggleMute();
      this.chip.blur(); // space/enter must stay keys, not re-toggles
    });
    document.body.appendChild(this.chip);
    this.refreshChip();
  }

  refreshChip() {
    if (!this.unlocked) {
      this.chip.textContent = '♪ sound off — click to turn on';
      this.chip.style.opacity = '1';
      return;
    }
    const muted = Tone.getDestination().mute;
    this.chip.textContent = muted ? '♪ sound off' : '♪ sound on';
    this.chip.style.opacity = muted ? '1' : '0.55';
  }
}
