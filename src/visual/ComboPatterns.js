/**
 * ComboPatterns — point-cloud generators for the Act-1 combo 图案.
 *
 * Every function returns an array of { x, y, col } targets (world units,
 * centered on the origin) for ParticleSystem.settle() to gather embers
 * onto: sutra silhouettes (lotus, moon, sun, canopy, pagoda), geometric
 * mandalas, a pillar of light, a run-ribbon, canvas-sampled bilingual
 * text, and crops of the real Cave-217 murals.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { rand } from '../core/Clock.js';

const col = (hex) => new THREE.Color(hex);

// ── Sutra imagery ─────────────────────────────────────────────────────

/** A lotus mandala seen head-on: 8 outer petals, 5 inner, golden heart. */
export function lotusPoints(R, budget) {
  const pts = [];
  const cin = col(config.palette.cinnabar);
  const gold = col(config.palette.gold);
  const white = col(config.palette.white);
  const rings = [[8, R, 0], [5, R * 0.6, Math.PI / 8]]; // [petals, length, offset]
  const perPetal = Math.floor((budget * 0.82) / 13);

  for (const [n, L, off] of rings) {
    for (let p = 0; p < n; p += 1) {
      const axis = off + (p / n) * Math.PI * 2;
      const ca = Math.cos(axis);
      const sa = Math.sin(axis);
      for (let k = 0; k < perPetal; k += 1) {
        const t = Math.random();
        const d = t * L;
        const w = Math.sin(Math.PI * t) ** 0.8 * L * 0.24;
        // mostly crisp petal edges, some soft fill
        const side = Math.random() < 0.7 ? (Math.random() < 0.5 ? 1 : -1) : rand(-1, 1);
        const wx = w * side;
        const tip = new THREE.Color().lerpColors(cin, t < 0.6 ? gold : white, t)
          .multiplyScalar(0.9 + t * 0.5);
        pts.push({
          x: ca * d - sa * wx,
          y: (sa * d + ca * wx) * 0.85, // panorama squash
          col: tip,
        });
      }
    }
  }
  while (pts.length < budget) { // golden heart
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * R * 0.2;
    pts.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r * 0.85,
      col: gold.clone().multiplyScalar(rand(1.1, 1.5)),
    });
  }
  return pts;
}

/** A crescent moon — a disc with a bite of darkness taken from it. */
export function moonPoints(R, budget) {
  const pts = [];
  const gold = col(config.palette.gold);
  const white = col(config.palette.white);
  const ox = R * 0.42;
  const oy = R * 0.1;
  const bite = R * 0.82;
  let guard = 0;
  while (pts.length < budget && guard < budget * 60) {
    guard += 1;
    const a = Math.random() * Math.PI * 2;
    const r = R * Math.sqrt(Math.random());
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const dx = x - ox;
    const dy = y - oy;
    if (dx * dx + dy * dy < bite * bite) continue;      // the dark bite
    if (Math.random() < 0.35 && r < R * 0.86) continue; // denser at the rim
    const f = r / R;
    pts.push({
      x, y,
      col: new THREE.Color().lerpColors(gold, white, f).multiplyScalar(0.8 + f * 0.6),
    });
  }
  return pts;
}

/** The suspended-drum sun of the first contemplation: disc + rays. */
export function sunPoints(R, budget) {
  const pts = [];
  const cin = col(config.palette.cinnabar);
  const gold = col(config.palette.gold);
  const white = col(config.palette.white);
  const nDisc = Math.floor(budget * 0.62);
  for (let k = 0; k < nDisc; k += 1) {
    const a = Math.random() * Math.PI * 2;
    const f = Math.sqrt(Math.random());
    pts.push({
      x: Math.cos(a) * f * R,
      y: Math.sin(a) * f * R * 0.94,
      col: new THREE.Color().lerpColors(cin, gold, f).multiplyScalar(1.0 + f * 0.4),
    });
  }
  const rays = 12;
  const perRay = Math.floor((budget - nDisc) / rays);
  for (let r = 0; r < rays; r += 1) {
    const a = (r / rays) * Math.PI * 2 + 0.13;
    for (let k = 0; k < perRay; k += 1) {
      const t = Math.random();
      const d = R * (1.18 + t * 0.55);
      pts.push({
        x: Math.cos(a) * d + rand(-3, 3),
        y: Math.sin(a) * d * 0.94 + rand(-3, 3),
        col: new THREE.Color().lerpColors(gold, white, t).multiplyScalar(1.1 - t * 0.5),
      });
    }
  }
  return pts;
}

