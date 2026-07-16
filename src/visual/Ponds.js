/**
 * Ponds — K2: lotus ponds of glowing water along the ground. Water fills
 * center-out; travelling ripple-glow runs outward across each pond
 * (aPhase encodes radius so the shimmer reads as slow Dharma-light waves);
 * lotuses open late — white-cinnabar petals around a gold heart.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { rand } from '../core/Clock.js';

export function buildPonds(add) {
  const p = config.act2.ponds;
  const density = Math.max(config.qualityScale[config.quality].particleScale, 0.3);

  const W = config.worldWidth;
  const H = config.worldHeight;
  const yWater = -H / 2 + config.ground.bandFrac * H * 0.45;

  const beryl = new THREE.Color(config.palette.beryl);
  const lapis = new THREE.Color(config.palette.lapis);
  const white = new THREE.Color(config.palette.white);
  const cinnabar = new THREE.Color(config.palette.cinnabar);
  const gold = new THREE.Color(config.palette.gold);
  const c = new THREE.Color();

  for (let i = 0; i < p.count; i += 1) {
    // Even spread with jitter; ponds appear one by one as K2 turns.
    const xFrac = (i + 0.5) / p.count - 0.5 + rand(-0.03, 0.03);
    const x0 = xFrac * W * 0.86;
    const y0 = yWater + rand(-6, 6);
    const rx = rand(95, 150);
    const ry = rx * rand(0.2, 0.26);
    const pondStage = (i % 2 === 0 ? i : p.count - i) / p.count * 0.3; // center-ish first

    // water — fills from the middle of the pond outward
    const wn = Math.round(650 * density);
    for (let k = 0; k < wn; k += 1) {
      const a = Math.random() * Math.PI * 2;
      const rf = Math.sqrt(Math.random()); // uniform over the ellipse
      c.lerpColors(lapis, beryl, Math.random()).multiplyScalar(rand(0.8, 1.2));
      add(
        x0 + Math.cos(a) * rx * rf,
        y0 + Math.sin(a) * ry * rf,
        rand(1.8, 3.0), c,
        pondStage + rf * 0.28 + rand(0, 0.06),
        0.5,
        rf * 7.0, // ripple phase travels outward
      );
    }

    // lotuses — petal fans opening around a bloom-hot gold heart
    for (let l = 0; l < p.lotusPerPond; l += 1) {
      const lx = x0 + rand(-0.55, 0.55) * rx;
      const ly = y0 + rand(-0.3, 0.3) * ry + 4;
      const lotusStage = rand(0.55, 0.8);
      const petals = 7;
      for (let pt = 0; pt < petals; pt += 1) {
        const ang = Math.PI * (0.1 + 0.8 * (pt / (petals - 1))); // upward fan
        const pn = Math.round(11 * density) + 2;
        for (let k = 0; k < pn; k += 1) {
          const f = k / pn;
          c.lerpColors(white, cinnabar, f * f).multiplyScalar(rand(1.0, 1.35));
          add(
            lx + Math.cos(ang) * f * rand(13, 17),
            ly + Math.sin(ang) * f * rand(9, 13),
            rand(2.0, 3.0), c,
            lotusStage + f * 0.16, // petals unfurl tip-last
            0.5, 0,
          );
        }
      }
      const hn = Math.round(7 * density) + 2;
      for (let k = 0; k < hn; k += 1) {
        c.copy(gold).multiplyScalar(1.9);
        add(lx + rand(-3, 3), ly + rand(-1, 3), rand(2.8, 3.8), c, rand(0.86, 0.98), 0.4, 0);
      }
    }
  }
}
