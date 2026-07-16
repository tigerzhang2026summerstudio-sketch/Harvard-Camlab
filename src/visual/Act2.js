/**
 * Act2 — "Growing the Jeweled World". The knobs are continuous
 * cultivation: what you raise, stays.
 *
 *   K1 trees · K2 lotus ponds · K3 celestial instruments (+ note-motes)
 *   K4 wind (drifting seeds + the whole paradise sways like a turning
 *   mandala) · K5 warmth · K6 density · K7 bloom · K8 drift speed
 *
 * Layer growth follows the knobs through smoothing, so hardware jumps
 * (or a rehearsal reset) never pop. During the coda every growth value
 * sinks to zero over the fade — the world un-grows.
 */
import { config } from '../config/config.js';
import { GrowthLayer } from './GrowthLayer.js';
import { buildTrees } from './Trees.js';
import { buildPonds } from './Ponds.js';
import { buildInstruments, instrumentCenters } from './Instruments.js';
import { clamp01, lerp, pick, rand } from '../core/Clock.js';

export class Act2 {
  constructor(worldGroup, state, particles, post) {
    this.state = state;
    this.particles = particles;
    this.post = post;
    this.worldGroup = worldGroup;

    this.trees = new GrowthLayer(worldGroup, buildTrees);
    this.ponds = new GrowthLayer(worldGroup, buildPonds);
    this.instruments = new GrowthLayer(worldGroup, buildInstruments);

    this.growth = [0, 0, 0, 0];   // smoothed K1..K4
    this.refine = this.defaultRefine();
    this.windDir = 1;             // joystick X flips the drift
    this.seedTimer = 0;
    this.sparkTimer = 0;
    this.captions = null;                    // set by main
    this.storyTold = [false, false, false, false];

    state.on('phase', ({ phase }) => {
      if (phase === 'prologue') {
        this.refine = this.defaultRefine();
        this.storyTold = [false, false, false, false];
      }
    });
  }

  defaultRefine() {
    return {
      warmth: config.act2.refine.warmthDefault,
      density: 1,
      bloomScale: 1,
      sway: 1,
    };
  }

  onJoystick(e) {
    if (e.axis === 'x' && Math.abs(e.value) > 0.15) this.windDir = Math.sign(e.value);
  }

  /** Map K5–K8 as they arrive (K1–K4 are read continuously in update). */
  onKnob(e) {
    const r = config.act2.refine;
    if (e.index === 4) this.refine.warmth = e.value;
    if (e.index === 5) this.refine.density = lerp(r.densityRange[0], r.densityRange[1], e.value);
    if (e.index === 6) this.refine.bloomScale = lerp(r.bloomRange[0], r.bloomRange[1], e.value);
    if (e.index === 7) this.refine.sway = lerp(r.swayRange[0], r.swayRange[1], e.value);
  }

  update(time, dt, ppwu) {
    const s = this.state;

    // The coda un-grows the world; the prologue holds it at nothing.
    let fade = 1;
    if (s.phase === 'coda') fade = clamp01(1 - s.phaseTime / config.acts.codaFadeSec);
    if (s.phase === 'prologue') fade = 0;

    for (let i = 0; i < 4; i += 1) {
      const target = s.knobs[i] * fade;
      this.growth[i] += (target - this.growth[i]) * Math.min(1, dt * config.act2.smoothing);
    }
    // Each growth knob tells its contemplation the first time it rises.
    for (let i = 0; i < 4; i += 1) {
      if (!this.storyTold[i] && s.phase === 'act2' && this.growth[i] > 0.12) {
        this.storyTold[i] = true;
        const story = config.act2.knobStories[i];
        if (story && this.captions) this.captions.showStory(story[0], story[1]);
      }
    }

    let wind = this.growth[3];
    // Dissolution: as the coda deepens, turbulence rises — the un-growing
    // world sways harder and sheds dandelion-drift while it fades.
    if (s.phase === 'coda') wind = Math.max(wind, (1 - fade) * 0.85);

    // Refinements land on the shared systems.
    this.particles.spawnScale = this.refine.density;
    this.particles.uniforms.uSizeScale.value = lerp(0.85, 1.1, clamp01(this.refine.density));
    this.post.setBloomStrength(config.bloom.strength * this.refine.bloomScale);

    const shared = {
      time,
      ppwu,
      wind,
      sway: this.refine.sway,
      warmth: this.refine.warmth,
      density: this.refine.density,
    };
    this.trees.update(shared, this.growth[0]);
    this.ponds.update(shared, this.growth[1]);
    this.instruments.update(shared, this.growth[2]);

    // K4 — the whole paradise sways like a slowly turning mandala.
    this.worldGroup.rotation.z = Math.sin(time * 0.045) * config.act2.wind.rotMax * wind;

    this.emitWindSeeds(dt, wind);
    this.emitNoteSparks(dt, this.growth[2]);

    return shared; // Act 3's layers reuse the same frame values
  }

  /** K4: dandelion-seed motes set adrift across the panorama. */
  emitWindSeeds(dt, wind) {
    if (wind < 0.05) return;
    this.seedTimer -= dt;
    if (this.seedTimer > 0) return;
    this.seedTimer = config.act2.wind.seedInterval / Math.max(wind, 0.15);

    const W = config.worldWidth;
    const H = config.worldHeight;
    this.particles.burst({
      x: -this.windDir * rand(0.1, 0.5) * W,
      y: rand(-0.32, 0.25) * H,
      color: Math.random() < 0.7 ? config.palette.beryl : config.palette.white,
      count: Math.round(config.act2.wind.seedCount * (0.5 + wind)),
      speed: 14,
      size: 2,
      life: rand(5, 9),
      upBias: 0.5,
      jitter: 60,
      driftX: this.windDir * config.act2.wind.seedSpeed * wind,
    });
  }

  /** K3: rising note-motes from the self-playing instruments. */
  emitNoteSparks(dt, music) {
    if (music < 0.15 || instrumentCenters.length === 0) return;
    this.sparkTimer -= dt;
    if (this.sparkTimer > 0) return;
    this.sparkTimer = 1 / (config.act2.instruments.sparkMaxRate * music);

    const from = pick(instrumentCenters);
    this.particles.burst({
      x: from.x,
      y: from.y + 6,
      color: Math.random() < 0.6 ? config.palette.gold : config.palette.white,
      count: Math.round(rand(6, 14)),
      speed: 16,
      size: 2.4,
      life: rand(3.5, 6),
      upBias: 2.2,   // notes rise
      jitter: 8,
    });
  }
}