/** A jeweled canopy/parasol: dome, rim, hanging tassels, finial. */
export function canopyPoints(R, budget) {
  const pts = [];
  const gold = col(config.palette.gold);
  const cin = col(config.palette.cinnabar);
  const white = col(config.palette.white);
  const nDome = Math.floor(budget * 0.5);
  for (let k = 0; k < nDome; k += 1) {
    const a = rand(0.06, 0.94) * Math.PI;
    const rr = R * (Math.random() < 0.6 ? rand(0.88, 1.0) : rand(0.55, 0.88));
    pts.push({
      x: Math.cos(a) * rr,
      y: Math.sin(a) * rr * 0.72,
      col: gold.clone().multiplyScalar(rand(0.85, 1.35)),
    });
  }
  const tassels = 6;
  const perTassel = Math.floor((budget * 0.36) / tassels);
  for (let tI = 0; tI < tassels; tI += 1) {
    const a = ((tI + 0.5) / tassels) * Math.PI;
    const x0 = Math.cos(a) * R * 0.92;
    const y0 = Math.sin(a) * R * 0.72 * 0.16; // near the rim line
    for (let k = 0; k < perTassel; k += 1) {
      const t = Math.random();
      if (t > 0.82) { // cinnabar bead at the tip
        pts.push({ x: x0 + rand(-6, 6), y: y0 - R * 0.5 + rand(-6, 6), col: cin.clone().multiplyScalar(1.3) });
      } else {
        pts.push({ x: x0 + rand(-2, 2), y: y0 - t * R * 0.48, col: white.clone().multiplyScalar(0.7) });
      }
    }
  }
  while (pts.length < budget) { // finial
    pts.push({ x: rand(-7, 7), y: R * 0.78 + rand(-7, 7), col: white.clone().multiplyScalar(1.3) });
  }
  return pts;
}

/** A three-tiered pagoda with upturned eaves and a spire. R = half-height. */
export function pagodaPoints(R, budget) {
  const pts = [];
  const gold = col(config.palette.gold);
  const white = col(config.palette.white);
  const widths = [R * 0.95, R * 0.72, R * 0.5];
  const tierH = (R * 1.6) / 3;
  const perTier = Math.floor((budget * 0.82) / 3);
  for (let tI = 0; tI < 3; tI += 1) {
    const w = widths[tI];
    const yRoof = -R * 0.9 + (tI + 1) * tierH;
    for (let k = 0; k < perTier; k += 1) {
      const u = Math.random();
      if (u < 0.55) { // roof line with upturned tips
        const t = rand(-1, 1);
        const lift = Math.max(0, Math.abs(t) - 0.72) * 2.6;
        pts.push({
          x: t * w,
          y: yRoof + lift * tierH * 0.5 + rand(-2, 2),
          col: gold.clone().multiplyScalar(1.0 + lift * 0.8),
        });
      } else { // body columns under the roof
        const side = Math.random() < 0.5 ? -1 : 1;
        pts.push({
          x: side * w * 0.55 + rand(-2.5, 2.5),
          y: yRoof - Math.random() * tierH * 0.62,
          col: gold.clone().multiplyScalar(0.65),
        });
      }
    }
  }
  while (pts.length < budget) { // spire + orb
    const t = Math.random();
    if (t < 0.6) pts.push({ x: rand(-2, 2), y: -R * 0.9 + 3 * tierH + t * R * 0.5, col: white.clone() });
    else pts.push({ x: rand(-6, 6), y: -R * 0.9 + 3 * tierH + R * 0.42 + rand(-6, 6), col: white.clone().multiplyScalar(1.35) });
  }
  return pts;
}

/**
 * The kalavinka — the half-bird, half-human musician of the Pure Land:
 * a small figure with spread wing-fans and long twin tail ribbons.
 */
