/**
 * SkyLayers — the upper heavens of the Pure Land, one per sky dial:
 *
 *   K5  BirdFlock   kalavinka birds wheeling on lissajous paths, each
 *                   leaving a calligraphic trail of light (the teamLab
 *                   "Light in Dark" gesture, in mineral gold)
 *   K6  buildRays   a fan of golden rays from the sky's apex
 *   K7  buildBanners jeweled ribbon-banners hanging and swaying
 *   K8  buildClouds  soft drifting bands of cloud-light
 *
 * Rays/banners/clouds are GrowthLayer geometries (reveal follows the
 * dial); the birds are dynamic and paint themselves through the shared
 * ParticleSystem.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { pick, rand } from '../core/Clock.js';

export function buildRays(add) {
  const density = Math.max(config.qualityScale[config.quality].particleScale, 0.3);
  const H = config.worldHeight;
  const apexX = 0;
  const apexY = H * 0.52;

  const gold = new THREE.Color(config.palette.gold);
  const white = new THREE.Color(config.palette.white);
  const c = new THREE.Color();

  const rays = config.act2.rays.count;
  for (let r = 0; r < rays; r += 1) {
    // Fan from straight down: center rays first, edges later.
    const spread = (r / (rays - 1) - 0.5) * 2;              // -1..1
    const ang = spread * 1.25;                               // radians off vertical
    const len = H * rand(0.5, 0.62) / Math.max(Math.cos(ang), 0.45);
    const n = Math.round(34 * density) + 8;
    const stageBase = Math.abs(spread) * 0.5;
    for (let k = 0; k < n; k += 1) {
      const f = k / n;
      c.lerpColors(white, gold, rand(0.3, 0.9))
        .multiplyScalar((0.55 - f * 0.28) * rand(0.8, 1.2));
      add(
        apexX + Math.sin(ang) * len * f + rand(-3, 3) * (1 + f * 3),
        apexY - Math.cos(ang) * len * f + rand(-2, 2),
        rand(1.7, 2.7) * (1 - f * 0.3), c,
        stageBase + f * 0.42 + rand(0, 0.06),  // rays pour outward from the apex
        0.5 + f * 1.6,
        f * 9,                                  // shimmer travels down the ray
      );
    }
  }
}

export function buildBanners(add) {
  const density = Math.max(config.qualityScale[config.quality].particleScale, 0.3);
  const W = config.worldWidth;
  const H = config.worldHeight;
  const tints = ['cinnabar', 'gold', 'beryl', 'malachite'];
  const white = new THREE.Color(config.palette.white);
  const c = new THREE.Color();

  const count = config.act2.banners.count;
  for (let b = 0; b < count; b += 1) {
    const x0 = ((b + 0.5) / count - 0.5) * W * 0.92 + rand(-20, 20);
    const y0 = H * (0.36 + rand(-0.05, 0.05));
    const len = H * rand(0.2, 0.3);
    const tint = new THREE.Color(config.palette[tints[b % tints.length]]);
    const stageBase = (b % 2 === 0 ? b : count - b) / count * 0.5;

    // canopy tuft — the jeweled crown the banner hangs from
    const capN = Math.round(24 * density) + 6;
    for (let k = 0; k < capN; k += 1) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random());
      c.lerpColors(white, tint, 0.5).multiplyScalar(rand(1.0, 1.4));
      add(x0 + Math.cos(a) * 15 * rr, y0 + 4 + Math.sin(a) * 5 * rr,
        rand(2.0, 3.0), c, stageBase + rand(0, 0.1), 0.8, 0);
    }
    // three ribbon strands falling beneath, tips whipping in the wind
    for (const dx of [-6, 0, 6]) {
      const n = Math.round(24 * density) + 6;
      for (let k = 0; k < n; k += 1) {
        const f = k / n;
        c.copy(tint).lerp(white, 0.15 + f * 0.2).multiplyScalar((1.05 - f * 0.35));
        add(
          x0 + dx + Math.sin(f * 7 + b) * 3.5,
          y0 - f * len,
          rand(1.7, 2.5) * (1 - f * 0.25), c,
          stageBase + 0.08 + f * 0.34,
          1 + f * 5,    // tips sway far more than the crown
          f * 6,
        );
      }
    }
  }
}

export function buildClouds(add) {
  const density = Math.max(config.qualityScale[config.quality].particleScale, 0.3);
  const W = config.worldWidth;
  const H = config.worldHeight;
  const beryl = new THREE.Color(config.palette.beryl);
  const white = new THREE.Color(config.palette.white);
  const c = new THREE.Color();

  const count = config.act2.clouds.count;
  for (let i = 0; i < count; i += 1) {
    const cx = rand(-0.46, 0.46) * W;
    const cy = H * (0.06 + Math.random() * 0.36);
    const rx = rand(60, 150);
    const ry = rx * 0.26;
    const stageBase = (i / count) * 0.68;
    const n = Math.round(52 * density) + 10;
    for (let k = 0; k < n; k += 1) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random());
      c.lerpColors(white, beryl, Math.random() * 0.6).multiplyScalar(rand(0.32, 0.55));
      add(
        cx + Math.cos(a) * rx * rr,
        cy + Math.sin(a) * ry * rr,
        rand(2.1, 3.4), c,
        stageBase + rr * 0.2 + rand(0, 0.08),
        rand(3, 6),   // whole cloud breathes and drifts
        rand(0, 6),
      );
    }
  }
}

/** K5 — the kalavinka birds: moving points of light with comet trails. */
export class BirdFlock {
  constructor(particles) {
    this.particles = particles;
    const W = config.worldWidth;
    const H = config.worldHeight;
    this.birds = [];
    for (let i = 0; i < config.act2.birds.max; i += 1) {
      this.birds.push({
        cx: rand(-0.4, 0.4) * W,
        cy: H * (0.08 + (i / config.act2.birds.max) * 0.3),
        rx: rand(120, 320),
        ry: rand(40, 110),
        speed: rand(0.25, 0.55) * (i % 2 ? -1 : 1),
        wobble: rand(1.1, 1.7),   // lissajous ratio → figure-eight flight
        phase: rand(0, Math.PI * 2),
        trail: rand(0, 0.05),
        tint: pick([config.palette.gold, config.palette.white, config.palette.beryl]),
      });
    }
  }

  update(dt, time, growth) {
    const active = Math.round(growth * this.birds.length);
    for (let i = 0; i < active; i += 1) {
      const b = this.birds[i];
      b.trail -= dt;
      if (b.trail > 0) continue;
      b.trail = config.act2.birds.trailInterval;
      const a = time * b.speed + b.phase;
      this.particles.burst({
        x: b.cx + Math.cos(a) * b.rx,
        y: b.cy + Math.sin(a * b.wobble) * b.ry,
        color: b.tint,
        count: 6,
        speed: 5,
        size: 2.1,
        life: 1.7,   // short life → the trail reads as calligraphy, not fog
        upBias: 0,
        jitter: 2,
      });
    }
  }
}
