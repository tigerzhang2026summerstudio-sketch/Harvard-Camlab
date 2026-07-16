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
    state.on('pad', (e) => { if (e.on) this.padAccent(e); });
  }

  /** Call from any real user gesture (click / keydown). Idempotent. */
  async unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.chip.remove();

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
    console.info('[audio] unlocked & running');
  }

  buildChain() {
    const a = config.audio.accents;
    this.limiter = new Tone.Limiter(-3).toDestination();
    this.reverb = new Tone.Reverb({ decay: a.reverbDecaySec, wet: a.reverbWet })
      .connect(this.limiter);
    this.chimeBus = new Tone.Gain(Tone.dbToGain(a.chimeLevelDb)).connect(this.reverb);
    this.bedBus = new Tone.Gain(Tone.dbToGain(a.bedLevelDb)).connect(this.reverb);
    this.padBus = new Tone.Gain(Tone.dbToGain(a.padLevelDb)).connect(this.reverb);
  }

  buildInstruments() {
    // Chime-stone / small temple bell: FM with high harmonicity rings true.
    this.chimeSynth = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 5.07,
      modulationIndex: 14,
      envelope: { attack: 0.002, decay: 1.6, sustain: 0, release: 2.2 },
      modulationEnvelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.6 },
      volume: -4,
    }).connect(this.chimeBus);

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

  /** Equal-power crossfade to the phase's track. */
  onPhase(phase) {
    if (!this.unlocked) return;
    const name = { prologue: 'prologue', act1: 'part1', act2: 'part2', act3: 'part3', coda: 'coda' }[phase];
    if (name === this.current) return;
    this.current = name;

    const sec = config.acts.crossfadeSec;
    const now = Tone.now();
    const steps = 32;
    for (const [trackName, { gain }] of Object.entries(this.tracks)) {
      const from = gain.gain.value;
      const to = trackName === name ? 1 : 0;
      if (Math.abs(from - to) < 0.001) continue;
      // cos/sin curve — the pair keeps summed power constant mid-fade
      const curve = new Float32Array(steps);
      for (let i = 0; i < steps; i += 1) {
        const t = i / (steps - 1);
        curve[i] = from + (to - from) * Math.sin(t * Math.PI / 2);
      }
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueCurveAtTime(curve, now, sec);
      } catch {
        gain.gain.rampTo(to, sec);
      }
    }
  }

  // ── Interactive accents ──────────────────────────────────────────────
  /** Act 1: snap the struck key to a pentatonic chime on the slow grid. */
  chime(note, velocity) {
    if (!this.unlocked || this.state.phase === 'prologue') return;
    const oct = Math.floor(note / 12);
    const deg = note % 12;
    const snapped = PENTATONIC.reduce((a, b) => (Math.abs(b - deg) < Math.abs(a - deg) ? b : a));
    const midi = Math.min(96, (oct + 1) * 12 + snapped + 3); // brighten a octave, key of D#-penta
    const time = Tone.getTransport().nextSubdivision(config.audio.accents.quantize);
    this.chimeSynth.triggerAttackRelease(
      Tone.Frequency(midi, 'midi'), '1n', time, 0.2 + velocity * 0.8,
    );
  }

  /** Act 3: pads ring the deep world. */
  padAccent(e) {
    if (!this.unlocked || this.state.phase !== 'act3') return;
    const action = config.act3.padMap[`${e.bank}${e.index + 1}`] ?? '';
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

  toggleMute() {
    const dest = Tone.getDestination();
    dest.mute = !dest.mute;
    return dest.mute;
  }

  // ── The unlock chip ──────────────────────────────────────────────────
  buildChip() {
    this.chip = document.createElement('div');
    this.chip.textContent = '♪ click or press any key to enable sound';
    this.chip.style.cssText = `
      position: fixed; right: 16px; bottom: 16px; z-index: 20;
      padding: 6px 12px; border-radius: 999px;
      background: rgba(4,10,18,0.8); border: 1px solid rgba(232,193,90,0.4);
      color: #e8c15a; font: 12px/1.4 ui-monospace, Menlo, monospace;
      pointer-events: none;`;
    document.body.appendChild(this.chip);
  }
}