export function kalavinkaPoints(R, budget) {
  const pts = [];
  const gold = col(config.palette.gold);
  const cin = col(config.palette.cinnabar);
  const white = col(config.palette.white);
  const beryl = col(config.palette.beryl);

  const nWing = Math.floor(budget * 0.44);
  for (let k = 0; k < nWing; k += 1) {   // two wing-fans, feather ribs
    const side = Math.random() < 0.5 ? -1 : 1;
    const rib = Math.floor(Math.random() * 7);
    const a = 0.25 + (rib / 6) * 0.9;    // rib angle above horizontal
    const t = Math.random();
    const d = t * R * (0.75 + rib * 0.05);
    pts.push({
      x: side * (R * 0.16 + Math.cos(a) * d),
      y: R * 0.1 + Math.sin(a) * d * 0.8,
      col: new THREE.Color().lerpColors(gold, white, t).multiplyScalar(0.85 + t * 0.5),
    });
  }
  const nBody = Math.floor(budget * 0.18);
  for (let k = 0; k < nBody; k += 1) {   // teardrop body + head + crest
    const u = Math.random();
    if (u < 0.62) {
      const t = Math.random();
      const w = Math.sin(Math.PI * t) ** 0.9 * R * 0.13;
      pts.push({ x: rand(-1, 1) * w, y: R * 0.28 - t * R * 0.55, col: cin.clone().multiplyScalar(1.15) });
    } else if (u < 0.9) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * R * 0.09;
      pts.push({ x: Math.cos(a) * r, y: R * 0.38 + Math.sin(a) * r, col: white.clone().multiplyScalar(1.2) });
    } else {
      pts.push({ x: rand(-3, 3), y: R * 0.47 + Math.random() * R * 0.1, col: gold.clone().multiplyScalar(1.3) });
    }
  }
  while (pts.length < budget) {          // twin tail ribbons, trailing in song
    const side = Math.random() < 0.5 ? -1 : 1;
    const t = Math.random();
    pts.push({
      x: side * (R * 0.05 + t * R * 0.4) + Math.sin(t * Math.PI * 2.4) * R * 0.12,
      y: -R * 0.24 - t * R * 0.75,
      col: new THREE.Color().lerpColors(cin, beryl, t).multiplyScalar(0.9 - t * 0.35),
    });
  }
  return pts;
}

/** A six-armed ice crystal (Act I's freezing milestone). */
export function flakePoints(R, budget) {
  const pts = [];
  const beryl = col(config.palette.beryl);
  const white = col(config.palette.white);
  const icy = (f) => new THREE.Color().lerpColors(white, beryl, f * 0.55)
    .multiplyScalar(0.9 + (1 - f) * 0.5);
  const perArm = Math.floor((budget * 0.85) / 6);
  for (let a = 0; a < 6; a += 1) {
    const ang = (a / 6) * Math.PI * 2 + Math.PI / 12;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    for (let k = 0; k < perArm; k += 1) {
      const u = Math.random();
      if (u < 0.55) { // main spine
        const d = Math.random() * R;
        pts.push({ x: ca * d + rand(-1.5, 1.5), y: sa * d * 0.9 + rand(-1.5, 1.5), col: icy(d / R) });
      } else {        // side ticks at two stations, ±60° off the spine
        const st = Math.random() < 0.5 ? 0.45 : 0.72;
        const tickAng = ang + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 3;
        const d = Math.random() * R * 0.26;
        pts.push({
          x: ca * R * st + Math.cos(tickAng) * d,
          y: (sa * R * st + Math.sin(tickAng) * d) * 0.9,
          col: icy(st),
        });
      }
    }
  }
  while (pts.length < budget) { // hexagonal heart
    const a = Math.random() * Math.PI * 2;
    pts.push({ x: Math.cos(a) * R * 0.14, y: Math.sin(a) * R * 0.13, col: icy(0).multiplyScalar(1.2) });
  }
  return pts;
}

// ── Geometry ──────────────────────────────────────────────────────────

