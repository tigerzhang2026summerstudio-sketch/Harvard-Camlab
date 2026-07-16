/**
 * Figures — the holy assembly as towering silhouettes of light:
 * Amitāyus seated on the throne, the two bodhisattvas standing on lotuses
 * at his sides. Procedural point-silhouettes (head, halo, robed body,
 * mudrā hands, almond mandorla) that materialize HEART-OUTWARD — each
 * point's reveal stage grows with its distance from the figure's heart.
 * (Step 8 will let real Cave 217 murals dissolve in via MuralDissolve.)
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { clamp01, rand } from '../core/Clock.js';

const TONES = {
  gold:      ['gold', 'white'],
  beryl:     ['beryl', 'white'],
  malachite: ['malachite', 'white'],
};

/** Returns a builder for one figure spec (see config.act3.figures). */
export function figureBuilder(spec) {
  return (add) => {
    const density = Math.max(config.qualityScale[config.quality].particleScale, 0.3);
    const W = config.worldWidth;
    const H = config.worldHeight;

    const h = spec.height * H;                       // figure height
    const cx = spec.x * W;
    const baseY = -H / 2 + config.ground.bandFrac * H * (spec.seated ? 0.62 : 0.5)
      + (spec.seated ? 40 : 0);                      // Amitāyus sits on the seat
    const heartY = baseY + h * 0.45;

    const [toneA, toneB] = TONES[spec.tone];
    const cA = new THREE.Color(config.palette[toneA]);
    const cB = new THREE.Color(config.palette[toneB]);
    const gold = new THREE.Color(config.palette.gold);
    const c = new THREE.Color();

    // Heart-outward assembly: far points condense last.
    const stageOf = (x, y) => {
      const d = Math.hypot((x - cx) / h, (y - heartY) / h);
      return clamp01(d * 1.35) * 0.62 + rand(0, 0.22);
    };

    const put = (x, y, size, col, sway = 0.7, stage = null) => {
      add(x, y, size, col, stage ?? stageOf(x, y), sway, 0);
    };

    // head — a hot disc of light
    const headY = baseY + h * 0.78;
    for (let i = 0; i < Math.round(70 * density) + 12; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * h * 0.052;
      c.lerpColors(cB, gold, Math.random() * 0.4).multiplyScalar(1.5);
      put(cx + Math.cos(a) * r, headY + Math.sin(a) * r, rand(2.2, 3.4), c);
    }

    // halo — ring behind the head, appears mid-assembly
    for (let i = 0; i < Math.round(110 * density) + 16; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = h * 0.105 * rand(0.96, 1.04);
      c.copy(gold).multiplyScalar(rand(1.0, 1.4));
      add(cx + Math.cos(a) * r, headY + Math.sin(a) * r, rand(1.8, 2.8), c,
        0.45 + rand(0, 0.2), 0.8, 0);
    }

    // torso — shoulders tapering to the waist
    for (let i = 0; i < Math.round(320 * density) + 40; i += 1) {
      const f = Math.random();                         // 0 shoulders → 1 waist
      const halfw = h * (0.13 - 0.03 * f);
      const y = baseY + h * (0.62 - 0.3 * f);
      const x = cx + rand(-1, 1) * halfw;
      const edge = Math.abs(x - cx) / halfw;           // robe edges glow cooler
      c.lerpColors(cB, cA, edge * 0.8).multiplyScalar(rand(0.75, 1.1));
      put(x, y, rand(1.9, 3.0), c, 0.8);
    }

    // base — seated: wide folded-leg triangle; standing: falling robe column
    for (let i = 0; i < Math.round(340 * density) + 40; i += 1) {
      const f = Math.random();
      const halfw = spec.seated
        ? h * (0.10 + 0.11 * f)
        : h * (0.10 + 0.015 * f);
      const y = baseY + h * (0.32 - 0.28 * f);
      const x = cx + rand(-1, 1) * halfw;
      const edge = Math.abs(x - cx) / halfw;
      c.lerpColors(cB, cA, 0.35 + edge * 0.6).multiplyScalar(rand(0.7, 1.05));
      put(x, y, rand(1.9, 3.0), c, 0.7);
    }

    // hands — mudrā, a bright knot of light before the heart
    for (let i = 0; i < Math.round(46 * density) + 8; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * h * 0.035;
      c.lerpColors(cB, gold, Math.random() * 0.5).multiplyScalar(1.55);
      put(cx + Math.cos(a) * r, baseY + h * 0.36 + Math.sin(a) * r * 0.7, rand(2.0, 3.2), c, 0.5);
    }

    // mandorla — the almond aura, completing last
    for (let i = 0; i < Math.round(240 * density) + 30; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const rx = h * 0.30; const ry = h * 0.5;
      const rr = rand(0.97, 1.03);
      c.lerpColors(cA, gold, Math.random() * 0.5).multiplyScalar(rand(0.45, 0.75));
      add(
        cx + Math.cos(a) * rx * rr,
        heartY + h * 0.03 + Math.sin(a) * ry * rr,
        rand(1.6, 2.6), c,
        0.7 + rand(0, 0.25), 1.4, 0,
      );
    }
  };
}
