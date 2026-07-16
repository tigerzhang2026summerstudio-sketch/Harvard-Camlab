/**
 * Act3 — "The Assembly & Rebirth". Pads are discrete invocations
 * (assignments live in config.act3.padMap):
 *
 *   A1–A3    the holy figures materialize heart-outward
 *   A4–B4    nine grades of rebirth: a soul-mote rises and a lotus blooms
 *            open at a height/color/scale set by its grade
 *   B5       blossom rain across the whole panorama
 *   B6       Vaidehī's awakening — she dissolves, the vision swells and
 *            holds radiant for one long breath (smooth, never a flash)
 *   B8       dissolution (StateManager routes it to the coda)
 *
 * The throne rises by itself when the act begins; the coda un-grows
 * everything; the prologue resets it for the next visualization.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { clamp01, lerp, rand, smooth01 } from '../core/Clock.js';
import { GrowthLayer } from './GrowthLayer.js';
import { buildThrone } from './Throne.js';
import { figureBuilder } from './Figures.js';
import { MuralDissolve } from './MuralDissolve.js';

export class Act3 {
  constructor(worldGroup, state, particles, post, vaidehi) {
    this.state = state;
    this.particles = particles;
    this.post = post;
    this.vaidehi = vaidehi;

    this.throne = new GrowthLayer(worldGroup, buildThrone, { intensity: 1.1 });
    this.figures = {};
    this.assembled = {};   // smoothed growth per figure
    this.targets = {};     // pad-set targets
    for (const name of ['amitabha', 'avalokitesvara', 'mahasthamaprapta']) {
      this.figures[name] = new GrowthLayer(
        worldGroup, figureBuilder(config.act3.figures[name]), { intensity: 1.15 },
      );
      this.assembled[name] = 0;
      this.targets[name] = 0;
    }

    this.throneGrowth = 0;
    this.souls = [];        // rebirth soul-motes in flight
    this.rainLeft = 0;      // blossom-rain seconds remaining
    this.rainTimer = 0;
    this.awakeningTime = -1;

    // Murals (Step 8): 'amitabha' assembles on pad A1 instead of the
    // procedural silhouette; 'panel' murals rise with the throne.
    this.amitabhaMural = null;
    this.panelMurals = [];
    this.panelAssemble = 0;
    for (const p of config.murals.panels) {
      const mural = new MuralDissolve(worldGroup, {
        url: `/murals/${p.file}`,
        x: p.x * config.worldWidth,
        y: p.yFrac * config.worldHeight,
        height: p.heightFrac * config.worldHeight,
      });
      if (p.role === 'amitabha') this.amitabhaMural = mural;
      else this.panelMurals.push(mural);
    }

    this.colBeryl = new THREE.Color(config.palette.beryl);
    this.colGold = new THREE.Color(config.palette.gold);
    this.colWhite = new THREE.Color(config.palette.white);
    this.color = new THREE.Color();

    state.on('phase', ({ phase }) => {
      if (phase === 'prologue') {
        for (const n of Object.keys(this.targets)) this.targets[n] = 0;
        this.souls = [];
        this.rainLeft = 0;
        this.awakeningTime = -1;
        this.vaidehi.reset();
      }
    });
  }

  onPad(e) {
    if (!e.on || this.state.phase !== 'act3') return;
    const action = config.act3.padMap[`${e.bank}${e.index + 1}`];
    if (!action || action === 'reserved' || action === 'dissolution') return;

    if (action in this.figures) {
      this.targets[action] = 1;
    } else if (action.startsWith('grade:')) {
      this.launchSoul(Number(action.split(':')[1]), e.velocity);
    } else if (action === 'blossomRain') {
      this.rainLeft = config.act3.rain.durationSec;
    } else if (action === 'awakening') {
      if (this.awakeningTime < 0) this.awakeningTime = 0;
      this.vaidehi.awaken();
    }
  }

  /** One of the nine grades: a soul-mote rises into an opening lotus. */
  launchSoul(grade, velocity) {
    const g = config.act3.grades;
    const f = grade / 8;
    this.color.lerpColors(this.colBeryl, this.colGold, Math.min(1, f * 1.6));
    if (f > 0.75) this.color.lerpColors(this.colGold, this.colWhite, (f - 0.75) * 4);

    const soul = {
      x: rand(-1, 1) * g.xSpread * config.worldWidth,
      y0: -config.worldHeight / 2 + config.ground.bandFrac * config.worldHeight * 0.5,
      y1: lerp(g.yMinFrac, g.yMaxFrac, f) * config.worldHeight,
      t: 0,
      dur: g.riseSec,
      scale: lerp(g.lotusScaleMin, g.lotusScaleMax, f),
      color: this.color.clone(),
      trail: 0,
    };
    this.souls.push(soul);

    // launch flash at the ground
    this.particles.burst({
      x: soul.x, y: soul.y0, color: soul.color,
      count: 90, speed: 40, size: 2.4, life: 1.6, upBias: 1.2, jitter: 8,
    });
  }

  updateSouls(dt) {
    for (const s of this.souls) {
      s.t += dt;
      const f = smooth01(Math.min(1, s.t / s.dur));
      const y = lerp(s.y0, s.y1, f);
      s.trail -= dt;
      if (s.t < s.dur && s.trail <= 0) {
        s.trail = 0.045;
        this.particles.burst({
          x: s.x + Math.sin(s.t * 5) * 6, y,
          color: s.color,
          count: 14, speed: 9, size: 2.2, life: 1.3, upBias: 0.2, jitter: 3,
        });
      } else if (s.t >= s.dur && !s.bloomed) {
        s.bloomed = true;
        // the lotus blooms open: colored corolla + white heart
        this.particles.burst({
          x: s.x, y: s.y1, color: s.color,
          count: Math.round(420 * s.scale), speed: 90 * s.scale,
          size: 3.2 * s.scale, life: 3.6, upBias: 0.25, jitter: 4,
        });
        this.particles.burst({
          x: s.x, y: s.y1, color: config.palette.white,
          count: Math.round(120 * s.scale), speed: 30 * s.scale,
          size: 2.6 * s.scale, life: 2.8, upBias: 0.4, jitter: 2,
        });
      }
    }
    this.souls = this.souls.filter((s) => !s.bloomed);
  }

  updateRain(dt) {
    if (this.rainLeft <= 0) return;
    this.rainLeft -= dt;
    this.rainTimer -= dt;
    if (this.rainTimer > 0) return;
    this.rainTimer = config.act3.rain.interval;

    const petals = ['cinnabar', 'gold', 'white'];
    this.particles.burst({
      x: rand(-0.48, 0.48) * config.worldWidth,
      y: config.worldHeight * rand(0.38, 0.5),
      color: config.palette[petals[Math.floor(Math.random() * petals.length)]],
      count: 22, speed: 12, size: 2.6, life: rand(5.5, 8),
      upBias: 0, jitter: 30,
      driftY: config.act3.rain.fallDrift,
      driftX: rand(-15, 15),
    });
  }

  /** B6: the whole vision brightens and holds — a slow swell, no flash. */
  updateAwakening(dt) {
    if (this.awakeningTime < 0) return;
    this.awakeningTime += dt;
    const a = config.act3.awakening;
    const t = this.awakeningTime;
    let env;
    if (t < a.riseSec) env = smooth01(t / a.riseSec);
    else if (t < a.riseSec + a.holdSec) env = 1;
    else env = 1 - smooth01((t - a.riseSec - a.holdSec) / a.fallSec);
    this.post.setSwell(1 + (a.swell - 1) * clamp01(env));
    if (env <= 0 && t > a.riseSec + a.holdSec) this.awakeningTime = -1;
  }

  update(time, dt, ppwu, shared) {
    const s = this.state;
    let fade = 1;
    if (s.phase === 'coda') fade = clamp01(1 - s.phaseTime / config.acts.codaFadeSec);
    if (s.phase === 'prologue') fade = 0;

    // The throne rises on its own as the act opens.
    const throneTarget = (s.phase === 'act3' || s.phase === 'coda') ? fade : 0;
    this.throneGrowth += (throneTarget - this.throneGrowth)
      * Math.min(1, dt / config.act3.throne.riseSec * 3);
    this.throne.update(shared, this.throneGrowth);

    const muralLive = this.amitabhaMural?.ready;
    for (const [name, layer] of Object.entries(this.figures)) {
      const target = this.targets[name] * fade;
      this.assembled[name] += (target - this.assembled[name])
        * Math.min(1, dt / config.act3.figures.assembleSec * 3);
      // When the Buddha mural is available it takes Amitāyus's place;
      // the procedural silhouette stays as the no-asset fallback.
      const growth = (name === 'amitabha' && muralLive) ? 0 : this.assembled[name];
      layer.update(shared, growth);
    }

    if (muralLive) {
      const a = this.assembled.amitabha;
      this.amitabhaMural.dissolve = 1 - a;
      this.amitabhaMural.alpha = Math.min(1, a * 5);
      this.amitabhaMural.update(time, ppwu);
    }

    // Panel murals (apsaras etc.) condense as the act opens, fray in the coda.
    this.panelAssemble += (throneTarget - this.panelAssemble)
      * Math.min(1, dt / config.act3.throne.riseSec * 2);
    for (const mural of this.panelMurals) {
      mural.dissolve = 1 - this.panelAssemble;
      mural.alpha = Math.min(1, this.panelAssemble * 5);
      mural.update(time, ppwu);
    }

    this.updateSouls(dt);
    this.updateRain(dt);
    this.updateAwakening(dt);
  }
}
