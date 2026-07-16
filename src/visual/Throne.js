/**
 * Throne — the great lotus throne that rises at the center of the panorama
 * when Act 3 begins: three tiers of petal-fans (gold hearts, cinnabar
 * tips) beneath a glowing seat disc. Built as a GrowthLayer geometry;
 * Act3 drives its growth from the act-entry timer, bottom tier first.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { rand } from '../core/Clock.js';

export function buildThrone(add) {
  const density = Math.max(config.qualityScale[config.quality].particleScale, 0.3);
  const H = config.worldHeight;
  const baseY = -H / 2 + config.ground.bandFrac * H * 0.55;

  const gold = new THREE.Color(config.palette.gold);
  const cinnabar = new THREE.Color(config.palette.cinnabar);
  const white = new THREE.Color(config.palette.white);
  const c = new THREE.Color();

  const tiers = 3;
  for (let ti = 0; ti < tiers; ti += 1) {
    const width = 300 * (1 - ti * 0.2);
    const y0 = baseY + ti * 24;
    const petals = 16 - ti * 2;
    const tierStage = ti * 0.22;

    for (let p = 0; p < petals; p += 1) {
      const frac = petals === 1 ? 0 : p / (petals - 1);
      const px = (frac - 0.5) * width;
      const out = Math.sign(px) || 1;          // petals curl away from center
      const lean = Math.abs(frac - 0.5) * 2;   // outer petals lean more
      const petalN = Math.round(18 * density) + 4;
      for (let k = 0; k < petalN; k += 1) {
        const f = k / petalN;
        // Quadratic arc: up and slightly outward, tip curling over.
        const x = px + out * lean * f * 26 + rand(-1.5, 1.5);
        const y = y0 + Math.sin(f * Math.PI * 0.62) * (34 - ti * 5) + rand(-1.5, 1.5);
        c.lerpColors(gold, cinnabar, f * f * lean).multiplyScalar(rand(0.9, 1.3));
        add(x, y, rand(2.0, 3.2), c, tierStage + f * 0.16 + rand(0, 0.06), 0.5, 0);
      }
    }
  }

  // The seat — a radiant gold disc where Amitāyus will sit.
  const seatN = Math.round(320 * density) + 40;
  for (let k = 0; k < seatN; k += 1) {
    const a = Math.random() * Math.PI * 2;
    const rf = Math.sqrt(Math.random());
    c.lerpColors(white, gold, Math.random()).multiplyScalar(rand(1.1, 1.5));
    add(
      Math.cos(a) * 95 * rf,
      baseY + 66 + Math.sin(a) * 16 * rf,
      rand(2.0, 3.4), c,
      0.6 + rf * 0.25, 0.4, 0,
    );
  }
}
