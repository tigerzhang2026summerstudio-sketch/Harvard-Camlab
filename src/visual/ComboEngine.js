/**
 * ComboEngine — Act 1's pattern-reader. It watches HOW the keys are
 * played and answers special gestures with recognizable 图案 gathered
 * out of converging embers; as a pattern frays, a bilingual line of the
 * sutra occasionally forms from the same light. All thresholds, cooldowns
 * and passages live in config.act1.combos.
 *
 *   chord   3+ different keys at once → sutra imagery (lotus · moon ·
 *           sun · canopy · pagoda); big chords may condense a real
 *           Cave-217 mural crop out of the fire
 *   run     a fast flurry across the keys → a ribbon of rings sweeping
 *           the run's direction
 *   repeat  one key struck 3+ times in rhythm → a ceiling-medallion
 *           mandala that grows a ring with every further strike
 *   lowHigh a bass and a treble key together → a pillar of light
 *           joining earth and sky
 */
import { config } from '../config/config.js';
import {
  lotusPoints, moonPoints, sunPoints, canopyPoints, pagodaPoints,
  kalavinkaPoints, mandalaPoints, pillarPoints, ribbonPoints, textPoints,
  preloadMural, muralPointsFor,
} from './ComboPatterns.js';

const IMAGERY = ['lotus', 'moon', 'sun', 'canopy', 'pagoda', 'kalavinka', 'apsara'];
// The real flute-playing 飞天 (white plaster ground samples cleanly).
const APSARA_FILES = ['apsara-flute.jpg'];

export class ComboEngine {
  constructor(state, particles) {
    this.state = state;
    this.particles = particles;
    this.time = 0;
    this.recent = [];        // { t, note, x, y } — the last few seconds of keys
    this.lastFamily = {};    // family → time it last fired
    this.lastCombo = -1e9;
    this.lastText = -1e9;
    this.lastShape = '';
    this.repeatNote = -1;    // which note the growing mandala belongs to
    this.pending = [];       // scheduled ember-text spawns { at, fn }
    this.deck = [];          // shuffled passage indices (no repeats till empty)
    this.onCombo = null;     // optional hook (family, tier) → audio accent

    const cc = config.act1.combos;
    if (cc.enabled) {
      // Weathered photo crops need more motes than the parametric shapes.
      for (const f of cc.muralFiles) preloadMural(f, this.budget(cc.patternPoints * 2.4));
      // The apsara 图案 samples the real flute-playing 飞天 — its white
      // plaster ground drops away, leaving only the figure and ribbons.
      for (const f of APSARA_FILES) {
        preloadMural(f, this.budget(cc.patternPoints), { plasterSkip: true });
      }
    }
  }

  /** Point budgets follow the quality scale, but never drop unreadably low. */
  budget(n) {
    return Math.round(n * Math.max(0.4, config.qualityScale[config.quality].particleScale));
  }

