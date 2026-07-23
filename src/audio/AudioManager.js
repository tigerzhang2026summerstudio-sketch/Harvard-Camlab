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
    state.on('key', (e) => { if (e.on) this.keyDrum(e.note, e.velocity); });
    // Pad stories ring through storyAccent(action) — Act3 resolves which
    // story a pad tells (pad 8 is a sequence) and calls it back.
  }

  /** Called from the corner button's click (a real gesture). Idempotent. */
  async unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    this.chip.textContent = '♪ …';

    await Tone.start();
    // Tighten the scheduler so struck drums answer the hand promptly (the
    // grid quantize used to add up to a beat of lag; keyDrum now fires at
    // Tone.now(), and a smaller lookAhead trims the remaining latency).
    Tone.getContext().lookAhead = 0.04;
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
    // Act 1 drums get their own bus — straight to the reverb, no chime
    // lowpass, so the skin attack keeps its punch.
    this.drumBus = new Tone.Gain(Tone.dbToGain(a.drumLevelDb)).connect(this.reverb);
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

    // ── Act 1 DRUMS — a traditional Chinese percussion ensemble ───────
    // The keys play a whole 鼓乐 kit, not one voice:
    //   排鼓 (paigu)  — the tuned drum body: a pitched membrane, defined
    //                   pitch (low pitchDecay) so chords read as a melody.
    //   板鼓 (bangu)  — a dry, sharp wooden crack for the attack.
    //   大鼓 (dagu)   — a deep barrel-drum boom under low/hard strikes.
    //   锣 (gong)     — a temple gong crowning the hardest hits (reused).
    // Poly so fast playing rolls instead of choking.
    this.drumSynth = new Tone.PolySynth(Tone.MembraneSynth, {
      maxPolyphony: 8,
      pitchDecay: 0.025,   // settle to pitch fast → tonal tuned drum
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 1.0 },
      volume: -3,
    }).connect(this.drumBus);
    this.drumSkin = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0 },
      volume: config.audio.accents.drumSkinDb,
    }).connect(this.drumBus);
    // 大鼓 — deep barrel drum. Mono is fine: it only sounds on low/hard hits.
    this.bigDrum = new Tone.MembraneSynth({
      pitchDecay: 0.08, octaves: 6,
      envelope: { attack: 0.001, decay: 0.7, sustain: 0, release: 1.1 },
      volume: -4,
    }).connect(this.drumBus);
    // 板鼓 — a dry, high wooden crack: a very short high-passed noise slap.
    this.banguFilter = new Tone.Filter(2400, 'highpass').connect(this.drumBus);
    this.bangu = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.0004, decay: 0.03, sustain: 0 },
      volume: -13,
    }).connect(this.banguFilter);
    this.lastDrumAt = 0;   // real-time throttle (min gap between hits)
    this.lastDrumTime = 0; // scheduled audio time — kept strictly rising
    this.lastGongAt = 0;   // temple-gong accent spacing

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

    // The intro flight's WIND: pink noise through a bandpass whose level
    // and brightness track airspeed/altitude, then CUT to silence at the
    // threshold (see introAudio). Separate from the coda's storm wind so
    // neither ever steps on the other.
    this.flightWindGain = new Tone.Gain(0).connect(this.limiter);
    this.flightWindFilter = new Tone.Filter(240, 'bandpass').connect(this.flightWindGain);
    this.flightWindNoise = new Tone.Noise('pink').connect(this.flightWindFilter);
    this.flightWindNoise.start();

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
      intro: 'intro', prologue: 'prologue', prison: 'prologue', act1: 'part1',
      act2: 'part2', act3: 'part3', coda: 'coda', epilogue: 'coda',
    }[phase];
    // Re-arm the flight's intro→prologue crossfade each time we enter it.
    if (phase === 'intro') this.introToPrologue = false;
    if (name === this.current) return;
    this.current = name;

    // Prologue → Act I is eased over a longer fade (it was too abrupt);
    // every other change uses the normal crossfade.
    const sec = name === 'part1'
      ? (config.acts.crossfadeIntoAct1Sec ?? config.acts.crossfadeSec)
      : config.acts.crossfadeSec;
    const now = Tone.now() + 0.02;
    // EQUAL-POWER crossfade: the incoming track follows sin, the outgoing
    // cos, so sin²+cos²=1 — the perceived loudness stays constant with no
    // dip or bump through the middle. Clean, every transition.
    const N = 48;
    for (const [trackName, { player, gain }] of Object.entries(this.tracks)) {
      const to = trackName === name ? 1 : 0;
      const from = Math.max(0, Math.min(1, gain.gain.value));
      // A track coming back from silence restarts from its top.
      if (to === 1 && from < 0.05) {
        try { player.stop(now); player.start(now); } catch { /* keep playing */ }
      }
      const curve = new Float32Array(N);
      for (let i = 0; i < N; i += 1) {
        const u = i / (N - 1);
        curve[i] = to === 1
          ? Math.sin(u * Math.PI / 2)        // 0 → 1, equal power
          : from * Math.cos(u * Math.PI / 2); // from → 0, equal power
      }
      gain.gain.cancelScheduledValues(now);
      try {
        gain.gain.setValueCurveAtTime(curve, now, sec);
      } catch {
        gain.gain.rampTo(to, sec); // fallback if the curve API is unavailable
      }
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

    // Off the flight (skip/abort/handoff), the flight wind is silent —
    // introAudio drives it only while the intro is live.
    if (s.phase !== 'intro') this.flightWindGain.gain.rampTo(0, 0.3);
  }

  /**
   * Per frame during the intro flight (called by IntroFlight). Drives:
   *   · the wind bed — level+brightness follow airspeed and nearness to
   *     the ground, then CUT hard to interior silence at the threshold;
   *   · the intro→prologue crossfade across beats 9–10, so the score is
   *     already underway when the prologue's darkness arrives.
   * mode 'attract' | 'flight'; t = flight seconds; speed01/alt01 ∈ [0,1].
   */
  introAudio(mode, t, speed01, alt01) {
    if (!this.unlocked || !this.ready) return;
    const ia = config.intro.audio;
    const flying = mode === 'flight';

    // ── Wind ──────────────────────────────────────────────────────────
    const indoors = flying && t >= ia.thresholdCutSec; // beat 8 onward
    let wind = 0;
    let hz = ia.windMinHz;
    if (flying && !indoors) {
      wind = speed01 * (0.45 + 0.55 * (1 - alt01)); // airspeed × ground-rush
      // A stronger high-air wind at the very start (suspended over the
      // cloud sea), tapering out over the opening seconds into the normal
      // airspeed-driven wind.
      const startFloor = (ia.windStartFloor ?? 0)
        * Math.max(0, 1 - t / (ia.windStartFadeSec ?? 1));
      wind = Math.max(wind, startFloor);
      hz = ia.windMinHz + (ia.windMaxHz - ia.windMinHz) * Math.max(speed01, startFloor * 0.5);
    }
    // The cut is HARD (0.04s) — do not crossfade it; that abruptness is
    // the sound of crossing indoors.
    this.flightWindGain.gain.rampTo(
      indoors ? 0 : Tone.dbToGain(ia.windMaxDb) * wind, indoors ? 0.04 : 0.25,
    );
    this.flightWindFilter.frequency.rampTo(hz, 0.25);

    // ── intro → prologue crossfade (beats 9–10) ──────────────────────
    const intro = this.tracks.intro;       // { player, gain } (gain = node)
    const prologue = this.tracks.prologue;
    let introLvl = 1; // full through attract + flight, until the crossfade
    let proLvl = 0;
    if (flying && t >= ia.toPrologueSec) {
      const k = Math.min(1, (t - ia.toPrologueSec) / (config.intro.durationSec - ia.toPrologueSec));
      introLvl = 1 - k;
      proLvl = k;
      if (!this.introToPrologue) {
        // the prologue score begins from its top as it first rises
        this.introToPrologue = true;
        this.current = 'prologue'; // so onPhase('prologue') won't re-fire
        try { prologue?.player.stop(); prologue?.player.start(); } catch { /* keep playing */ }
      }
    }
    if (intro) intro.gain.gain.rampTo(introLvl, 0.2);
    if (prologue) prologue.gain.gain.rampTo(proLvl, 0.2);

    // Last computed targets (for the D overlay / tests — ramps chase these).
    this.introDbg = {
      wind: indoors ? 0 : +(Tone.dbToGain(ia.windMaxDb) * wind).toFixed(4),
      hz: Math.round(hz), intro: +introLvl.toFixed(3), prologue: +proLvl.toFixed(3),
    };
  }

  // ── Interactive accents ──────────────────────────────────────────────
  /**
   * Act 1: every struck key is a TUNED DRUM hit (taiko/tabla). The note
   * is snapped into ONE pentatonic scale (root = accents.chimeRoot) and
   * folded into two low drum octaves, so playing the keyboard plays a
   * drum melody; velocity drives the hit; hits quantize to the slow grid
   * so the playing — hand or autopilot — reads as a groove, not noise.
   */
  keyDrum(note, velocity) {
    if (!this.unlocked || this.state.phase === 'prologue'
        || this.state.phase === 'prison') return;
    const a = config.audio.accents;
    const now = Tone.now();
    if (now - this.lastDrumAt < a.drumMinGapSec) return;
    this.lastDrumAt = now;

    const deg = note % 12;
    const snapped = PENTATONIC.reduce((x, b) => (Math.abs(b - deg) < Math.abs(x - deg) ? b : x));
    // low keys → a deep drum (octave 2), high keys → a tighter one (octave 3)
    const oct = note < 60 ? 2 : 3;
    const midi = oct * 12 + snapped + a.chimeRoot;
    // Fire IMMEDIATELY — no grid quantize (that delay read as latency). Keep
    // the scheduled time strictly increasing so stacked hits never double-
    // book a mono voice inside one audio block.
    let time = Tone.now();
    if (time <= this.lastDrumTime) time = this.lastDrumTime + 0.004;
    this.lastDrumTime = time;
    const level = 0.45 + velocity * 0.55;

    // 排鼓 — the tuned drum body (the melodic voice of the keys)
    this.drumSynth.triggerAttackRelease(Tone.Frequency(midi, 'midi'), '8n', time, level);
    // 板鼓 — a dry wooden crack on the attack
    this.bangu.triggerAttackRelease('32n', time, 0.4 + velocity * 0.5);
    // the skin transient, folded quietly into the ensemble
    this.drumSkin.triggerAttackRelease('16n', time, 0.22 + velocity * 0.4);
    // 大鼓 — a deep barrel-drum boom under low keys or hard strikes
    if (note < 60 || velocity > 0.72) {
      this.bigDrum.triggerAttackRelease(
        Tone.Frequency(24 + snapped, 'midi'), '4n', time, 0.5 + velocity * 0.4,
      );
    }
    // 锣 — a temple gong crowns the hardest strikes, spaced out
    if (velocity > 0.85 && Tone.now() - this.lastGongAt > 1.2) {
      this.lastGongAt = Tone.now();
      this.gongSynth.triggerAttackRelease('D2', '2n', time, 0.32);
    }
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
