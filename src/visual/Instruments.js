/**
 * Instruments — K3: the sutra's instruments that play themselves, hung in
 * the sky as forms of light. An arc of glowing orb-constellations rises
 * across the upper panorama, one by one, each a hot core inside a wide
 * faint halo with a streamer falling beneath (a hanging chime of light).
 * Act2 spawns rising note-motes from them as the knob (music) swells.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { rand } from '../core/Clock.js';

/** Precomputed orb centers — Act2 uses these to emit note-sparks. */
export const instrumentCenters = [];

export function buildInstruments(add) {
  const inst = config.act2.instruments;
  const density = Math.max(config.qualityScale[config.quality].particleScale, 0.3);

  const W = config.worldWidth;
  const H = config.worldHeight;
  const [yLo, yHi] = inst.yFracRange;

  const gold = new THREE.Color(config.palette.gold);
  const beryl = new THREE.Color(config.palette.beryl);
  const white = new THREE.Color(config.palette.white);
  const c = new THREE.Color();

  instrumentCenters.length = 0;

  for (let i = 0; i < inst.count; i += 1) {
    const f = i / (inst.count - 1);
    const x = (f - 0.5) * 2 * inst.xSpanFrac * W * 0.5 * 2; // spread across the arc
    // Arc: high at center, dipping toward the sides.
    const y = (yLo + (yHi - yLo) * Math.sin(Math.PI * f)) * H
      * rand(0.96, 1.04);
    instrumentCenters.push({ x, y });

    // Orbs light up one by one as K3 rises; alternate out from the center.
    const order = Math.abs(f - 0.5) * 2;
    const stage = order * 0.55 + rand(0, 0.08);

    // hot core
    const coreN = Math.round(30 * density) + 6;
    for (let k = 0; k < coreN; k += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(0, 7);
      c.lerpColors(white, gold, Math.random()).multiplyScalar(1.6);
      add(x + Math.cos(a) * r, y + Math.sin(a) * r, rand(2.2, 3.6), c, stage + rand(0, 0.1), 1.5, 0);
    }
    // wide faint halo
    const haloN = Math.round(70 * density) + 10;
    for (let k = 0; k < haloN; k += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(8, 30);
      c.lerpColors(gold, beryl, Math.random()).multiplyScalar(rand(0.5, 0.8));
      add(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.85, rand(1.8, 2.8), c, stage + rand(0.05, 0.2), rand(2, 4), 0);
    }
    // hanging streamer — a chime-thread of light falling beneath the orb
    const streamN = Math.round(26 * density) + 6;
    const streamLen = rand(50, 90);
    for (let k = 0; k < streamN; k += 1) {
      const sf = k / streamN;
      c.lerpColors(gold, beryl, sf).multiplyScalar((1 - sf * 0.7) * 1.0);
      add(
        x + rand(-2.5, 2.5) + Math.sin(sf * 9) * 3,
        y - 10 - sf * streamLen,
        rand(1.7, 2.5) * (1 - sf * 0.4), c,
        stage + 0.12 + sf * 0.2, 2 + sf * 3, sf * 5,
      );
    }
  }
}
