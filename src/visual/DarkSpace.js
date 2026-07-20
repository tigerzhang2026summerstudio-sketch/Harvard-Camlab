/**
 * DarkSpace — the black emptiness itself is alive. Three barely-there
 * layers populate the negative space around the action:
 *
 *   dust    a faint field of drifting motes / distant stars, everywhere
 *   ink     slow ink-wash clouds of blue-gray light roiling in the dark
 *   ghosts  every so often a Cave-217 mural fragment surfaces faintly
 *           in a far corner, holds, and sinks back into the dark
 *
 * And the dark ANSWERS the performer: each key strike (rate-limited)
 * sends a slow, dim ripple-ring spreading outward. Every color here is
 * kept under the bloom threshold — you feel this layer more than see
 * it, and the fireworks stay the star. All tunables: config.darkspace.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { rand } from '../core/Clock.js';
import { preloadMural, muralPointsFor } from './ComboPatterns.js';

export class DarkSpace {
  constructor(state, particles) {
    this.state = state;
    this.particles = particles;
    this.time = 0;
    this.dustAcc = 0;
    this.inkAcc = 0;
    this.ghostIn = rand(20, 40);  // first ghost comes sooner
    this.lastRipple = -1e9;

    const ds = config.darkspace;
    const H = config.worldHeight;
    // Ink-cloud emitters wander on layered sines, each its own drift.
    this.clouds = [];
    for (let i = 0; i < ds.ink.clouds; i += 1) {
      this.clouds.push({
        seedX: rand(0, Math.PI * 2),
        seedY: rand(0, Math.PI * 2),
        rateX: rand(0.6, 1.4) * ds.ink.driftSpeed,
        rateY: rand(0.5, 1.2) * ds.ink.driftSpeed,
        spanX: rand(0.25, 0.46),
        baseY: rand(-0.2, 0.38) * H,
        spanY: rand(40, 140),
      });
    }

    this.colWhite = new THREE.Color(config.palette.white);
    this.colBeryl = new THREE.Color(config.palette.beryl);
    this.colLapis = new THREE.Color(config.palette.lapis);

    if (ds.enabled) {
      for (const f of config.act1.combos.muralFiles) preloadMural(f, 3000);
      state.on('key', (e) => { if (e.on) this.ripple(e); });
    }
  }

  /** How bright the darkness may be right now. */
  scale() {
    const ds = config.darkspace;
    let s = ds.phaseScale[this.state.phase] ?? 1;
    if (this.state.phase === 'coda') {
      s *= Math.max(0.2, 1 - this.state.phaseTime / config.acts.codaFadeSec);
    }
    return s;
  }

  /** A strike sends one slow dim ring spreading through the dark. */
  ripple(e) {
    const ds = config.darkspace;
    if (!ds.enabled || this.time - this.lastRipple < ds.ripple.minGapSec) return;
    const ph = this.state.phase;
    if (ph !== 'act1' && ph !== 'act2' && ph !== 'act3') return;
    this.lastRipple = this.time;

    const kb = config.keyBurst;
    const pitch = Math.max(0, Math.min(1, (e.note - kb.noteLow) / (kb.noteHigh - kb.noteLow)));
    this.particles.burst({
      x: (pitch - 0.5) * config.worldWidth * kb.xSpan,
      y: (kb.yLowFrac + (kb.yHighFrac - kb.yLowFrac) * pitch) * config.worldHeight,
      color: this.colWhite.clone().multiplyScalar(ds.ripple.brightness * this.scale()),
      count: ds.ripple.count,
      speed: ds.ripple.speed,
      size: 1.8,
      life: 3.6,
      upBias: 0,
      jitter: 6,
      minSpeedFrac: 0.96, // a thin ring, not a bloom
    });
  }

  update(time, dt) {
    this.time = time;
    const ds = config.darkspace;
    if (!ds.enabled) return;
    const s = this.scale();
    if (s <= 0.01) return;
    const W = config.worldWidth;
    const H = config.worldHeight;

    // ── Living dust: sparse, slow, everywhere ─────────────────────────
    this.dustAcc += dt;
    while (this.dustAcc >= ds.dust.everySec) {
      this.dustAcc -= ds.dust.everySec;
      for (let k = 0; k < ds.dust.perSpawn; k += 1) {
        const c = (Math.random() < 0.7 ? this.colWhite : this.colBeryl).clone()
          .multiplyScalar(ds.dust.brightness * s * rand(0.5, 1.2));
        this.particles.burst({
          x: rand(-0.5, 0.5) * W,
          y: rand(-0.48, 0.48) * H,
          color: c,
          count: 1,
          speed: rand(2, 7),
          size: rand(1.4, 2.2),
          life: rand(7, 14),
          upBias: 0.15,
          jitter: 3,
        });
      }
    }

    // ── Ink-wash clouds: soft roiling puffs around wandering centers ──
    this.inkAcc += dt;
    while (this.inkAcc >= ds.ink.everySec) {
      this.inkAcc -= ds.ink.everySec;
      for (const cl of this.clouds) {
        const cx = Math.sin(time * cl.rateX + cl.seedX) * cl.spanX * W;
        const cy = cl.baseY + Math.sin(time * cl.rateY + cl.seedY) * cl.spanY;
        this.particles.burst({
          x: cx, y: cy,
          color: this.colLapis.clone().multiplyScalar(ds.ink.brightness * s * rand(0.6, 1.1)),
          count: 6,
          speed: 4,
          size: rand(2.8, 3.6),
          life: rand(4, 6.5),
          upBias: 0.05,
          jitter: rand(40, 90),
        });
      }
    }

    // ── Ghost murals: a fragment surfaces in a far corner, then sinks ─
    const ph = this.state.phase;
    if (ph === 'act1' || ph === 'act2' || ph === 'act3') {
      this.ghostIn -= dt;
      if (this.ghostIn <= 0) {
        this.ghostIn = ds.ghosts.everySec * rand(0.6, 1.4);
        const files = config.act1.combos.muralFiles;
        const m = muralPointsFor(files[Math.floor(Math.random() * files.length)]);
        if (m) {
          const hW = H * ds.ghosts.heightFrac;
          const cornerX = (Math.random() < 0.5 ? -1 : 1) * rand(0.3, 0.42) * W;
          const cornerY = rand(0.18, 0.38) * H; // upper corners — floor is busy
          this.particles.settle({
            pts: m.pts.map((p) => ({
              x: p.x * hW, y: p.y * hW,
              col: p.col.clone().multiplyScalar(ds.ghosts.brightness * s),
            })),
            x: cornerX, y: cornerY,
            size: 1.9,
            life: ds.ghosts.lifeSec,
            scatter: 60,   // it surfaces, rather than flies in
            stagger: 2.5,
          });
        }
      }
    }
  }
}