  onKey(note, velocity, spec) {
    const cc = config.act1.combos;
    const ph = this.state.phase;
    if (!cc.enabled || (ph !== 'act1' && ph !== 'act2' && ph !== 'act3')) return;

    const now = this.time;
    this.recent.push({ t: now, note, x: spec.x, y: spec.y });

    const within = (sec) => this.recent.filter((r) => now - r.t <= sec);
    const canFire = (family) => now - this.lastCombo >= cc.globalCooldownSec
      && now - (this.lastFamily[family] ?? -1e9) >= cc.familyCooldownSec[family];

    // 1 · earth + sky struck together → the pillar
    const lh = within(cc.lowHighWindowSec);
    const lo = lh.find((r) => r.note <= cc.lowNote);
    const hi = lh.find((r) => r.note >= cc.highNote);
    if (lo && hi && canFire('lowHigh')) {
      this.fire('lowHigh', 1, () => this.spawnPillar((lo.x + hi.x) / 2));
      return;
    }

    // 2 · a chord of distinct keys → sutra imagery (or a mural, if big)
    const cluster = within(cc.chordWindowSec);
    const distinct = new Set(cluster.map((r) => r.note));
    if (distinct.size >= cc.chordMin && canFire('chord')) {
      let cx = 0; let cy = 0;
      for (const r of cluster) { cx += r.x; cy += r.y; }
      this.fire('chord', distinct.size, () => this.spawnImagery(
        cx / cluster.length, cy / cluster.length, distinct.size, velocity,
      ));
      return;
    }

    // 3 · the same key in rhythm → a mandala that grows each strike.
    //     Escalation bypasses the global cooldown (still rate-limited).
    const same = within(cc.repeatWindowSec).filter((r) => r.note === note);
    if (same.length >= cc.repeatMin) {
      const escalating = note === this.repeatNote
        && now - (this.lastFamily.repeat ?? -1e9) >= 0.45;
      if (canFire('repeat') || escalating) {
        const tier = Math.min(1 + same.length - cc.repeatMin, 4);
        this.repeatNote = note;
        this.fire('repeat', tier, () => this.spawnMandala(spec.x, spec.y, tier));
        return;
      }
    }

    // 4 · a fast run across the keys → the sweeping ribbon
    const run = within(cc.runWindowSec);
    if (run.length >= cc.runMin && canFire('run')) {
      const notes = run.map((r) => r.note);
      if (Math.max(...notes) - Math.min(...notes) >= cc.runSpanMin) {
        const dir = Math.sign(run[run.length - 1].note - run[0].note) || 1;
        let cx = 0; let cy = 0;
        for (const r of run) { cx += r.x; cy += r.y; }
        this.fire('run', 1, () => this.spawnRibbon(cx / run.length, cy / run.length, dir));
      }
    }
  }

  fire(family, tier, spawn) {
    const cc = config.act1.combos;
    this.lastCombo = this.time;
    this.lastFamily[family] = this.time;
    const where = spawn();
    this.onCombo?.(family, tier);

    // As the 图案 frays, the same light re-forms as a line of the sutra
    // (rate-limited so the wall never turns into a subtitle track).
    if (cc.text.enabled && this.time - this.lastText >= cc.text.everySec && where) {
      this.lastText = this.time;
      const at = this.time + cc.text.delaySec;
      this.pending.push({ at, fn: () => this.spawnText(where.x, where.y) });
    }
  }

  // ── The 图案 themselves ─────────────────────────────────────────────

  clampX(x, halfWidth) {
    const lim = config.worldWidth / 2 - halfWidth - 40;
    return Math.max(-lim, Math.min(lim, x));
  }

  spawnImagery(x, y, chordSize, velocity) {
    const cc = config.act1.combos;
    const H = config.worldHeight;
    const R = (110 + chordSize * 14) * (0.85 + velocity * 0.35);
    const cx = this.clampX(x, R * 1.6);
    const cy = Math.max(-0.22 * H, Math.min(0.36 * H, y));
    const budget = this.budget(cc.patternPoints);

    // Big chords sometimes condense a real Cave-217 crop out of the fire.
    if (chordSize >= cc.muralMinChord && Math.random() < cc.muralChance) {
      const file = cc.muralFiles[Math.floor(Math.random() * cc.muralFiles.length)];
      const mural = muralPointsFor(file);
      if (mural) {
        const hWorld = H * 0.32;
        const pts = mural.pts.map((p) => ({ x: p.x * hWorld, y: p.y * hWorld, col: p.col }));
        this.particles.settle({
          pts,
          x: this.clampX(x, (hWorld * mural.aspect) / 2),
          y: cy,
          size: 2.6,
          life: cc.patternLifeSec * 1.25,
          scatter: cc.gatherDist * 1.4,
          stagger: 1.4,
        });
        return { x: cx, y: cy - hWorld * 0.5 };
      }
    }

    let shape = IMAGERY[Math.floor(Math.random() * IMAGERY.length)];
    if (shape === this.lastShape) { // avoid showing the same 图案 twice running
      shape = IMAGERY[(IMAGERY.indexOf(shape) + 1) % IMAGERY.length];
    }

    // The apsara comes from the flying-figure art; if it isn't loaded
    // yet, fall back to a drawn shape.
    if (shape === 'apsara') {
      const file = APSARA_FILES[Math.floor(Math.random() * APSARA_FILES.length)];
      const apsara = muralPointsFor(file);
      if (apsara) {
        this.lastShape = shape;
        const hWorld = R * 2.1;
        this.particles.settle({
          pts: apsara.pts.map((p) => ({ x: p.x * hWorld, y: p.y * hWorld, col: p.col })),
          x: cx, y: cy,
          size: 2.5,
          life: cc.patternLifeSec,
          scatter: cc.gatherDist,
          stagger: 0.9,
        });
        return { x: cx, y: cy - R };
      }
      shape = 'kalavinka';
    }

    this.lastShape = shape;
    const gen = {
      lotus: lotusPoints, moon: moonPoints, sun: sunPoints,
      canopy: canopyPoints, pagoda: pagodaPoints, kalavinka: kalavinkaPoints,
    }[shape];
    this.particles.settle({
      pts: gen(R, budget),
      x: cx, y: cy,
      size: 2.6,
      life: cc.patternLifeSec,
      scatter: cc.gatherDist,
      stagger: 0.9,
    });
    return { x: cx, y: cy - R };
  }

