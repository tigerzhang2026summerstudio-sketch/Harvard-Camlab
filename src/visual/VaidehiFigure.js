/**
 * VaidehiFigure — the imprisoned queen as a small, faint kneeling figure
 * of light near the center: the audience's witness inside the scene.
 * Present from the prologue (she replaces the old boot beacon); at pad B6
 * ("awakening") she dissolves upward into motes and the vision holds.
 * The loop's return to the prologue restores her.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { rand } from '../core/Clock.js';
import { GrowthLayer } from './GrowthLayer.js';

export class VaidehiFigure {
  constructor(parent, particles) {
    this.particles = particles;
    const H = config.worldHeight;
    this.x = -0.055 * config.worldWidth;         // kneeling just left of center
    this.baseY = -H / 2 + config.ground.bandFrac * H * 0.5;

    const white = new THREE.Color(config.palette.white);
    const gold = new THREE.Color(config.palette.gold);
    const c = new THREE.Color();
    const { x, baseY } = this;

    this.layer = new GrowthLayer(parent, (add) => {
      const put = (px, py, s, mul, sway = 0.3) => {
        c.lerpColors(white, gold, Math.random() * 0.3).multiplyScalar(mul);
        // Random stages → she dissolves as scattered motes, not a wipe.
        add(px, py, s, c, Math.random() * 0.85, sway, 0);
      };
      // head, bowed slightly forward
      for (let i = 0; i < 26; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * 4.5;
        put(x + 2.5 + Math.cos(a) * r, baseY + 40 + Math.sin(a) * r, rand(1.6, 2.4), 0.75);
      }
      // torso leaning forward over folded knees
      for (let i = 0; i < 70; i += 1) {
        const f = Math.random();
        put(
          x + f * 3 + rand(-1, 1) * (5 + f * 2),
          baseY + 34 - f * 22,
          rand(1.4, 2.2), 0.55,
        );
      }
      // folded legs — a soft mound at the ground
      for (let i = 0; i < 50; i += 1) {
        const a = Math.random() * Math.PI;
        const r = Math.sqrt(Math.random());
        put(x + Math.cos(a) * 11 * r, baseY + Math.abs(Math.sin(a)) * 7 * r, rand(1.4, 2.2), 0.5);
      }
      // joined hands
      for (let i = 0; i < 16; i += 1) {
        put(x + 6 + rand(-2, 2), baseY + 22 + rand(-2, 2), rand(1.6, 2.4), 0.9);
      }
      // the faint thread of light rising from her — her plea
      for (let i = 0; i < 26; i += 1) {
        const f = i / 26;
        put(x + 2.5 + rand(-0.8, 0.8), baseY + 46 + f * 34, rand(1.2, 1.8) * (1 - f * 0.5), 0.4 * (1 - f * 0.6), 0.8);
      }
    }, { intensity: 1.0 });

    this.presence = 1;   // 1 = kneeling there; 0 = dissolved into light
    this.target = 1;
  }

  /** B6 — she dissolves upward into drifting motes. */
  awaken() {
    if (this.target === 0) return;
    this.target = 0;
    this.particles.burst({
      x: this.x, y: this.baseY + 25,
      color: config.palette.white,
      count: 220, speed: 26, size: 2.4, life: 6,
      upBias: 2.6, jitter: 12,
    });
  }

  reset() { this.presence = 0; this.target = 1; } // prologue: she returns softly

  update(time, dt, ppwu) {
    this.presence += (this.target - this.presence) * Math.min(1, dt * 0.7);
    this.layer.update(
      { time, ppwu, wind: 0, sway: 0.7, warmth: 0.5, density: 1 },
      this.presence,
    );
  }
}
