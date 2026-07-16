/**
 * Transitions — the visual half of each act change: the whole vision
 * swells softly in radiance (a slow sine bump, never a flash) while a
 * wash of faint motes rises across the panorama. Together with the
 * caption and the audio crossfade this makes every phase boundary read
 * as a scene of its own.
 */
import { config } from '../config/config.js';
import { rand } from '../core/Clock.js';

export class Transitions {
  constructor(state, particles, post) {
    this.particles = particles;
    this.post = post;
    this.t = -1; // -1 = idle

    state.on('phase', ({ phase }) => {
      if (phase === 'prologue') return; // the loop's return stays silent-dark
      this.t = 0;
      this.washed = false;
    });
  }

  update(dt) {
    if (this.t < 0) return;
    this.t += dt;
    const cfg = config.transitions;

    // One smooth breath of light: up and back down over swellSec.
    const f = Math.min(1, this.t / cfg.swellSec);
    this.post.setSwell(1 + (cfg.swell - 1) * Math.sin(Math.PI * f));

    // A single wash of slow rising motes, released just after the cut.
    if (!this.washed && this.t > 0.25) {
      this.washed = true;
      const W = config.worldWidth;
      const H = config.worldHeight;
      for (let i = 0; i < cfg.washBursts; i += 1) {
        this.particles.burst({
          x: ((i + 0.5) / cfg.washBursts - 0.5) * W * 0.95,
          y: rand(-0.4, -0.1) * H,
          color: Math.random() < 0.6 ? config.palette.beryl : config.palette.white,
          count: 60,
          speed: 12,
          size: 2.2,
          life: rand(4, 7),
          upBias: 2.0,
          jitter: 55,
        });
      }
    }

    if (f >= 1) {
      this.post.setSwell(1);
      this.t = -1;
    }
  }
}