/** Dunhuang ceiling-medallion mandala; `tier` adds rings (repeat combos grow). */
export function mandalaPoints(R, tier, budget) {
  const pts = [];
  const cycle = [col(config.palette.gold), col(config.palette.beryl),
    col(config.palette.white), col(config.palette.cinnabar)];
  const rings = 2 + Math.min(4, tier);
  const scallops = 8 + tier * 2;
  const perRing = Math.floor((budget * 0.8) / rings);
  for (let i = 0; i < rings; i += 1) {
    const r0 = R * (0.3 + (0.7 * (i + 1)) / rings);
    const c = cycle[i % cycle.length];
    for (let k = 0; k < perRing; k += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = r0 * (1 + 0.06 * Math.sin(a * scallops)) + rand(-2, 2);
      pts.push({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r * 0.85,
        col: c.clone().multiplyScalar(rand(0.8, 1.3)),
      });
    }
  }
  const spokes = 12;
  while (pts.length < budget) {
    const s = Math.floor(Math.random() * spokes);
    const a = (s / spokes) * Math.PI * 2;
    const d = R * rand(0.25, 1.0);
    pts.push({
      x: Math.cos(a) * d,
      y: Math.sin(a) * d * 0.85,
      col: cycle[0].clone().multiplyScalar(0.7),
    });
  }
  return pts;
}

/** A pillar of light joining earth and sky (low+high combo). H = full height. */
export function pillarPoints(H, budget) {
  const pts = [];
  const beryl = col(config.palette.beryl);
  const gold = col(config.palette.gold);
  const white = col(config.palette.white);
  const half = H / 2;
  const w = 34;
  const grad = (y) => {
    const f = (y + half) / H;
    return f < 0.55
      ? new THREE.Color().lerpColors(beryl, gold, f / 0.55)
      : new THREE.Color().lerpColors(gold, white, (f - 0.55) / 0.45);
  };
  for (let k = 0; k < budget; k += 1) {
    const u = Math.random();
    const y = rand(-half, half);
    if (u < 0.42) {           // double helix
      const s = Math.random() < 0.5 ? 0 : Math.PI;
      pts.push({ x: Math.sin(y * 0.02 + s) * w, y, col: grad(y).multiplyScalar(1.1) });
    } else if (u < 0.62) {    // side rails
      const side = Math.random() < 0.5 ? -1 : 1;
      pts.push({ x: side * w * 1.2 + rand(-3, 3), y, col: grad(y).multiplyScalar(0.6) });
    } else if (u < 0.85) {    // rings at intervals
      const ring = Math.floor(rand(0, 6));
      const ry = -half + (ring + 0.5) * (H / 6);
      const a = Math.random() * Math.PI * 2;
      pts.push({ x: Math.cos(a) * w * 1.9, y: ry + Math.sin(a) * w * 0.55, col: grad(ry) });
    } else {                  // earth & sky blooms at the ends
      const top = Math.random() < 0.6;
      const yy = top ? half : -half;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * w * 2.2;
      pts.push({ x: Math.cos(a) * r, y: yy + Math.sin(a) * r * 0.5, col: grad(yy).multiplyScalar(1.3) });
    }
  }
  return pts;
}

/** A ribbon of shrinking rings sweeping a fast run's direction. */
export function ribbonPoints(len, dir, budget) {
  const pts = [];
  const beryl = col(config.palette.beryl);
  const white = col(config.palette.white);
  const stations = 6;
  const perStation = Math.floor((budget * 0.7) / stations);
  for (let i = 0; i < stations; i += 1) {
    const f = i / (stations - 1);
    const cx = dir * (f - 0.5) * len;
    const R = 68 * (1 - f * 0.55);
    const c = new THREE.Color().lerpColors(beryl, white, f);
    for (let k = 0; k < perStation; k += 1) {
      const a = Math.random() * Math.PI * 2;
      pts.push({
        x: cx + Math.cos(a) * R,
        y: Math.sin(a) * R * 0.85 + Math.sin(f * Math.PI * 2) * 26,
        col: c.clone().multiplyScalar(0.8 + f * 0.6),
      });
    }
  }
  while (pts.length < budget) { // connecting wave
    const f = Math.random();
    pts.push({
      x: dir * (f - 0.5) * len + rand(-4, 4),
      y: Math.sin(f * Math.PI * 2) * 26 + rand(-4, 4),
      col: new THREE.Color().lerpColors(beryl, white, f).multiplyScalar(0.7),
    });
  }
  return pts;
}

