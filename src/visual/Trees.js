/**
 * Trees — K1: seven rows of jeweled trees along the side thirds.
 * Growth order mirrors the sutra's vision assembling: trunks rise first,
 * then branches reach out, canopies of malachite-beryl light fill in, and
 * finally gold jewel-fruit ignites at the tips.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { rand } from '../core/Clock.js';

export function buildTrees(add) {
  const t = config.act2.trees;
  const qs = config.qualityScale[config.quality].particleScale;
  const density = Math.max(qs, 0.3);

  const W = config.worldWidth;
  const H = config.worldHeight;
  const groundTop = -H / 2 + config.ground.bandFrac * H * 0.7;

  const gold = new THREE.Color(config.palette.gold);
  const malachite = new THREE.Color(config.palette.malachite);
  const beryl = new THREE.Color(config.palette.beryl);
  const white = new THREE.Color(config.palette.white);
  const c = new THREE.Color();

  for (let row = 0; row < t.rows; row += 1) {
    const scale = 1 - row * t.rowShrink;
    const dim = 1 - row * 0.09;          // farther rows are fainter
    const y0 = groundTop + row * 15;     // stagger rows upward (depth)
    // Rows appear one after another as the knob turns.
    const rowStage = row / t.rows * 0.35;

    for (const side of [-1, 1]) {
      for (let k = 0; k < t.perSide; k += 1) {
        // Side thirds only — the central third stays open for the throne.
        const xFrac = 0.20 + (k + rand(0.05, 0.4)) * (0.26 / t.perSide);
        const x0 = side * xFrac * W;
        const height = t.height * scale * rand(0.85, 1.15);
        const lean = rand(-0.12, 0.12);

        // trunk — warm dim gold, rises bottom-up
        const trunkN = Math.round(50 * density);
        for (let i = 0; i < trunkN; i += 1) {
          const f = i / trunkN;
          c.copy(gold).multiplyScalar(0.85 * dim);
          add(
            x0 + lean * height * f + rand(-2.5, 2.5),
            y0 + f * height * 0.62,
            rand(2.2, 3.2) * scale, c,
            rowStage + f * 0.18, 0.6, 0,
          );
        }

        // branches — reach out from the upper trunk
        const branches = 6;
        const tips = [];
        for (let b = 0; b < branches; b += 1) {
          const bf = 0.45 + 0.55 * (b / branches);            // origin height
          const ang = (b % 2 ? 1 : -1) * rand(0.5, 1.15);      // spread
          const len = height * rand(0.28, 0.45) * (1.2 - bf * 0.5);
          const bx = x0 + lean * height * bf;
          const by = y0 + bf * height * 0.62;
          const dirX = Math.sin(ang); const dirY = Math.cos(ang) * 0.55 + 0.45;
          const bn = Math.round(22 * density);
          for (let i = 0; i < bn; i += 1) {
            const f = i / bn;
            c.lerpColors(gold, malachite, f).multiplyScalar(1.0 * dim);
            add(
              bx + dirX * len * f + rand(-2, 2),
              by + dirY * len * f + rand(-2, 2),
              rand(1.9, 2.8) * scale, c,
              rowStage + 0.16 + f * 0.22, 1.6, 0,
            );
          }
          tips.push([bx + dirX * len, by + dirY * len]);
        }

        // canopy — blobs of leaf-light at the branch tips
        for (const [tx, ty] of tips) {
          const cn = Math.round(46 * density);
          for (let i = 0; i < cn; i += 1) {
            const a = Math.random() * Math.PI * 2;
            const r = rand(4, 30) * scale;
            c.lerpColors(malachite, beryl, Math.random()).multiplyScalar(rand(0.9, 1.35) * dim);
            add(
              tx + Math.cos(a) * r,
              ty + Math.sin(a) * r * 0.8,
              rand(2.2, 3.6) * scale, c,
              rowStage + rand(0.36, 0.62), rand(2.5, 5), 0,
            );
          }
          // jewel-fruit — the last things to ignite, bloom-hot gold
          const fn = Math.round(6 * density) + 1;
          for (let i = 0; i < fn; i += 1) {
            const a = Math.random() * Math.PI * 2;
            const r = rand(6, 24) * scale;
            c.lerpColors(gold, white, Math.random() * 0.5).multiplyScalar(2.0 * dim);
            add(
              tx + Math.cos(a) * r,
              ty + Math.sin(a) * r * 0.8,
              rand(3.0, 4.4) * scale, c,
              rand(0.72, 0.95), 1.2, 0,
            );
          }
        }
      }
    }
  }
}
