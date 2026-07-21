/**
 * Act3 — "The Sixteen Contemplations". Every pad tells one story from the
 * Contemplation Sutra (config.act3.padMap + stories): its caption appears
 * and its vision plays —
 *
 *   A1 setting sun · A2 water/ice · A3 beryl ground · A4 lotus throne
 *   A5 the image · A6 the true body (Buddha mural condenses) · A7/A8 the
 *   two bodhisattvas · B1 universal vision (panels + flower rain) ·
 *   B2 mixed vision · B3–B5 the nine rebirths in three grades ·
 *   B6 Vaidehī's awakening · B7 the prison (flashback) · B8 dissolution
 *
 * Real Cave 217 details (role 'story' murals) condense out of drifting
 * motes while their story is told, hold, and fray away again. The throne
 * rises when the act opens; the coda un-grows everything; the prologue
 * resets it all.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { clamp01, lerp, rand, smooth01 } from '../core/Clock.js';
import { GrowthLayer } from './GrowthLayer.js';
import { buildThrone } from './Throne.js';
import { figureBuilder } from './Figures.js';
import { instrumentCenters } from './Instruments.js';
import { MuralDissolve } from './MuralDissolve.js';
import { MuralSpotlight } from './MuralSpotlight.js';
import { flakePoints, lotusPoints } from './ComboPatterns.js';

export class Act3 {
  constructor(worldGroup, state, particles, post, vaidehi) {
    this.state = state;
    this.particles = particles;
    this.post = post;
    this.vaidehi = vaidehi;
    this.captions = null; // set by main once the captions module exists

    this.throne = new GrowthLayer(worldGroup, buildThrone, { intensity: 0.9 });
    this.figures = {};
    this.assembled = {};
    this.targets = {};
    for (const name of ['amitabha', 'avalokitesvara', 'mahasthamaprapta']) {
      this.figures[name] = new GrowthLayer(
        worldGroup, figureBuilder(config.act3.figures[name]), { intensity: 0.75 },
      );
      this.assembled[name] = 0;
      this.targets[name] = 0;
    }

    this.throneGrowth = 0;
    this.souls = [];
    this.rainLeft = 0;
    this.rainTimer = 0;
    this.awakeningTime = -1;
    this.haloTime = -1;        // rotating halo rays after the true body
    this.haloAcc = 0;
    this.universalOn = false;  // universal vision raises the panel murals
    this.sunTime = -1;         // the sinking sun
    this.waterTime = -1;       // the sweeping wave
    this.flashes = {};         // story → seconds since its mural was invoked
    this.riteIndex = 0;        // position in config.act3.rite (any pad advances)
    this.busyUntil = 0;        // phaseTime before which presses are ignored
    this.pending = [];         // staged vision waves { at (phaseTime), fn }
    // Each 观 lights its own painted panel on the real north wall.
    this.spotlight = new MuralSpotlight(worldGroup);
    this.onStory = null;       // main wires this to the audio accents

    // Murals: A6 assembles 'amitabha'; 'panel' murals answer B1;
    // 'story' murals condense while their pad's story is told.
    this.amitabhaMural = null;
    this.panelMurals = [];
    this.storyMurals = {};
    this.panelAssemble = 0;
    for (const p of config.murals.panels) {
      // Every panel option (cutoff, plasterSkip, invert, mask, retint,
      // intensity, gamma, gain, …) passes straight through to the mural.
      const mural = new MuralDissolve(worldGroup, {
        ...p,
        url: `/murals/${p.file}`,
        x: p.x * config.worldWidth,
        y: p.yFrac * config.worldHeight,
        height: p.heightFrac * config.worldHeight,
      });
      if (p.role === 'amitabha') this.amitabhaMural = mural;
      else if (p.role === 'story') this.storyMurals[p.story] = mural;
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
        this.universalOn = false;
        this.sunTime = -1;
        this.waterTime = -1;
        this.flashes = {};
        this.riteIndex = 0;
        this.busyUntil = 0;
        this.pending = [];
        this.vaidehi.reset();
      }
    });
  }

  onPad(e) {
    if (!e.on) return;
    if (this.state.phase !== 'act3') {
      // Struck too early: tell the performer where they are in the rite.
      const p = this.state.phase;
      if ((p === 'act1' || p === 'act2') && this.captions) {
        const now = performance.now();
        if (now - (this.lockHintAt ?? -1e9) > 8000) {
          this.lockHintAt = now;
          this.captions.show(config.captions.padsLocked);
        }
      }
      return;
    }
    // THE RITE keeps its own pace: ANY pad is "carry the rite onward" —
    // the next contemplation in order, and only once the current vision
    // has finished its time on stage. No skipping, no going back.
    const pt = this.state.phaseTime;
    if (pt < (this.busyUntil ?? 0)) return; // the vision must finish first

    const action = config.act3.rite[this.riteIndex];
    if (!action) return; // the telling is complete

    // The dissolution refuses to come before Act III's soft minimum.
    if (action === 'dissolution' && pt < config.acts.act3MinSec) {
      this.captions?.show(config.captions.dissolutionEarly);
      return;
    }

    this.riteIndex += 1;
    const busy = config.act3.busySec[action] ?? config.act3.busyDefaultSec;
    this.busyUntil = pt + busy;
    this.pending = []; // a new vision cancels the last one's queued waves

    // …and the wall itself remembers: light this 观's painted panel.
    this.spotlight.show(action, busy * 0.85);

    this.onStory?.(action);

    // The rite's final story releases the vision itself.
    if (action === 'dissolution') {
      this.state.go('coda');
      return;
    }

    // Every vision speaks its story — on a stage cleared of the last one.
    this.retireTransients(action);
    const story = config.act3.stories[action];
    if (story && this.captions) this.captions.showStory(story[0], story[1]);
    if (this.storyMurals[action]) this.flashes[action] = 0;

    // Staged waves: the once-weak 观s now play in movements.
    const queue = (at, fn) => this.pending.push({ at: pt + at, fn });

    switch (action) {
      case 'sun': this.sunTime = 0; break;
      case 'water': // the wave sweeps, stills, and returns
        this.waterTime = 0;
        queue(4.8, () => { this.waterTime = 0; });
        break;
      case 'groundFreeze': // the surge, then frost stars crystallize
        this.freezeSurge();
        for (let i = 0; i < 5; i += 1) {
          queue(1.2 + i * 0.6, () => this.particles.settle({
            pts: flakePoints(rand(60, 100), 700),
            x: rand(-0.4, 0.4) * config.worldWidth,
            y: rand(-0.32, -0.18) * config.worldHeight,
            size: 2.3, life: 5, scatter: 110, stagger: 0.5,
          }));
        }
        queue(4.2, () => this.freezeSurge());
        break;
      case 'treesStory': // three waves of glitter through the rows
        this.treesFlourish();
        queue(2.4, () => this.treesFlourish());
        queue(4.8, () => this.treesFlourish());
        break;
      case 'pondsStory':
        this.pondsFlourish();
        queue(2.4, () => this.pondsFlourish());
        queue(4.8, () => this.pondsFlourish());
        break;
      case 'musicStory':
        this.musicFlourish();
        queue(2.4, () => this.musicFlourish());
        queue(4.8, () => this.musicFlourish());
        break;
      case 'throne': { // the flower seat: mural + a great lotus opening
        this.throneGrowth = Math.max(this.throneGrowth, 0.12);
        const H = config.worldHeight;
        queue(0.4, () => this.particles.settle({
          pts: lotusPoints(210, 2800),
          x: 0, y: -0.13 * H,
          size: 2.6, life: 7, scatter: 190, stagger: 1.3,
        }));
        for (let i = 0; i < 6; i += 1) { // petals rise off the opening flower
          queue(1.4 + i * 0.8, () => this.particles.burst({
            x: rand(-160, 160), y: -0.16 * H,
            color: Math.random() < 0.5 ? config.palette.cinnabar : config.palette.gold,
            count: 60, speed: 26, size: 2.4, life: 4,
            upBias: 1.6, jitter: 24, driftY: 30,
          }));
        }
        break;
      }
      case 'image': { // the golden image forms; a ring of light announces it
        this.targets.amitabha = Math.max(this.targets.amitabha, 0.5);
        const H = config.worldHeight;
        for (let i = 0; i < 3; i += 1) {
          queue(0.3 + i * 1.4, () => this.particles.burst({
            x: 0, y: 0.08 * H,
            color: config.palette.gold,
            count: 220, speed: 130 + i * 40, size: 2.3, life: 3.2,
            upBias: 0.05, jitter: 8, minSpeedFrac: 0.92,
          }));
        }
        break;
      }
      case 'amitabha':
        this.targets[action] = 1;
        this.haloTime = 0; // his light sweeps the whole land
        break;
      case 'avalokitesvara':
      case 'mahasthamaprapta':
        this.targets[action] = 1;
        break;
      case 'universal':
        this.universalOn = true;
        this.rainLeft = config.act3.rain.durationSec;
        break;
      case 'mixed': // the vision flickers — twice
        this.mixedVision();
        queue(3.4, () => this.mixedVision());
        break;
      case 'gradesHigh':
      case 'gradesMid':
      case 'gradesLow': { // souls arrive in two flights
        for (const [k, grade] of config.act3.gradeGroups[action].entries()) {
          this.launchSoul(grade, 0.85 - k * 0.1);
        }
        queue(2.8, () => {
          for (const [k, grade] of config.act3.gradeGroups[action].entries()) {
            this.launchSoul(grade, 0.7 - k * 0.08);
          }
        });
        // 第十六观 — THE RESCUE: even the greatest sinner… a dim soul
        // rises out of the dark below, and a golden lotus descends step
        // by step to meet it, closes around it, and blooms.
        if (action === 'gradesLow') {
          const H = config.worldHeight;
          queue(0.8, () => this.particles.burst({
            x: 0, y: -0.47 * H,
            color: config.palette.lapis,
            count: 110, speed: 16, size: 2.3, life: 4,
            upBias: 2.4, jitter: 18, driftY: 95,
          }));
          for (let i = 0; i < 3; i += 1) { // the lotus descends in three breaths
            queue(1.2 + i * 1.1, () => this.particles.settle({
              pts: lotusPoints(105 + i * 18, 1500),
              x: 0, y: (0.16 - i * 0.1) * H,
              size: 2.4, life: 2.4, scatter: 90, stagger: 0.4,
            }));
          }
          queue(4.6, () => this.particles.settle({ // …and holds where they meet
            pts: lotusPoints(150, 2200),
            x: 0, y: -0.06 * H,
            size: 2.6, life: 5.5, scatter: 130, stagger: 0.6,
          }));
          queue(5.6, () => this.particles.burst({ // the bloom of welcome
            x: 0, y: -0.06 * H,
            color: config.palette.gold,
            count: 320, speed: 120, size: 2.6, life: 3.2,
            upBias: 0.5, jitter: 14,
          }));
        }
        break;
      }
      case 'awakening': { // 开悟 — her mind opens like a lotus at first light
        if (this.awakeningTime < 0) this.awakeningTime = 0;
        this.vaidehi.awaken();
        const H = config.worldHeight;
        const W = config.worldWidth;
        const vx = this.vaidehi.x ?? -0.055 * W;
        const vy = -0.4 * H;
        for (let i = 0; i < 4; i += 1) { // radiant rings burst from the queen
          queue(0.3 + i * 0.9, () => this.particles.burst({
            x: vx, y: vy,
            color: i % 2 ? config.palette.gold : config.palette.white,
            count: 240, speed: 150 + i * 55, size: 2.4, life: 3.4,
            upBias: 0.35, jitter: 6, minSpeedFrac: 0.92,
          }));
        }
        for (let i = 0; i < 10; i += 1) { // petals spiral up around her
          queue(0.8 + i * 0.35, () => this.particles.burst({
            x: vx + rand(-70, 70), y: vy + rand(0, 70),
            color: Math.random() < 0.5 ? config.palette.cinnabar : config.palette.white,
            count: 42, speed: 30, size: 2.3, life: 4.5,
            upBias: 2.6, swirl: 0.8, jitter: 12, driftY: 60,
          }));
        }
        for (let i = 0; i < 12; i += 1) { // a wave of light washes the wall
          const fx = i / 11;
          queue(2 + fx * 2.4, () => this.particles.burst({
            x: (fx - 0.5) * W * 0.95, y: rand(-0.1, 0.28) * H,
            color: config.palette.white,
            count: 70, speed: 20, size: 2.2, life: 3.4,
            upBias: 1.3, jitter: 60,
          }));
        }
        break;
      }
      default: break;
    }
  }

  /** 第三观 — the freeze surges: the ground meter jumps, glints run out. */
  freezeSurge() {
    this.state.fullness = clamp01(this.state.fullness + 0.28);
    const H = config.worldHeight;
    for (let i = 0; i < 10; i += 1) {
      this.particles.burst({
        x: ((i + 0.5) / 10 - 0.5) * config.worldWidth,
        y: -H / 2 + config.ground.bandFrac * H * rand(0.3, 0.9),
        color: Math.random() < 0.5 ? config.palette.beryl : config.palette.white,
        count: 70, speed: 24, size: 2.2, life: 2.6, upBias: 0.5, jitter: 40,
      });
    }
  }

  /** 第四观 — the tree rows glitter: bursts through both side thirds. */
  treesFlourish() {
    const W = config.worldWidth;
    const H = config.worldHeight;
    const groundTop = -H / 2 + config.ground.bandFrac * H * 0.7;
    for (let i = 0; i < 12; i += 1) {
      const side = i % 2 ? 1 : -1;
      this.particles.burst({
        x: side * rand(0.2, 0.46) * W,
        y: groundTop + rand(30, 150),
        color: Math.random() < 0.6 ? config.palette.malachite : config.palette.gold,
        count: 70, speed: 34, size: 2.4, life: 2.6, upBias: 0.5, jitter: 26,
      });
    }
  }

  /** 第五观 — the ponds answer: ripple-glow along the water band. */
  pondsFlourish() {
    const W = config.worldWidth;
    const H = config.worldHeight;
    const yWater = -H / 2 + config.ground.bandFrac * H * 0.45;
    for (let i = 0; i < 10; i += 1) {
      this.particles.burst({
        x: ((i + 0.5) / 10 - 0.5) * W * 0.86,
        y: yWater + rand(-6, 10),
        color: Math.random() < 0.7 ? config.palette.beryl : config.palette.white,
        count: 80, speed: 26, size: 2.3, life: 2.4, upBias: 0.6, jitter: 34,
      });
    }
  }

  /** 第六观 — every hanging instrument showers note-light at once. */
  musicFlourish() {
    for (const c of instrumentCenters) {
      this.particles.burst({
        x: c.x, y: c.y,
        color: Math.random() < 0.6 ? config.palette.gold : config.palette.white,
        count: 40, speed: 20, size: 2.4, life: 3.4, upBias: 1.6, jitter: 10,
      });
    }
  }

  /** 第十三观 — the vision flickers: every instrument showers note-light. */
  mixedVision() {
    const H = config.worldHeight;
    for (let i = 0; i < 12; i += 1) {
      this.particles.burst({
        x: rand(-0.45, 0.45) * config.worldWidth,
        y: rand(0.05, 0.4) * H,
        color: [config.palette.gold, config.palette.beryl, config.palette.cinnabar][i % 3],
        count: 90, speed: 55, size: 2.6, life: 3, upBias: 0.3, jitter: 12,
      });
    }
  }

  /** One of the nine grades: a soul-mote rises into an opening lotus. */
  launchSoul(grade, velocity) {
    const g = config.act3.grades;
    const f = grade / 8;
    this.color.lerpColors(this.colBeryl, this.colGold, Math.min(1, f * 1.6));
    if (f > 0.75) this.color.lerpColors(this.colGold, this.colWhite, (f - 0.75) * 4);

    this.souls.push({
      x: rand(-1, 1) * g.xSpread * config.worldWidth,
      y0: -config.worldHeight / 2 + config.ground.bandFrac * config.worldHeight * 0.5,
      y1: lerp(g.yMinFrac, g.yMaxFrac, f) * config.worldHeight,
      t: -rand(0, 0.6), // slight stagger inside a grade group
      dur: g.riseSec,
      scale: lerp(g.lotusScaleMin, g.lotusScaleMax, f),
      color: this.color.clone(),
      trail: 0,
    });

    this.particles.burst({
      x: this.souls[this.souls.length - 1].x,
      y: this.souls[this.souls.length - 1].y0,
      color: this.color,
      count: 90, speed: 40, size: 2.4, life: 1.6, upBias: 1.2, jitter: 8,
    });
  }

  updateSouls(dt) {
    for (const s of this.souls) {
      s.t += dt;
      if (s.t < 0) continue;
      const f = smooth01(Math.min(1, s.t / s.dur));
      const y = lerp(s.y0, s.y1, f);
      s.trail -= dt;
      if (s.t < s.dur && s.trail <= 0) {
        s.trail = 0.04;
        this.particles.burst({
          x: s.x + Math.sin(s.t * 5) * 6, y,
          color: s.color,
          count: 14, speed: 9, size: 2.2, life: 1.3, upBias: 0.2, jitter: 3,
        });
      } else if (s.t >= s.dur && !s.bloomed) {
        s.bloomed = true;
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

    // Two falls per tick; most are blossom RINGS (a thin expanding circle
    // drifting down reads as an open flower), the rest soft petal puffs.
    const petals = ['cinnabar', 'gold', 'white'];
    for (let i = 0; i < 2; i += 1) {
      const ring = Math.random() < 0.6;
      this.particles.burst({
        x: rand(-0.48, 0.48) * config.worldWidth,
        y: config.worldHeight * rand(0.38, 0.52),
        color: config.palette[petals[Math.floor(Math.random() * petals.length)]],
        count: ring ? 26 : 20,
        speed: ring ? 26 : 12,
        size: ring ? 2.3 : 2.6,
        life: rand(5.5, 8),
        upBias: 0, jitter: ring ? 4 : 30,
        minSpeedFrac: ring ? 0.85 : 0.25,
        driftY: config.act3.rain.fallDrift,
        driftX: rand(-15, 15),
      });
    }
  }

  /** After the true body: four spokes of light wheel slowly around him. */
  updateHalo(dt) {
    if (this.haloTime < 0) return;
    this.haloTime += dt;
    if (this.haloTime >= 7) { this.haloTime = -1; return; }
    this.haloAcc += dt;
    const cx = config.act3.figures.amitabha.x * config.worldWidth;
    const cy = 0.16 * config.worldHeight;
    const env = Math.sin(Math.min(1, this.haloTime / 7) * Math.PI); // in & out
    while (this.haloAcc >= 0.03) {
      this.haloAcc -= 0.03;
      const base = this.haloTime * 0.7;
      for (let s = 0; s < 4; s += 1) {
        const ang = base + (s / 4) * Math.PI * 2;
        const d = rand(90, 330);
        this.particles.burst({
          x: cx + Math.cos(ang) * d,
          y: cy + Math.sin(ang) * d * 0.8,
          color: Math.random() < 0.6 ? config.palette.gold : config.palette.white,
          count: Math.round(8 * env) + 2,
          speed: 8, size: 2.2, life: 1.4, upBias: 0.1, jitter: 4,
        });
      }
    }
  }

  /** 第一观 — a great soft sun sinks in the west, red to ember-gold. */
  updateSun(dt) {
    if (this.sunTime < 0) return;
    this.sunTime += dt;
    const s = config.act3.sun;
    const f = this.sunTime / s.durationSec;
    if (f >= 1) { this.sunTime = -1; return; }
    this.sunTimer = (this.sunTimer ?? 0) - dt;
    if (this.sunTimer > 0) return;
    this.sunTimer = 0.28;
    const y = lerp(s.yTopFrac, s.yEndFrac, smooth01(f)) * config.worldHeight;
    this.color.set(config.palette.cinnabar).lerp(this.colGold, f * 0.8);
    this.particles.burst({
      x: s.x * config.worldWidth + rand(-6, 6),
      y,
      color: this.color,
      count: 130, speed: 26, size: 2.7, life: 2.8,
      upBias: -0.15, jitter: 26,
    });
  }

  /** 第二观 — a wave of clear water sweeps the ground, west to east. */
  updateWater(dt) {
    if (this.waterTime < 0) return;
    this.waterTime += dt;
    const f = this.waterTime / config.act3.water.sweepSec;
    if (f >= 1) { this.waterTime = -1; return; }
    this.waterTimer = (this.waterTimer ?? 0) - dt;
    if (this.waterTimer > 0) return;
    this.waterTimer = 0.06;
    const H = config.worldHeight;
    this.particles.burst({
      x: (f - 0.5) * config.worldWidth * 0.96,
      y: -H / 2 + config.ground.bandFrac * H * rand(0.4, 1.1),
      color: Math.random() < 0.75 ? config.palette.beryl : config.palette.white,
      count: 80, speed: 30, size: 2.4, life: 2.2, upBias: 0.4, jitter: 24,
    });
  }

  /**
   * Story murals: particles condense in, then the REAL photograph fades
   * in through them (the particles recede while it holds, so the image
   * reads clean instead of glowing to white), then photo out → fray out.
   */
  updateFlashes(dt, time, ppwu) {
    const fx = config.act3.storyFlash;
    for (const [story, mural] of Object.entries(this.storyMurals)) {
      if (!mural.ready) continue;
      if (story in this.flashes) {
        this.flashes[story] += dt;
        const t = this.flashes[story];
        let assemble;
        if (t < fx.inSec) assemble = smooth01(t / fx.inSec);
        else if (t < fx.inSec + fx.holdSec) assemble = 1;
        else assemble = 1 - smooth01((t - fx.inSec - fx.holdSec) / fx.outSec);
        mural.dissolve = 1 - assemble;

        // The photo lives INSIDE the hold: in over ~1.8s, out before the
        // particles begin to fray, particles dimming while it reigns.
        const th = t - fx.inSec; // time within the hold
        let photo = 0;
        if (th > 0 && th < fx.holdSec) {
          photo = Math.min(smooth01(th / 1.8), smooth01((fx.holdSec - th) / 1.4));
        }
        mural.photo = photo;
        mural.alpha = Math.min(0.8, assemble * 4) * (1 - photo * 0.7);
        if (t > fx.inSec + fx.holdSec + fx.outSec) delete this.flashes[story];
      } else {
        mural.alpha = 0;
        mural.dissolve = 1;
        mural.photo = 0;
      }
      mural.update(time, ppwu);
    }
  }

  /**
   * ONE STORY AT A TIME: a new vision gracefully retires the transient
   * effects of the last — murals jump to their fray-out, the rain thins
   * to a last few petals, the halo completes its sweep. The assembly
   * itself (throne, figures) is persistent and stays.
   */
  retireTransients(except) {
    const fx = config.act3.storyFlash;
    for (const k of Object.keys(this.flashes)) {
      if (k !== except) {
        this.flashes[k] = Math.max(this.flashes[k], fx.inSec + fx.holdSec);
      }
    }
    this.rainLeft = Math.min(this.rainLeft, 1.2);
    if (this.haloTime >= 0) this.haloTime = Math.max(this.haloTime, 5.6);
    if (this.sunTime >= 0) {
      this.sunTime = Math.max(this.sunTime, config.act3.sun.durationSec - 1.5);
    }
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
    if (s.phase === 'prologue' || s.phase === 'prison' || s.phase === 'epilogue') fade = 0;

    const throneTarget = (s.phase === 'act3' || s.phase === 'coda') ? fade : 0;
    this.throneGrowth += (throneTarget - this.throneGrowth)
      * Math.min(1, dt / config.act3.throne.riseSec * 3);
    this.throne.update(shared, this.throneGrowth);

    const muralLive = this.amitabhaMural?.ready;
    for (const [name, layer] of Object.entries(this.figures)) {
      const target = this.targets[name] * fade;
      this.assembled[name] += (target - this.assembled[name])
        * Math.min(1, dt / config.act3.figures.assembleSec * 3);
      const growth = (name === 'amitabha' && muralLive) ? 0 : this.assembled[name];
      layer.update(shared, growth);
    }

    if (muralLive) {
      const a = this.assembled.amitabha;
      this.amitabhaMural.dissolve = 1 - a;
      this.amitabhaMural.alpha = Math.min(1, a * 5);
      this.amitabhaMural.update(time, ppwu);
    }

    // Panel murals wait for the Universal Vision (B1), fray in the coda.
    const panelTarget = this.universalOn ? throneTarget : 0;
    this.panelAssemble += (panelTarget - this.panelAssemble)
      * Math.min(1, dt / config.act3.throne.riseSec * 2);
    for (const mural of this.panelMurals) {
      mural.dissolve = 1 - this.panelAssemble;
      mural.alpha = Math.min(1, this.panelAssemble * 5) * (1 - this.panelAssemble * 0.6);
      mural.photo = this.panelAssemble; // the real 飞天 come through fully assembled
      mural.update(time, ppwu);
    }

    // Staged vision waves fire on the act's own clock.
    if (this.pending.length && this.state.phase === 'act3') {
      const pt = this.state.phaseTime;
      const due = this.pending.filter((p) => pt >= p.at);
      if (due.length) {
        this.pending = this.pending.filter((p) => pt < p.at);
        for (const p of due) p.fn();
      }
    }
    this.spotlight.update(dt, this.state.phase);

    this.updateSouls(dt);
    this.updateRain(dt);
    this.updateHalo(dt);
    this.updateSun(dt);
    this.updateWater(dt);
    this.updateFlashes(dt, time, ppwu);
    this.updateAwakening(dt);
  }
}