// ── Prison-story stage scenery (one 图案 per line of the tale) ────────

/** Rājagṛha: a distant walled city — crenellated wall, gate, towers. */
export function cityPoints(w, h, budget) {
  const pts = [];
  const dimGold = col(config.palette.gold).multiplyScalar(0.55);
  const dimWhite = col(config.palette.white).multiplyScalar(0.4);
  const lapis = col(config.palette.lapis).multiplyScalar(1.3);

  const nWall = Math.floor(budget * 0.42);
  for (let k = 0; k < nWall; k += 1) {   // city wall with battlements
    const x = rand(-0.5, 0.5) * w;
    const tooth = (Math.floor((x + w) / 30) % 2) * h * 0.05;
    const u = Math.random();
    if (u < 0.55) { // crenellated top edge
      pts.push({ x, y: h * 0.16 + tooth + rand(-1.5, 1.5), col: (Math.random() < 0.6 ? dimGold : dimWhite).clone() });
    } else {        // sparse masonry glints below
      pts.push({ x, y: rand(0, h * 0.14), col: lapis.clone().multiplyScalar(rand(0.5, 1)) });
    }
  }
  const towers = [-0.42, -0.21, 0.02, 0.24, 0.43];
  const perTower = Math.floor((budget * 0.5) / towers.length);
  for (const tx of towers) {             // watch-towers over the wall
    const th = h * rand(0.55, 1.0);
    const tw = w * 0.035;
    for (let k = 0; k < perTower; k += 1) {
      const u = Math.random();
      if (u < 0.5) {      // tower sides
        const side = Math.random() < 0.5 ? -1 : 1;
        pts.push({ x: tx * w + side * tw + rand(-1.5, 1.5), y: rand(h * 0.16, th), col: dimGold.clone().multiplyScalar(rand(0.7, 1.2)) });
      } else if (u < 0.8) { // roof line + upturned tips
        const t = rand(-1.2, 1.2);
        pts.push({ x: tx * w + t * tw, y: th + Math.max(0, Math.abs(t) - 0.8) * h * 0.06, col: dimWhite.clone() });
      } else {            // a lit window
        pts.push({ x: tx * w + rand(-0.6, 0.6) * tw, y: rand(h * 0.3, th * 0.9), col: dimGold.clone().multiplyScalar(1.6) });
      }
    }
  }
  while (pts.length < budget) {          // the city gate, center
    const a = rand(0, Math.PI);
    pts.push({ x: Math.cos(a) * w * 0.03, y: Math.sin(a) * h * 0.12, col: dimWhite.clone() });
  }
  return pts;
}

/** The seven nested walls that closed around the king. */
export function sevenWallsPoints(R, budget) {
  const pts = [];
  const lapis = col(config.palette.lapis).multiplyScalar(1.6);
  const beryl = col(config.palette.beryl).multiplyScalar(0.7);
  const white = col(config.palette.white).multiplyScalar(0.35);
  const per = Math.floor(budget / 7);
  for (let i = 0; i < 7; i += 1) {
    const r = R * (0.25 + (0.75 * i) / 6);
    const c = i % 2 ? beryl : lapis;
    for (let k = 0; k < per; k += 1) {
      const u = Math.random();
      if (u < 0.7) { // the arch of each wall
        const a = rand(0.08, 0.92) * Math.PI;
        pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8 + rand(-1.5, 1.5), col: (Math.random() < 0.12 ? white : c).clone().multiplyScalar(rand(0.7, 1.2)) });
      } else {       // its feet running to the ground
        const side = Math.random() < 0.5 ? -1 : 1;
        pts.push({ x: side * r * Math.cos(0.08 * Math.PI), y: rand(-0.12 * R, Math.sin(0.08 * Math.PI) * r * 0.8), col: c.clone().multiplyScalar(0.7) });
      }
    }
  }
  return pts;
}

