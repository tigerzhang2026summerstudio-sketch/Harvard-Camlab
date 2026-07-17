/**
 * Act1 — "The Flood of Light". Turns key events into blooms:
 *
 *   pitch    → where (left→right across the panorama, low near the ground)
 *              and what color (deep beryl → gold → warm white)
 *   velocity → how much (count, size, speed, lifetime)
 *   chords   → symmetry: two held notes mirror every bloom across the
 *              center axis; three or more open a radial mandala of
 *              satellite blooms around the chord's centroid.
 *
 * And the act's own story, 第一观: an ember sun sits on the western
 * horizon; every strike feeds it a flare, and as the fullness meter
 * rises the sun brightens and climbs. Each strike also paints a rising
 * calligraphic streak and re-blooms as soft echoes — so even sparse
 * playing keeps the whole wall alive.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { GrowthLayer } from './GrowthLayer.js';
import { clamp01, lerp, rand } from '../core/Clock.js';

/** The sun disc: a GrowthLayer revealed center-out by the fullness meter. */
function buildSun(add) {
  const s = config.act1.sun;
  const density = Math.max(config.qualityScale[config.quality].particleScale, 0.3);
  const cinnabar = new THREE.Color(config.palette.cinnabar);
  const gold = new THREE.Color(config.palette.gold);
  const white = new THREE.Color(config.palette.white);
  const c = new THREE.Color();

  const n = Math.round(s.count * density) + 100;
  for (let k = 0; k < n; k += 1) {
    const a = Math.random() * Math.PI * 2;
    const rf = Math.sqrt(Math.random());
    // ember heart → gold rim → faint white corona
    if (rf < 0.55) c.lerpColors(cinnabar, gold, rf / 0.55).multiplyScalar(rand(1.1, 1.5));
    else c.lerpColors(gold, white, (rf - 0.55) / 0.45).multiplyScalar(rand(0.5, 1.0) * (1.3 - rf));
    const rr = rf < 0.9 ? rf : rf * rand(1.0, 1.35); // corona scatters past the rim
    add(
      Math.cos(a) * s.radius * rr,
      Math.sin(a) * s.radius * rr * 0.94,
      rand(2.0, 3.4) * (1.15 - rf * 0.4), c,
      rf * 0.85 + rand(0, 0.1),   // kindles from the heart outward
      0.4 + rf * 1.2,
      rf * 6,
    );
  }
}

export class Act1 {
  constructor(worldGroup, state, particles) {
    this.state = state;
    this.particles = particles;
    this.held = new Map(); // note → burst spec (for chord centroids)
    this.colBeryl = new THREE.Color(config.palette.beryl);
    this.colGold = new THREE.Color(config.palette.gold);
    this.colWhite = new THREE.Color(config.palette.white);
    this.color = new THREE.Color();

    this.sun = new GrowthLayer(worldGroup, buildSun, { intensity: 1.15 });
    this.sun.points.position.set(
      config.act1.sun.x * config.worldWidth,
      config.act1.sun.yLowFrac * config.worldHeight,
      0,
    );
    this.sunReveal = 0;
    this.streaks = [];  // rising brush-strokes in flight
    this.echoes = [];   // pending echo blooms
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

    // …paints a rising streak of light…
    this.streaks.push({
      x: spec.x, y: spec.y, t: 0,
      dir: Math.sign(-spec.x) || 1,      // curls toward the center
      color: spec.color, size: spec.size * 0.8,
    });

    // …echoes twice, softly, nearby…
    for (const delay of a1.echo.delays) {
      this.echoes.push({ spec, at: delay, t: 0 });
    }

    // …and feeds the western sun a flare.
    const sun = config.act1.sun;
    this.particles.burst({
      x: sun.x * config.worldWidth,
      y: this.sunY(),
      color: config.palette.cinnabar,
      count: sun.flarePerStrike,
      speed: 30, size: 2.6, life: 1.8, upBias: 0.6, jitter: sun.radius * 0.5,
    });

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

  /** Where the sun currently hangs (climbs with the fullness meter). */
  sunY() {
    const s = config.act1.sun;
    return lerp(s.yLowFrac, s.yHighFrac, this.sunReveal) * config.worldHeight;
  }

  update(time, dt, ppwu) {
    const s = this.state;

    // The sun kindles with the meter, holds through the acts, and sets
    // again in the coda; the prologue starts it dark.
    let fade = 1;
    if (s.phase === 'coda') fade = clamp01(1 - s.phaseTime / config.acts.codaFadeSec);
    if (s.phase === 'prologue') fade = 0;
    const target = s.fullness * fade;
    this.sunReveal += (target - this.sunReveal) * Math.min(1, dt * 0.8);
    this.sun.points.position.y = this.sunY();
    this.sun.update(
      { time, ppwu, wind: 0, sway: 0.8, warmth: 0.62, density: 1 },
      this.sunReveal,
    );

    // Rising brush-strokes: short bursts along a curling upward path.
    const st = config.act1.streak;
    for (const k of this.streaks) {
      k.t += dt;
      const f = Math.min(1, k.t / st.duration);
      this.particles.burst({
        x: k.x + k.dir * f * f * st.curve,
        y: k.y + f * st.length,
        color: k.color,
        count: 10,
        speed: 6,
        size: k.size * (1 - f * 0.4),
        life: 1.1,
        upBias: 0.3,
        jitter: 2.5,
      });
    }
    this.streaks = this.streaks.filter((k) => k.t < st.duration);

    // Echo blooms: the strike answers itself, softer and displaced.
    const ec = config.act1.echo;
    for (const e of this.echoes) {
      e.t += dt;
      if (e.t >= e.at && !e.fired) {
        e.fired = true;
        this.particles.burst({
          ...e.spec,
          x: e.spec.x + rand(-1, 1) * ec.spread,
          y: e.spec.y + rand(-0.3, 0.5) * ec.spread,
          count: Math.round(e.spec.count * ec.scale),
          size: e.spec.size * 0.8,
          speed: e.spec.speed * 0.7,
        });
      }
    }
    this.echoes = this.echoes.filter((e) => !e.fired);
  }
}
