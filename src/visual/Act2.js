/**
 * Act2 — "Growing the Jeweled World". Every dial is continuous
 * cultivation and grows its own part of the story:
 *
 *   K1 trees · K2 lotus ponds · K3 celestial instruments (+ note-motes)
 *   K4 wind (drifting seeds + the whole paradise sways like a turning
 *   mandala) · K5 kalavinka birds with light-trails · K6 rays of light
 *   (also gilds + swells the glow) · K7 jeweled banners · K8 clouds of
 *   light (also quickens the world's drift)
 *
 * Layer growth follows the dials through smoothing, so hardware jumps
 * (or a rehearsal reset) never pop. During the coda every growth value
 * sinks to zero over the fade — the world un-grows.
 */
import { config } from '../config/config.js';
import { GrowthLayer } from './GrowthLayer.js';
import { buildTrees } from './Trees.js';
import { buildPonds } from './Ponds.js';
import { buildInstruments, instrumentCenters } from './Instruments.js';
import { buildRays, buildBanners, buildClouds, BirdFlock } from './SkyLayers.js';
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
    this.rays = new GrowthLayer(worldGroup, buildRays, { intensity: 1.0 });
    this.banners = new GrowthLayer(worldGroup, buildBanners, { intensity: 1.1 });
    this.clouds = new GrowthLayer(worldGroup, buildClouds, { intensity: 0.9 });
    this.birds = new BirdFlock(particles);

    this.growth = new Array(8).fill(0);   // smoothed K1..K8
    this.windDir = 1;                     // joystick X flips the drift
    this.seedTimer = 0;
    this.sparkTimer = 0;
    this.gustAcc = 0;                     // coda windstorm emission
    this.captions = null;                 // set by main
    this.storyTold = new Array(8).fill(false);

    state.on('phase', ({ phase }) => {
      if (phase === 'prologue') this.storyTold = new Array(8).fill(false);
    });
  }

  onJoystick(e) {
    if (e.axis === 'x' && Math.abs(e.value) > 0.15) this.windDir = Math.sign(e.value);
  }

  /** Dial values are read continuously; here we only guard the acts. */
  onKnob(e) {
    void e;
    // Strict acts: turned during Act I, a dial only whispers a hint.
    if (this.state.phase === 'act1' && this.captions) {
      const now = performance.now();
      if (now - (this.lockHintAt ?? -1e9) > 8000) {
        this.lockHintAt = now;
        this.captions.show(config.captions.dialsLocked);
      }
    }
  }

  update(time, dt, ppwu) {
    const s = this.state;

    // The coda un-grows the world; the prologue holds it at nothing.
    // Strict acts: the world does not grow before Act II arrives.
    let fade = 1;
    if (s.phase === 'coda') fade = clamp01(1 - s.phaseTime / config.acts.codaFadeSec);
    if (s.phase === 'prologue' || s.phase === 'prison'
        || s.phase === 'act1' || s.phase === 'epilogue') fade = 0;

    for (let i = 0; i < 8; i += 1) {
      const target = s.knobs[i] * fade;
      this.growth[i] += (target - this.growth[i]) * Math.min(1, dt * config.act2.smoothing);
      // Each dial tells its part of the story the first time it rises.
      if (!this.storyTold[i] && s.phase === 'act2' && this.growth[i] > 0.12) {
        this.storyTold[i] = true;
        const story = config.act2.knobStories[i];
        if (story && this.captions) this.captions.showStory(story[0], story[1]);
      }
    }
    const g = this.growth;

    let wind = g[3];
    // Dissolution: as the coda deepens, turbulence rises — the un-growing
    // world sways harder and sheds dandelion-drift while it fades.
    if (s.phase === 'coda') {
      wind = Math.max(wind, (1 - fade) * 0.95);
      // WINDSTORM: as the world un-grows, gusts tear light sideways off
      // the dissolving vision and carry it into the dark.
      this.gustAcc += dt;
      while (this.gustAcc >= 0.35) {
        this.gustAcc -= 0.35;
        const dir = this.windDir * (Math.random() < 0.8 ? 1 : -1);
        this.particles.burst({
          x: rand(-0.45, 0.45) * config.worldWidth,
          y: rand(-0.35, 0.3) * config.worldHeight,
          color: pick([config.palette.gold, config.palette.beryl,
            config.palette.white, config.palette.malachite]),
          count: Math.round(46 * (1 - fade) + 8),
          speed: 26, size: 2.3, life: rand(1.8, 2.8),
          upBias: 0.1, jitter: 60,
          driftX: dir * rand(260, 420) * (1 - fade * 0.5),
          minSpeedFrac: 0.4,
        });
      }
    }

    // Side-effects riding the sky dials: rays gild and swell the glow,
    // clouds quicken the whole world's drift.
    const r = config.act2.refine;
    const warmth = lerp(r.warmthDefault, r.warmthRange[1], g[5]);
    this.post.setBloomStrength(
      config.bloom.strength * lerp(r.bloomRange[0], r.bloomRange[1], g[5]),
    );

    const shared = {
      time,
      ppwu,
      wind,
      sway: lerp(r.swayRange[0], r.swayRange[1], g[7]) + 0.45,
      warmth,
      density: 1,
    };
    this.trees.update(shared, g[0]);
    this.ponds.update(shared, g[1]);
    this.instruments.update(shared, g[2]);
    this.rays.update(shared, g[5]);
    this.banners.update(shared, g[6]);
    this.clouds.update(shared, g[7]);
    this.birds.update(dt, time, g[4]);

    // K4 — the whole paradise sways like a slowly turning mandala.
    this.worldGroup.rotation.z = Math.sin(time * 0.045) * config.act2.wind.rotMax * wind;

    this.emitWindSeeds(dt, wind);
    this.emitNoteSparks(dt, g[2]);

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