/** Queen Vaidehī — a robed figure carrying the offering bowl. */
export function queenPoints(R, budget) {
  const pts = [];
  const white = col(config.palette.white);
  const gold = col(config.palette.gold);
  for (let k = 0; k < budget; k += 1) {
    const u = Math.random();
    if (u < 0.12) {        // head
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * R * 0.09;
      pts.push({ x: Math.cos(a) * r, y: R * 0.42 + Math.sin(a) * r, col: white.clone().multiplyScalar(0.9) });
    } else if (u < 0.6) {  // long robe, widening to the ground
      const t = Math.random();
      const halfW = R * (0.1 + t * 0.16);
      const edge = Math.random() < 0.6;
      const x = edge ? (Math.random() < 0.5 ? -1 : 1) * halfW : rand(-1, 1) * halfW;
      pts.push({ x, y: R * 0.3 - t * R * 0.82, col: white.clone().multiplyScalar(edge ? 0.75 : 0.4) });
    } else if (u < 0.72) { // shoulders + arms reaching forward
      const t = Math.random();
      pts.push({ x: t * R * 0.22, y: R * (0.24 - t * 0.14), col: white.clone().multiplyScalar(0.6) });
    } else if (u < 0.86) { // the offering bowl, warm and bright
      const a = Math.random() * Math.PI;
      pts.push({ x: R * 0.24 + Math.cos(a) * R * 0.06, y: R * 0.08 - Math.abs(Math.sin(a)) * R * 0.04, col: gold.clone().multiplyScalar(1.4) });
    } else {               // honey-light rising from the bowl
      const t = Math.random();
      pts.push({ x: R * 0.24 + rand(-0.03, 0.03) * R, y: R * (0.1 + t * 0.2), col: gold.clone().multiplyScalar(1.0 - t * 0.6) });
    }
  }
  return pts;
}

/** The cell: cold vertical bars with rails — darkness given shape. */
export function cagePoints(w, h, budget) {
  const pts = [];
  const lapis = col(config.palette.lapis).multiplyScalar(1.8);
  const beryl = col(config.palette.beryl).multiplyScalar(0.8);
  const bars = 7;
  for (let k = 0; k < budget; k += 1) {
    const u = Math.random();
    if (u < 0.72) { // the bars
      const b = Math.floor(Math.random() * bars);
      pts.push({
        x: ((b / (bars - 1)) - 0.5) * w + rand(-1.2, 1.2),
        y: rand(-0.5, 0.5) * h,
        col: (Math.random() < 0.7 ? lapis : beryl).clone().multiplyScalar(rand(0.7, 1.2)),
      });
    } else {        // top & bottom rails
      const top = Math.random() < 0.5;
      pts.push({ x: rand(-0.54, 0.54) * w, y: (top ? 0.5 : -0.5) * h + rand(-1.5, 1.5), col: lapis.clone() });
    }
  }
  return pts;
}

/** Vulture Peak in the far distance, its summit faintly lit. */
export function peakPoints(R, budget) {
  const pts = [];
  const lapis = col(config.palette.lapis).multiplyScalar(1.5);
  const white = col(config.palette.white);
  for (let k = 0; k < budget; k += 1) {
    const u = Math.random();
    if (u < 0.55) {        // the two ridges
      const t = Math.random();
      const left = Math.random() < 0.55;
      const x = left ? -R + t * R * 1.15 : R * 0.15 + t * R * 0.85;
      const y = left ? -0.4 * R + t * R * 0.9 : 0.5 * R - t * R * 0.85;
      pts.push({ x, y: y + rand(-2, 2), col: lapis.clone().multiplyScalar(rand(0.7, 1.2)) });
    } else if (u < 0.9) {  // sparse mountain body
      const t = Math.random();
      const halfW = R * (0.12 + t * 0.85);
      pts.push({ x: rand(-1, 1) * halfW, y: 0.5 * R - t * R * 0.9, col: lapis.clone().multiplyScalar(0.5) });
    } else {               // the summit, where the Buddha dwells
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * R * 0.08;
      pts.push({ x: R * 0.15 + Math.cos(a) * r, y: R * 0.52 + Math.sin(a) * r, col: white.clone().multiplyScalar(rand(0.8, 1.4)) });
    }
  }
  return pts;
}

// ── Ember-formed text ─────────────────────────────────────────────────

/**
 * Rasterize a bilingual passage (Chinese large, English smaller below)
 * and sample it into settle targets. Returns { pts, width, height } in
 * world units, centered on the origin.
 */
