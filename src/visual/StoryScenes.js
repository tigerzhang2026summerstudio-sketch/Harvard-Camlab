/**
 * StoryScenes — the narrated bookends of the arc.
 *
 * PRISON (after the first key): Vaidehī's story told line by line
 * (config.prison.lines; keys pace it), while the real Cave-217 prison
 * mural holds dimly on the wall, re-condensing as it frays.
 *
 * EPILOGUE (after the coda): a single lotus of light stays lit in the
 * darkness, the closing line appears, and the cave wall itself glows
 * once (backdrop opacityByPhase.epilogue) before the loop returns.
 */
import { config } from '../config/config.js';
import {
  lotusPoints, cityPoints, sevenWallsPoints, queenPoints, cagePoints,
  peakPoints, preloadMural, muralPointsFor,
} from './ComboPatterns.js';

export class StoryScenes {
  constructor(state, particles, captions) {
    this.state = state;
    this.particles = particles;
    this.captions = captions;
    this.time = 0;
    this.muralAt = -1e9;   // last prison-mural condensation
    this.lotusAt = -1e9;   // last epilogue lotus refresh
    this.epilogueLineShown = false;

    this.budget = Math.round(
      5200 * Math.max(0.4, config.qualityScale[config.quality].particleScale),
    );
    preloadMural(config.prison.mural, this.budget);
    // The final line reveals the Buddha (SVG art — keep its whites).
    preloadMural('buddha-placeholder.svg', this.budget, { plasterSkip: false });

    state.on('prisonLine', ({ index }) => {
      const [title, line] = config.prison.lines[index];
      this.captions.showStory(title, line);
      this.prisonStage(index);
    });
    this.pending = []; // scheduled interlude steps { at, fn }
    state.on('phase', ({ phase }) => {
      this.pending = []; // a phase change cancels any stale interlude
      if (phase === 'epilogue') {
        this.epilogueLineShown = false;
        this.lotusAt = -1e9;
      }
      if (phase === 'act2') this.scheduleAct2Interlude();
      if (phase === 'act3') this.scheduleAct3Interlude();
      if (phase === 'coda') {
        // The gatha completes mid-storm: …如露亦如电，应作如是观。
        this.pending.push({
          at: this.time + config.acts.codaFadeSec * 0.52,
          fn: () => {
            const [title, line] = config.captions.codaSecond;
            this.captions.showStory(title, line);
          },
        });
      }
    });
  }

  /**
   * The prison prologue as a STAGE PLAY: every line of the story raises
   * its own scenery out of the dark — the city, the seven walls, the
   * queen with her offering, her cell, the far peak she bows toward,
   * and finally the Buddha's arrival.
   */
  prisonStage(index) {
    const W = config.worldWidth;
    const H = config.worldHeight;
    const b = Math.round(this.budget * 0.55); // scenery stays background-dim
    const hold = { size: 2.2, life: 8, scatter: 130, stagger: 1.6 };
    const queenX = -0.27 * W;   // the queen stands well left of the centre caption

    switch (index) {
      case 0: // 王舍城 — the great city rises across the horizon
        this.particles.settle({
          pts: cityPoints(0.85 * W, 0.24 * H, Math.round(b * 1.3)),
          x: 0, y: -0.3 * H, ...hold,
        });
        break;
      case 1: // 七重牢 — seven walls close around the king, in the east
        this.particles.settle({
          pts: sevenWallsPoints(0.26 * H, b),
          x: 0.24 * W, y: -0.24 * H, ...hold,
        });
        break;
      case 2: { // 韦提希 — the queen crosses toward the walls, bowl in hand
        this.particles.settle({
          pts: queenPoints(0.2 * H, b),
          x: queenX, y: -0.12 * H, ...hold,
        });
        // her offering drifts quietly toward the prison
        for (let i = 0; i < 8; i += 1) {
          this.pending.push({ at: this.time + 1.5 + i * 0.7, fn: () => this.particles.burst({
            x: queenX + 0.05 * W, y: -0.06 * H,
            color: config.palette.gold,
            count: 26, speed: 8, size: 2.0, life: 3.4,
            upBias: 0.1, jitter: 8, driftX: 90,
          }) });
        }
        break;
      }
      case 3: // 幽闭 — the bars come down around her
        this.particles.settle({
          pts: cagePoints(0.13 * W, 0.36 * H, b),
          x: queenX, y: -0.1 * H, ...hold, scatter: 200, stagger: 0.8,
        });
        break;
      case 4: { // 悲泣 — the far peak appears; her plea rises toward it
        this.particles.settle({
          pts: peakPoints(0.2 * H, b),
          x: -0.36 * W, y: 0.22 * H, ...hold,
        });
        for (let i = 0; i < 14; i += 1) {
          const f = i / 13;
          this.pending.push({ at: this.time + 1.2 + f * 3.5, fn: () => this.particles.burst({
            x: queenX + (-0.36 * W - queenX + 0.03 * W) * f,
            y: -0.05 * H + (0.27 * H + 0.05 * H) * f,
            color: Math.random() < 0.7 ? config.palette.white : config.palette.gold,
            count: 16, speed: 6, size: 2.0, life: 2.6,
            upBias: 0.4, jitter: 6,
          }) });
        }
        break;
      }
      case 5: { // 佛来 — the Buddha appears before her cell, radiant
        const buddha = muralPointsFor('buddha-placeholder.svg');
        if (buddha) {
          const hW = 0.4 * H;
          this.particles.settle({
            pts: buddha.pts.map((p) => ({
              x: p.x * hW, y: p.y * hW, col: p.col.clone().multiplyScalar(0.85),
            })),
            x: 0.02 * W, y: 0.06 * H,
            size: 2.4, life: 8.5, scatter: 220, stagger: 1.8,
          });
        }
        for (let i = 0; i < 6; i += 1) { // soft radiance spreading from him
          this.pending.push({ at: this.time + 2 + i * 0.6, fn: () => this.particles.burst({
            x: 0.02 * W, y: 0.06 * H,
            color: Math.random() < 0.6 ? config.palette.gold : config.palette.white,
            count: 60, speed: 40, size: 2.2, life: 3,
            upBias: 0.15, jitter: 20, minSpeedFrac: 0.75,
          }) });
        }
        break;
      }
      default: break;
    }
  }

