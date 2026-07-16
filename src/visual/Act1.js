/**
 * Act1 — "The Flood of Light". Turns key events into blooms:
 *
 *   pitch    → where (left→right across the panorama, low near the ground)
 *              and what color (deep beryl → gold → warm white)
 *   velocity → how much (count, size, speed, lifetime)
 *   chords   → symmetry: two held notes mirror every bloom across the
 *              center axis; three or more open a radial mandala of
 *              satellite blooms around the chord's centroid.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { clamp01, lerp } from '../core/Clock.js';

export class Act1 {
  constructor(particles) {
    this.particles = particles;
    this.held = new Map(); // note → burst spec (for chord centroids)
    this.colBeryl = new THREE.Color(config.palette.beryl);
    this.colGold = new THREE.Color(config.palette.gold);
    this.colWhite = new THREE.Color(config.palette.white);
    this.color = new THREE.Color();
  }

  /** Map a note+velocity to a burst spec (position/color/energy). */
  specFor(note, velocity) {
    const kb = config.keyBurst;
    const qs = config.qualityScale[config.quality];
    const pitch = clamp01((note - kb.noteLow) / (kb.noteHigh - kb.noteLow));
    const power = velocity ** kb.velocityCurve;

    if (pitch < 0.7) this.color.lerpColors(this.colBeryl, this.colGold, pitch / 0.7);
    else this.color.lerpColors(this.colGold, this.colWhite, (pitch - 0.7) / 0.3);

    return {
      x: (pitch - 0.5) * config.worldWidth * kb.xSpan,
      y: lerp(kb.yLowFrac, kb.yHighFrac, pitch) * config.worldHeight,
      color: this.color.clone(),
      count: Math.round(lerp(kb.countMin, kb.countMax, power) * qs.particleScale),
      speed: lerp(kb.speedMin, kb.speedMax, power),
      size: lerp(kb.sizeMin, kb.sizeMax, power),
      life: lerp(kb.lifeMin, kb.lifeMax, power),
      upBias: kb.upBias,
      jitter: kb.jitter,
    };
  }

  onKey(e) {
    if (!e.on) {
      this.held.delete(e.note);
      return;
    }

    const a1 = config.act1;
    const spec = this.specFor(e.note, e.velocity);
    this.held.set(e.note, spec);
    const chord = this.held.size;

    // The struck note always blooms where it lives.
    this.particles.burst(spec);

    // Two or more held notes: the vision turns symmetrical — mirror across
    // the central axis (unless the bloom already sits on it).
    if (chord >= 2 && Math.abs(spec.x) > config.worldWidth * a1.mirrorMinX) {
      this.particles.burst({
        ...spec,
        x: -spec.x,
        count: Math.round(spec.count * a1.mirrorScale),
      });
    }

    // Three or more: a mandala — satellites ring the chord's centroid.
    if (chord >= a1.satelliteMin) {
      let cx = 0; let cy = 0;
      for (const s of this.held.values()) { cx += s.x; cy += s.y; }
      cx /= chord; cy /= chord;

      const n = Math.min(chord, a1.satelliteMax);
      const radius = a1.satelliteRadius + a1.satelliteRadiusPer * chord;
      const phase = (e.note % 12) / 12 * Math.PI * 2; // note picks the rotation
      for (let k = 0; k < n; k += 1) {
        const ang = phase + (k / n) * Math.PI * 2;
        this.particles.burst({
          ...spec,
          x: cx + Math.cos(ang) * radius,
          y: cy + Math.sin(ang) * radius * 0.6, // squashed: panorama is wide
          count: Math.round(spec.count * a1.satelliteScale),
          size: spec.size * 0.85,
          speed: spec.speed * 0.7,
        });
      }
    }
  }
}
