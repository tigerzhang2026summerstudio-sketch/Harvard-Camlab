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

/**
 * K5 — the kalavinka birds as ACTUAL birds: each one is drawn as a small
 * V-glyph (body mote + two flapping wing-lines, oriented to its flight)
 * refreshed every few frames, with a fainter calligraphy trail behind.
 *
 * The whole flock moves as ONE: a shared center that the MK3's joystick
 * steers (Act2 routes it here); when the stick is idle, the center
 * wanders the sky on its own, and every bird orbits it loosely.
 */
export class BirdFlock {
  constructor(particles) {
    this.particles = particles;
    const H = config.worldHeight;
    this.center = { x: 0, y: H * 0.24, vx: 0, vy: 0 };
    this.steerX = 0;
    this.steerY = 0;
    this.steerAt = -1e9; // time of the last real joystick input
    this.time = 0;

    this.birds = [];
    const bc = config.act2.birds;
    for (let i = 0; i < bc.max; i += 1) {
      this.birds.push({
        rx: rand(50, 210),          // loose orbit around the flock center
        ry: rand(26, 90),
        speed: rand(0.3, 0.6) * (i % 2 ? -1 : 1),
        wobble: rand(1.1, 1.7),     // lissajous ratio → figure-eight flight
        phase: rand(0, Math.PI * 2),
        flapHz: rand(bc.flapHz[0], bc.flapHz[1]),
        flapPhase: rand(0, Math.PI * 2),
        glyphAcc: rand(0, bc.glyphEverySec),
        trailAcc: rand(0, bc.trailInterval),
        px: 0, py: 0,               // previous position → heading
        tint: pick([config.palette.gold, config.palette.white, config.palette.beryl]),
      });
    }
  }

  /** Joystick input (either axis). Steering stays live for a moment. */
  onSteer(axis, value) {
    if (axis === 'x') this.steerX = value;
    else this.steerY = value;
    if (Math.abs(this.steerX) > 0.12 || Math.abs(this.steerY) > 0.12) {
      this.steerAt = this.time;
    }
  }

  update(dt, time, growth) {
    this.time = time;
    const bc = config.act2.birds;
    const W = config.worldWidth;
    const H = config.worldHeight;
    const c = this.center;

    // ── The flock center: steered, or wandering as a whole ────────────
    const steering = time - this.steerAt < 1.5;
    let ax; let ay;
    if (steering) {
      ax = this.steerX * bc.steerAccel;
      ay = this.steerY * bc.steerAccel; // full vertical authority
    } else {
      // slow layered sines — an unhurried group meander
      ax = (Math.sin(time * 0.17) * 0.6 + Math.sin(time * 0.043 + 2) * 0.4) * bc.wanderAccel;
      ay = Math.cos(time * 0.13 + 1) * bc.wanderAccel * 0.6;
    }
    c.vx += ax * dt;
    c.vy += ay * dt;
    // damping + a speed limit keep the flight graceful
    const damp = Math.exp(-dt * 0.55);
    c.vx *= damp;
    c.vy *= damp;
    const sp = Math.hypot(c.vx, c.vy);
    if (sp > bc.maxSpeed) { c.vx *= bc.maxSpeed / sp; c.vy *= bc.maxSpeed / sp; }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    // Horizontal: the sky WRAPS — fly off one edge, return on the other.
    const wrapW = W * 1.12;
    if (c.x > wrapW / 2) c.x -= wrapW;
    if (c.x < -wrapW / 2) c.x += wrapW;
    // Vertical: soft springs at the configured swoop/climb limits.
    if (c.y > bc.yMaxFrac * H) c.vy -= (c.y - bc.yMaxFrac * H) * 3 * dt;
    if (c.y < bc.yMinFrac * H) c.vy -= (c.y - bc.yMinFrac * H) * 3 * dt;

    // ── The birds themselves ──────────────────────────────────────────
    const active = Math.round(growth * this.birds.length);
    for (let i = 0; i < active; i += 1) {
      const b = this.birds[i];
      const a = time * b.speed + b.phase;
      let bx = c.x + Math.cos(a) * b.rx;
      const by = c.y + Math.sin(a * b.wobble) * b.ry;
      // each bird wraps the sky individually too
      if (bx > wrapW / 2) bx -= wrapW;
      if (bx < -wrapW / 2) bx += wrapW;
      const hx = (bx - b.px) + c.vx * 0.02; // heading ≈ own motion + flock drift
      const hy = (by - b.py) + c.vy * 0.02;
      b.px = bx;
      b.py = by;
      const heading = Math.abs(hx) > wrapW * 0.4 // ignore the wrap jump
        ? Math.atan2(c.vy, c.vx || 1e-4)
        : Math.atan2(hy, hx || 1e-4);

      // Draw the bird: a body mote and two wing-lines swept back from
      // the heading, their angle beating with the flap.
      b.glyphAcc += dt;
      if (b.glyphAcc >= bc.glyphEverySec) {
        b.glyphAcc -= bc.glyphEverySec;
        const flap = Math.sin(time * b.flapHz * Math.PI * 2 + b.flapPhase);
        const wingAng = 0.6 + 0.5 * flap; // radians off the tail direction
        const back = heading + Math.PI;
        this.particles.burst({
          x: bx, y: by, color: b.tint,
          count: 4, speed: 2, size: bc.bodySize, life: 0.16, upBias: 0, jitter: 1.6,
        });
        for (const side of [-1, 1]) {
          const wa = back + side * wingAng;
          for (let k = 1; k <= 5; k += 1) {
            const d = (k / 5) * bc.wingLen;
            this.particles.burst({
              x: bx + Math.cos(wa) * d,
              y: by + Math.sin(wa) * d * 0.9,
              color: b.tint,
              count: 1, speed: 1.5, size: bc.wingSize - k * 0.18,
              life: 0.16, upBias: 0, jitter: 1,
            });
          }
        }
      }

      // …and the calligraphy trail it leaves on the sky.
      b.trailAcc += dt;
      if (b.trailAcc >= bc.trailInterval) {
        b.trailAcc -= bc.trailInterval;
        this.particles.burst({
          x: bx, y: by, color: b.tint,
          count: 2, speed: 4, size: 2.1, life: 1.6, upBias: 0, jitter: 2.5,
        });
      }
    }
  }
}