  spawnMandala(x, y, tier) {
    const cc = config.act1.combos;
    const R = 85 + tier * 34; // grows with every further strike
    const cx = this.clampX(x, R * 1.1);
    const cy = Math.max(-0.22 * config.worldHeight, Math.min(0.34 * config.worldHeight, y));
    this.particles.settle({
      pts: mandalaPoints(R, tier, this.budget(cc.patternPoints * (0.7 + tier * 0.15))),
      x: cx, y: cy,
      size: 2.5,
      life: cc.patternLifeSec * (0.9 + tier * 0.1),
      scatter: cc.gatherDist,
      stagger: 0.7,
    });
    return { x: cx, y: cy - R };
  }

  spawnPillar(x) {
    const cc = config.act1.combos;
    const H = config.worldHeight * 0.78;
    const cx = this.clampX(x, 90);
    this.particles.settle({
      pts: pillarPoints(H, this.budget(cc.patternPoints)),
      x: cx, y: 0.02 * config.worldHeight,
      size: 2.6,
      life: cc.patternLifeSec * 1.15,
      scatter: cc.gatherDist * 1.3,
      stagger: 1.1,
    });
    return { x: cx, y: -0.18 * config.worldHeight };
  }

  spawnRibbon(x, y, dir) {
    const cc = config.act1.combos;
    const len = config.worldWidth * 0.34;
    const cx = this.clampX(x, len / 2 + 70);
    const cy = Math.max(-0.2 * config.worldHeight, Math.min(0.32 * config.worldHeight, y));
    this.particles.settle({
      pts: ribbonPoints(len, dir, this.budget(cc.patternPoints)),
      x: cx, y: cy,
      size: 2.5,
      life: cc.patternLifeSec,
      scatter: cc.gatherDist,
      stagger: 0.8,
    });
    return { x: cx, y: cy - 110 };
  }

  // ── Ember-formed sutra text ─────────────────────────────────────────

  nextPassage() {
    const list = config.act1.combos.text.passages;
    if (this.deck.length === 0) {
      this.deck = list.map((_, i) => i);
      for (let i = this.deck.length - 1; i > 0; i -= 1) { // shuffle
        const j = Math.floor(Math.random() * (i + 1));
        [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
      }
    }
    return list[this.deck.pop()];
  }

  spawnText(x, y) {
    const tc = config.act1.combos.text;
    const [zh, en] = this.nextPassage();
    const { pts, width } = textPoints(zh, en, tc.widthFrac * config.worldWidth, this.budget(tc.points));
    const H = config.worldHeight;
    this.particles.settle({
      pts,
      x: this.clampX(x, width / 2),
      y: Math.max(-0.28 * H, Math.min(0.3 * H, y)),
      size: 2.3,
      life: tc.lifeSec,
      scatter: 210, // the dying burst's embers gather in from far away
      stagger: 1.1,
    });
  }

  update(time) {
    this.time = time;
    if (this.recent.length && time - this.recent[0].t > 4) {
      this.recent = this.recent.filter((r) => time - r.t <= 4);
    }
    if (this.pending.length) {
      const due = this.pending.filter((p) => time >= p.at);
      if (due.length) {
        this.pending = this.pending.filter((p) => time < p.at);
        for (const p of due) p.fn();
      }
    }
  }
}