  /** A slow gleam surveys the finished ground, then the linking line. */
  scheduleAct2Interlude() {
    const il = config.interludes.act2;
    const W = config.worldWidth;
    const H = config.worldHeight;
    const t0 = this.time + il.atSec;
    this.pending.push({ at: t0, fn: () => {
      const [title, line] = il.line;
      this.captions.showStory(title, line);
    } });
    for (let i = 0; i < 14; i += 1) {
      this.pending.push({ at: t0 + i * 0.3, fn: () => this.particles.burst({
        x: ((i + 0.5) / 14 - 0.5) * W * 0.92,
        y: -0.37 * H + Math.random() * 30,
        color: Math.random() < 0.55 ? config.palette.beryl : config.palette.white,
        count: 80, speed: 20, size: 2.4, life: 3.2,
        upBias: 0.7, jitter: 30, driftX: 60, minSpeedFrac: 0.4,
      }) });
    }
  }

  /** A ring of light circles the throne before the assembly is called. */
  scheduleAct3Interlude() {
    const il = config.interludes.act3;
    const H = config.worldHeight;
    const t0 = this.time + il.atSec;
    this.pending.push({ at: t0, fn: () => {
      const [title, line] = il.line;
      this.captions.showStory(title, line);
    } });
    for (let i = 0; i < 16; i += 1) {
      const ang = (i / 16) * Math.PI * 2;
      this.pending.push({ at: t0 + i * 0.22, fn: () => this.particles.burst({
        x: Math.cos(ang) * 260,
        y: -0.1 * H + Math.sin(ang) * 90,
        color: Math.random() < 0.6 ? config.palette.gold : config.palette.white,
        count: 60, speed: 16, size: 2.4, life: 2.6,
        upBias: 0.4, jitter: 14, minSpeedFrac: 0.5,
      }) });
    }
  }

  update(time) {
    this.time = time;
    const s = this.state;

    if (this.pending.length) {
      const due = this.pending.filter((p) => time >= p.at);
      if (due.length) {
        this.pending = this.pending.filter((p) => time < p.at);
        for (const p of due) p.fn();
      }
    }

    if (s.phase === 'prison') {
      // The prison mural holds on the wall — dim, patient, re-condensing.
      if (time - this.muralAt >= 4.6) {
        const m = muralPointsFor(config.prison.mural);
        if (m) {
          this.muralAt = time;
          const hW = config.worldHeight * 0.44;
          this.particles.settle({
            pts: m.pts.map((p) => ({
              x: p.x * hW, y: p.y * hW, col: p.col.clone().multiplyScalar(0.4),
            })),
            x: 0.26 * config.worldWidth,
            y: 0.06 * config.worldHeight,
            size: 2.1, life: 6.4, scatter: 90, stagger: 2.2,
          });
        }
      }
    }

    if (s.phase === 'epilogue') {
      // 心光 FIRST: the mind's light rises at CENTER — its lotus and the
      // line — and only a short beat later does the painting return behind
      // it (Backdrop.endReveal, delayed via endReveal.inAt). The light of
      // the mind that saw the vision comes before the vision reassembles.
      const heartAt = config.epilogue.heartAt ?? 1.5;
      if (s.phaseTime >= heartAt
          && s.phaseTime <= config.acts.epilogueSec - 4 && time - this.lotusAt >= 4.4) {
        this.lotusAt = time;
        this.particles.settle({
          pts: lotusPoints(110, Math.round(this.budget * 0.6)),
          x: 0, y: -0.08 * config.worldHeight,
          size: 2.4, life: 5.6, scatter: 130, stagger: 1.4,
        });
      }
      if (!this.epilogueLineShown && s.phaseTime >= heartAt) {
        this.epilogueLineShown = true;
        const [title, line] = config.epilogue.line;
        this.captions.showStory(title, line);
      }
    }
  }
}
