/**
 * IndraNet — 因陀罗网 · the Jeweled Net of Indra.
 *
 * The Huayan image of the Pure Land: an infinite net with a jewel at every
 * knot, each jewel reflecting all the others. Here it is the connective
 * tissue of Act 2's growing world — as the dials cultivate the paradise,
 * luminous nodes kindle and nerve-like fibers reach out and stitch them
 * into one reflecting web (after the p5 "神经突触" nerve-network study:
 * nodes that glow, tendrils that grow toward targets with a Perlin wobble).
 *
 * It is ONE static point cloud, revealed progressively by a single growth
 * value (0..1): every point carries the growth threshold at which it wakes,
 * so the whole net weaves in as the world ripens and un-weaves in the coda —
 * no per-frame streaming. Lives in worldGroup, so it sways with the mandala.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';

// cheap smooth value-noise (hash lattice + smoothstep) for the fiber wobble
function hash(n) { const s = Math.sin(n) * 43758.5453; return s - Math.floor(s); }
function vnoise(x) {
  const i = Math.floor(x); const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

const vertexShader = /* glsl */ `
  uniform float uTime, uGrow, uPPWU, uSizeScale;
  attribute vec3  aColor;
  attribute float aReveal;   // growth value at which this point wakes
  attribute float aSeed;     // per-point twinkle phase
  attribute float aSize;     // world units
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    float appear = smoothstep(aReveal, aReveal + 0.07, uGrow);
    if (appear < 0.01) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vAlpha = 0.0; return; }
    float tw = 0.68 + 0.32 * sin(uTime * 1.8 + aSeed * 6.2831853);
    vAlpha = appear * tw;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPPWU * uSizeScale * (0.55 + 0.6 * appear);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uIntensity;
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    float core = smoothstep(0.5, 0.0, d);
    if (core <= 0.001) discard;
    float hot = core * core;
    gl_FragColor = vec4(vColor * (core + hot) * uIntensity, core * vAlpha);
  }
`;

export class IndraNet {
  constructor(worldGroup) {
    const W = config.worldWidth;
    const H = config.worldHeight;
    const P = config.palette;
    const gold = new THREE.Color(P.gold);
    const white = new THREE.Color(P.white);
    const beryl = new THREE.Color(P.beryl ?? P.malachite ?? P.gold);

    // ── nodes: a central jewel + a ring of jewels hung across the upper
    // world, plus a few outliers. [x, y] in world units, reveal threshold.
    const nodes = [];
    nodes.push({ x: 0, y: 0.16 * H, r: 0.0 });          // the central jewel
    const ring = 6;
    for (let i = 0; i < ring; i += 1) {
      const a = (Math.PI * 2 * i) / ring + 0.4;
      const rx = (0.16 + (i % 2) * 0.14) * W;
      const ry = (0.13 + (i % 3) * 0.05) * H;
      nodes.push({ x: Math.cos(a) * rx, y: 0.18 * H + Math.sin(a) * ry, r: 0.14 + 0.05 * (i % 3) });
    }
    // a few farther jewels toward the wings
    for (let i = 0; i < 4; i += 1) {
      nodes.push({
        x: (i < 2 ? -1 : 1) * (0.30 + 0.12 * Math.random()) * W,
        y: (0.04 + 0.34 * Math.random()) * H,
        r: 0.28 + 0.12 * Math.random(),
      });
    }

    const pos = [], col = [], reveal = [], seed = [], size = [];
    const push = (x, y, c, rv, sz) => {
      pos.push(x, y, 0);
      col.push(c.r, c.g, c.b);
      reveal.push(rv);
      seed.push(Math.random());
      size.push(sz);
    };
    const tmp = new THREE.Color();

    // node jewels — a gaussian blob of points, brightest at the core
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 0.9;
    for (const nd of nodes) {
      const rad = 22 + Math.random() * 10;
      const count = 340;
      for (let i = 0; i < count; i += 1) {
        const dx = gauss() * rad, dy = gauss() * rad;
        const t = Math.min(1, Math.hypot(dx, dy) / (rad * 2));
        tmp.copy(gold).lerp(white, (1 - t) * 0.7);         // white-hot core → gold rim
        // points near the core wake a touch before the rim → a kindling jewel
        push(nd.x + dx, nd.y + dy, tmp, nd.r + t * 0.05, 2.7 - 1.1 * t);
      }
    }

    // ── fibers: each edge grows from source to target as growth rises, its
    // points revealing in order along the path (Perlin-wobbled, "粗壮" —
    // thickened by a little scatter around the walk).
    const edges = [];
    for (let i = 1; i < nodes.length; i += 1) edges.push([0, i]);      // hub → every jewel
    for (let i = 1; i <= ring; i += 1) edges.push([i, (i % ring) + 1]); // ring neighbours
    // a few cross links so the web reflects on itself
    for (let k = 0; k < 5; k += 1) {
      const a = 1 + ((Math.random() * (nodes.length - 1)) | 0);
      const b = 1 + ((Math.random() * (nodes.length - 1)) | 0);
      if (a !== b) edges.push([a, b]);
    }

    for (const [ai, bi] of edges) {
      const A = nodes[ai], B = nodes[bi];
      const dx = B.x - A.x, dy = B.y - A.y;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len, ny = dx / len;      // perpendicular (for the wobble)
      const amp = Math.min(120, len * 0.16);
      const off = Math.random() * 40;
      const steps = Math.max(40, Math.round(len / 14));
      // the fiber wakes between the later of its two nodes and full growth
      const rStart = Math.max(A.r, B.r) + 0.04;
      const rEnd = Math.min(0.98, rStart + 0.4);
      for (let sIdx = 0; sIdx <= steps; sIdx += 1) {
        const t = sIdx / steps;
        const wob = (vnoise(off + t * 4.0) - 0.5) * 2 + (vnoise(off + t * 9.0) - 0.5);
        const bx = A.x + dx * t + nx * wob * amp * Math.sin(Math.PI * t);
        const by = A.y + dy * t + ny * wob * amp * Math.sin(Math.PI * t);
        const rv = rStart + (rEnd - rStart) * t;      // grows source → target
        // bright, warm tendrils (a hint of beryl) so the web reads clearly
        tmp.copy(gold).lerp(white, 0.35 + 0.3 * Math.random());
        if (Math.random() < 0.25) tmp.lerp(beryl, 0.4);
        // scattered points per step give the tendril its "粗壮" body
        const thick = 3 + ((Math.random() * 2) | 0);
        for (let j = 0; j < thick; j += 1) {
          push(bx + gauss() * 4.5, by + gauss() * 4.5, tmp, rv, 2.2 + Math.random() * 0.6);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aReveal', new THREE.Float32BufferAttribute(reveal, 1));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.uniforms = {
      uTime: { value: 0 },
      uGrow: { value: 0 },
      uPPWU: { value: 1 },
      uSizeScale: { value: 1 },
      uIntensity: { value: (config.particles.intensity ?? 1.1) * 1.15 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    worldGroup.add(this.points);

    this.grow = 0;
  }

  /** grow: 0..1 growth driver (weaves in as the world ripens). */
  update(time, grow, ppwu) {
    // ease toward the target so hardware jumps never pop the net
    this.grow += (grow - this.grow) * 0.06;
    this.uniforms.uTime.value = time;
    this.uniforms.uGrow.value = this.grow;
    this.uniforms.uPPWU.value = ppwu;
  }
}
