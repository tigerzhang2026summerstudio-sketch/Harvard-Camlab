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
import { ComboEngine } from './ComboEngine.js';
import { flakePoints } from './ComboPatterns.js';
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
    this.tracers = [];  // moving light-emitters: streaks, meteors
    this.echoes = [];   // pending echo blooms
    this.meteorIn = rand(6, 14); // seconds until the first shooting light

    // The pattern-reader: chords/runs/repeats/low+high gather the fire
    // into recognizable 图案 and ember-formed lines of the sutra.
    this.combos = new ComboEngine(state, particles);

    // Milestones: Act I tells water → ice → beryl as the meter climbs.
    this.milestone = 0;       // 0 none · 1 water seen · 2 frozen · 3 beryl
    this.pendingScenes = [];  // scheduled milestone effects { at, fn }
    this.captions = null;     // wired in main.js
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

  /**
   * Every strike takes a random FORM — the same key never plays the same
   * shape twice. Soft touches favor the quiet forms, hard strikes the
   * dramatic ones (pools in config.act1.variety.forms).
   */
  formBurst(spec, velocity) {
    const v = config.act1.variety;
    const pool = velocity < 0.55 ? v.forms.soft : v.forms.hard;
    const form = pool[Math.floor(Math.random() * pool.length)];

    switch (form) {
      case 'ring':      // a halo that expands as one thin circle
        this.particles.burst({
          ...spec,
          minSpeedFrac: 0.92,
          count: Math.round(spec.count * 0.8),
          size: spec.size * 0.85,
          life: spec.life * 1.15,
          upBias: 0.1,
        });
        break;
      case 'fountain':  // a cone of light thrown upward
        this.particles.burst({
          ...spec,
          speed: spec.speed * 0.7,
          upBias: 2.8,
          jitter: spec.jitter * 0.4,
          life: spec.life * 1.2,
        });
        break;
      case 'willow':    // rises, hangs, then falls like willow branches
        this.particles.burst({
          ...spec,
          speed: spec.speed * 0.75,
          upBias: 1.7,
          driftY: -70,
          life: spec.life * 1.6,
          size: spec.size * 0.9,
        });
        break;
      case 'swirl':     // the bloom rotates as it opens
        this.particles.burst({
          ...spec,
          swirl: rand(0.55, 0.95) * (Math.random() < 0.5 ? -1 : 1),
          minSpeedFrac: 0.5,
          life: spec.life * 1.25,
        });
        break;
      case 'puff':      // a dandelion head: slow, soft, adrift
        this.particles.burst({
          ...spec,
          count: Math.round(spec.count * 0.55),
          speed: spec.speed * 0.35,
          size: spec.size * 1.2,
          life: spec.life * 1.9,
          upBias: 0.25,
          driftX: rand(-35, 35),
        });
        break;
      case 'fan': {     // a comet-fan thrown toward a random direction
        const th = rand(0.15, Math.PI - 0.15); // always some upward
        this.particles.burst({
          ...spec,
          count: Math.round(spec.count * 0.75),
          speed: spec.speed * 0.55,
          driftX: Math.cos(th) * spec.speed * 0.8,
          driftY: Math.sin(th) * spec.speed * 0.55,
          life: spec.life * 1.2,
        });
        break;
      }
      default:          // 'bloom' — the classic radial blossom
        this.particles.burst(spec);
    }
    return form;
  }

  onKey(e) {
    if (!e.on) {
      this.held.delete(e.note);
      return;
    }

    const a1 = config.act1;
    const v = a1.variety;
    const spec = this.specFor(e.note, e.velocity);

    // In the prison, light cannot yet escape: strikes bloom small,
    // gray-blue and earthbound — no sun, no echoes, no streaks.
    if (this.state.phase === 'prison') {
      this.particles.burst({
        ...spec,
        color: spec.color.lerp(new THREE.Color(config.palette.lapis), 0.75),
        count: Math.round(spec.count * 0.22),
        speed: spec.speed * 0.35,
        size: spec.size * 0.8,
        life: spec.life * 0.8,
        upBias: 0,
      });
      return;
    }

    // Chance of a wandering accent color, and of a displaced bloom that
    // blossoms somewhere unexpected — the wall stays unpredictable.
    if (Math.random() < v.accentChance) {
      spec.color.lerp(
        new THREE.Color(config.palette[Math.random() < 0.5 ? 'malachite' : 'cinnabar']),
        rand(0.35, 0.6),
      );
    }
    if (Math.random() < v.displacedChance) {
      spec.x = rand(-0.46, 0.46) * config.worldWidth;
      spec.y = rand(-0.1, 0.38) * config.worldHeight;
    }

    this.held.set(e.note, spec);
    const chord = this.held.size;

    // The struck note blooms — in one of many forms.
    this.formBurst(spec, e.velocity);

    // …and the pattern-reader watches for combo gestures.
    this.combos.onKey(e.note, e.velocity, spec);

    // Low strikes near the floor sometimes send light racing outward
    // along the beryl surface — a ripple over the frozen water.
    if (spec.y < -0.18 * config.worldHeight && Math.random() < 0.35) {
      const yGround = -config.worldHeight / 2
        + config.ground.bandFrac * config.worldHeight * rand(0.5, 0.9);
      for (const dir of [-1, 1]) {
        this.particles.burst({
          x: spec.x, y: yGround,
          color: spec.color,
          count: Math.round(spec.count * 0.3),
          speed: spec.speed * 0.35,
          size: spec.size * 0.8,
          life: spec.life * 1.3,
          upBias: 0.15,
          jitter: 10,
          driftX: dir * spec.speed * 0.7,
          minSpeedFrac: 0.55,
        });
      }
    }

    // Lingering embers glow at the spot long after the bloom has gone.
    this.particles.burst({
      x: spec.x, y: spec.y,
      color: spec.color,
      count: v.emberCount,
      speed: 5, size: 2.2,
      life: rand(6, 11),
      upBias: 0.1, jitter: 34,
    });

    // …paints a rising streak of light (direction now varies)…
    if (Math.random() < v.streakChance) {
      this.tracers.push({
        x: spec.x, y: spec.y, t: 0,
        vx: rand(-70, 70),
        vy: rand(150, 260),
        ax: rand(-60, 60),
        ay: rand(-140, -50),
        dur: rand(0.45, 0.9),
        rate: 0.03, emitAcc: 0,
        color: spec.color, size: spec.size * 0.8,
      });
    }

    // …echoes a random number of times, softly, further afield…
    const echoCount = 1 + Math.floor(Math.random() * a1.echo.delays.length);
    for (let i = 0; i < echoCount; i += 1) {
      this.echoes.push({ spec, at: a1.echo.delays[i] * rand(0.8, 1.3), t: 0 });
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

    // Three or more: a mandala — satellites around the chord's centroid,
    // sometimes a ring, sometimes an opening spiral.
    if (chord >= a1.satelliteMin) {
      let cx = 0; let cy = 0;
      for (const s of this.held.values()) { cx += s.x; cy += s.y; }
      cx /= chord; cy /= chord;

      const n = Math.min(chord, a1.satelliteMax);
      const spiral = Math.random() < 0.35;
      const radius = (a1.satelliteRadius + a1.satelliteRadiusPer * chord) * rand(0.75, 1.25);
      const phase = (e.note % 12) / 12 * Math.PI * 2; // note picks the rotation
      for (let k = 0; k < n; k += 1) {
        const f = k / n;
        const ang = phase + f * Math.PI * 2 * (spiral ? 1.6 : 1);
        const r = radius * (spiral ? 0.45 + f * 0.9 : 1);
        this.particles.burst({
          ...spec,
          x: cx + Math.cos(ang) * r,
          y: cy + Math.sin(ang) * r * 0.6, // squashed: panorama is wide
          count: Math.round(spec.count * a1.satelliteScale),
          size: spec.size * 0.85,
          speed: spec.speed * 0.7,
          swirl: spiral ? 0.5 : 0,
        });
      }
    }
  }

  // ── Act I milestone scenes (第二观 · 冰想 · 第三观) ─────────────────

  milestoneCheck(time) {
    if (this.state.phase !== 'act1') return;
    const ms = config.act1.milestones;
    const f = this.state.fullness;
    if (this.milestone === 0 && f >= ms.water.at) { this.milestone = 1; this.waterScene(time); }
    else if (this.milestone === 1 && f >= ms.ice.at) { this.milestone = 2; this.iceScene(time); }
    else if (this.milestone === 2 && f >= ms.beryl.at) { this.milestone = 3; this.berylScene(time); }
  }

  /** 第二观: a front of still water sweeps west→east along the floor. */
  waterScene(time) {
    const ms = config.act1.milestones.water;
    this.captions?.showStory(ms.caption[0], ms.caption[1]);
    const W = config.worldWidth;
    const H = config.worldHeight;
    for (let i = 0; i < 16; i += 1) {
      const fx = i / 15;
      this.pendingScenes.push({
        at: time + fx * 2.4,
        fn: () => this.particles.burst({
          x: (fx - 0.5) * W * 0.95,
          y: -0.38 * H + rand(-18, 30),
          color: Math.random() < 0.6 ? config.palette.beryl : config.palette.white,
          count: 130, speed: 28, size: 2.6, life: 2.9,
          upBias: 0.25, jitter: 32, driftX: 120, minSpeedFrac: 0.5,
        }),
      });
    }
  }

  /** 冰想: frost stars crystallize one by one along the water. */
  iceScene(time) {
    const ms = config.act1.milestones.ice;
    this.captions?.showStory(ms.caption[0], ms.caption[1]);
    const W = config.worldWidth;
    const H = config.worldHeight;
    for (let i = 0; i < ms.flakes; i += 1) {
      const x = ((i + 0.5) / ms.flakes - 0.5) * W * 0.86 + rand(-40, 40);
      this.pendingScenes.push({
        at: time + i * 0.55,
        fn: () => this.particles.settle({
          pts: flakePoints(rand(55, 95), 700),
          x, y: rand(-0.3, -0.16) * H,
          size: 2.3, life: 5.2, scatter: 110, stagger: 0.5,
        }),
      });
    }
  }

  /** 第三观: a golden gleam races out from the center — the ground is true. */
  berylScene(time) {
    const ms = config.act1.milestones.beryl;
    this.captions?.showStory(ms.caption[0], ms.caption[1]);
    const W = config.worldWidth;
    const H = config.worldHeight;
    for (let i = 0; i < 10; i += 1) {
      const fx = i / 9;
      for (const dir of [-1, 1]) {
        this.pendingScenes.push({
          at: time + fx * 1.6,
          fn: () => this.particles.burst({
            x: dir * fx * W * 0.48,
            y: -0.36 * H + rand(-14, 24),
            color: Math.random() < 0.5 ? config.palette.gold : config.palette.white,
            count: 90, speed: 24, size: 2.5, life: 2.6,
            upBias: 0.5, jitter: 26, driftX: dir * 150, minSpeedFrac: 0.5,
          }),
        });
      }
    }
  }

  /** A shooting light crosses part of the sky, trailing motes. */
  launchMeteor() {
    const W = config.worldWidth;
    const H = config.worldHeight;
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.tracers.push({
      x: -dir * rand(0.15, 0.48) * W,
      y: rand(0.12, 0.42) * H,
      t: 0,
      vx: dir * rand(260, 430),
      vy: rand(-50, 30),
      ax: 0,
      ay: rand(-60, -20),
      dur: rand(1.1, 2.0),
      rate: 0.014, emitAcc: 0,
      color: Math.random() < 0.6 ? config.palette.white : config.palette.gold,
      size: rand(2.6, 3.4),
    });
  }

  /** Where the sun currently hangs (climbs with the fullness meter). */
  sunY() {
    const s = config.act1.sun;
    return lerp(s.yLowFrac, s.yHighFrac, this.sunReveal) * config.worldHeight;
  }

  update(time, dt, ppwu) {
    const s = this.state;
    this.combos.update(time);

    // Milestone chapters fire as the meter crosses their thresholds;
    // the loop's return to darkness rewinds the story.
    if (s.phase === 'prologue') this.milestone = 0;
    this.milestoneCheck(time);
    if (this.pendingScenes.length) {
      const due = this.pendingScenes.filter((p) => time >= p.at);
      if (due.length) {
        this.pendingScenes = this.pendingScenes.filter((p) => time < p.at);
        for (const p of due) p.fn();
      }
    }

    // The sun kindles with the meter, holds through the acts, and sets
    // again in the coda; the prologue starts it dark.
    let fade = 1;
    if (s.phase === 'coda') fade = clamp01(1 - s.phaseTime / config.acts.codaFadeSec);
    if (s.phase === 'prologue' || s.phase === 'prison' || s.phase === 'epilogue') fade = 0;
    const target = s.fullness * fade;
    this.sunReveal += (target - this.sunReveal) * Math.min(1, dt * 0.8);
    this.sun.points.position.y = this.sunY();
    this.sun.update(
      { time, ppwu, wind: 0, sway: 0.8, warmth: 0.62, density: 1 },
      this.sunReveal,
    );

    // Tracers: streaks and meteors — moving emitters with real velocity
    // and curvature, each painting its own calligraphic line of motes.
    for (const k of this.tracers) {
      k.t += dt;
      k.vx += k.ax * dt;
      k.vy += k.ay * dt;
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.emitAcc += dt;
      const fade = 1 - Math.min(1, k.t / k.dur) * 0.5;
      while (k.emitAcc >= k.rate) {
        k.emitAcc -= k.rate;
        this.particles.burst({
          x: k.x, y: k.y,
          color: k.color,
          count: 9,
          speed: 6,
          size: k.size * fade,
          life: 1.2,
          upBias: 0.2,
          jitter: 2.5,
        });
      }
    }
    this.tracers = this.tracers.filter((k) => k.t < k.dur);

    // Shooting lights cross the sky now and then (only while acts play).
    if (s.phase === 'act1' || s.phase === 'act2' || s.phase === 'act3') {
      this.meteorIn -= dt;
      if (this.meteorIn <= 0) {
        this.launchMeteor();
        const base = config.act1.variety.meteorEverySec
          * (s.phase === 'act1' ? 1 : 2.2); // rarer once the world is grown
        this.meteorIn = base * rand(0.55, 1.6);
      }
    }

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