export function textPoints(zh, en, worldWidth, budget) {
  const zhPx = 170;
  const enPx = 66;
  const pad = 50;
  const gap = 44;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const zhFont = `500 ${zhPx}px "Noto Serif SC", "Songti SC", "STSong", serif`;
  const enFont = `italic ${enPx}px "EB Garamond", Georgia, serif`;
  ctx.font = zhFont;
  const zhW = ctx.measureText(zh).width;
  ctx.font = enFont;
  const enW = ctx.measureText(en).width;

  canvas.width = Math.ceil(Math.max(zhW, enW) + pad * 2);
  canvas.height = Math.ceil(zhPx + gap + enPx + pad * 2);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = zhFont;
  ctx.fillText(zh, canvas.width / 2, pad);
  ctx.font = enFont;
  ctx.fillText(en, canvas.width / 2, pad + zhPx + gap);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  // First count filled pixels, then choose a stride that lands near budget.
  let filled = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 100) filled += 1;
  const step = Math.max(1, Math.round(Math.sqrt(filled / Math.max(1, budget))));

  const scale = worldWidth / canvas.width;
  const zhSplit = pad + zhPx + gap * 0.5; // canvas y dividing zh from en
  const white = col(config.palette.white);
  const gold = col(config.palette.gold);
  const pts = [];
  for (let py = 0; py < canvas.height; py += step) {
    for (let px = 0; px < canvas.width; px += step) {
      if (data[(py * canvas.width + px) * 4 + 3] <= 100) continue;
      const c = py < zhSplit ? white : gold;
      pts.push({
        x: (px - canvas.width / 2) * scale + rand(-0.4, 0.4) * step * scale,
        y: (canvas.height / 2 - py) * scale + rand(-0.4, 0.4) * step * scale,
        col: c.clone().multiplyScalar(py < zhSplit ? rand(1.0, 1.35) : rand(0.7, 1.0)),
      });
    }
  }
  return { pts, width: canvas.width * scale, height: canvas.height * scale };
}

// ── Real mural crops ──────────────────────────────────────────────────

const muralCache = new Map(); // file → { pts: null | array (unit-height coords) }

/** Kick off loading+sampling a mural crop (idempotent, async). */
export function preloadMural(file, budget, opts = {}) {
  if (muralCache.has(file)) return;
  const entry = { pts: null, aspect: 1 };
  muralCache.set(file, entry);
  const img = new Image();
  img.onload = () => {
    const out = sampleMural(img, budget, opts);
    entry.pts = out.pts;
    entry.aspect = out.aspect;
  };
  img.onerror = () => console.warn(`[combos] mural missing: /murals/${file}`);
  img.src = `/murals/${file}`;
}

/** Sampled points for a loaded mural (null until ready). Unit height. */
export function muralPointsFor(file) {
  const entry = muralCache.get(file);
  return entry?.pts ? entry : null;
}

function sampleMural(img, budget, opts = {}) {
  const m = config.murals;
  const s = Math.min(1, 360 / img.width);
  const w = Math.max(1, Math.round(img.width * s));
  const h = Math.max(1, Math.round(img.height * s));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const gold = col(config.palette.gold);
  const cands = [];
  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const i = (py * w + px) * 4;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < m.luminanceCutoff) continue;
      const mx = Math.max(r, g, b);
      const sat = mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
      // Photo crops drop bare wall plaster; SVG art keeps its whites.
      if (opts.plasterSkip !== false && lum > m.plasterLum && sat < m.plasterSat) continue;
      const c = new THREE.Color(r, g, b).lerp(gold, m.retint * 0.8).multiplyScalar(1.25);
      cands.push({ px, py, c });
    }
  }
  const n = Math.min(budget, cands.length);
  const stride = cands.length / Math.max(1, n);
  const pts = [];
  for (let k = 0; k < n; k += 1) {
    const c = cands[Math.floor(k * stride)];
    pts.push({
      x: (c.px / w - 0.5) * (w / h), // unit-height coordinates
      y: 0.5 - c.py / h,
      col: c.c,
    });
  }
  return { pts, aspect: w / h };
}
