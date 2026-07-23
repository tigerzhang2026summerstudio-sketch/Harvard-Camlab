/**
 * IntroWorld — the PROCEDURAL flight world (intro build step 4).
 *
 * The whole 60-second flight must be watchable with ZERO photographs:
 * this module builds the desert night from particles alone —
 *
 *   · stars + a soft dawn-glow on the far horizon
 *   · a cloud sea (dark deck + slow pale motes) for beats 1–2
 *   · the Gobi/Mingsha dunes: a value-noise ridge heightfield rendered
 *     as ~180k drifting gold motes, with a valley carved for the oasis
 *     and an apron flattening toward the cliff
 *   · the oasis: poplar clusters of green motes + a twinkling river
 *   · the Mogao cliff: a dark mass textured with rock motes,
 *     honeycombed with faintly GLOWING rectangular cave mouths, and
 *     the one bright doorway we aim for
 *   · corridor + chamber placeholders (replaced by CaveInterior, step 7)
 *
 * Photo point clouds (step 5+) will land ON TOP of this world and can
 * be removed at any time — every photo improves it, none is required.
 * Tunables: config.intro.world. IntroFlight calls update(t) per frame
 * for the mote shimmer/twinkle time.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';

// ── Tiny value noise (deterministic, no deps) ────────────────────────
function hash2(ix, iz) {
  let n = (ix * 374761393 + iz * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (((n ^ (n >>> 16)) >>> 0) % 100000) / 100000;
}
function vnoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}
function fbm(x, z) {
  return vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.3
    + vnoise(x * 4.3, z * 4.3) * 0.15;
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const sstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// Raw sRGB components for our raw-output mote shader. (THREE.Color
// would convert hex → linear working space, but the shader writes
// gl_FragColor without a linear→sRGB pass, so dark colors would land
// nearly black. Bypass color management entirely.)
const srgb = (hex) => {
  const c = parseInt(hex.replace('#', ''), 16);
  return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
};

export class IntroWorld {
  constructor(scene) {
    this.scene = scene;
    this.animMats = []; // materials whose `time` uniform we advance

    this.buildSky();
    this.buildClouds();
    this.buildDunes();
    this.buildOasis();
    this.buildCliff();
    this.buildInterior();
  }

  update(t) {
    for (const m of this.animMats) m.uniforms.time.value = t;
  }

  // ── Shared mote shader (soft round points, manual black fog) ───────
  makeMotes(pos, col, phase, opts = {}) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: {
        time: { value: 0 },
        sizeScale: { value: (opts.size ?? 2.6) * Math.min(window.devicePixelRatio || 1, 2) },
        maxPx: { value: opts.maxPx ?? 9 },
        shimmerAmp: { value: opts.shimmer ?? 0 },
        opacity: { value: opts.opacity ?? 0.9 },
        twinkle: { value: opts.twinkle ?? 0 },
        fogD: { value: config.intro.camera.fogDensity },
      },
      vertexShader: /* glsl */ `
        attribute vec3 color;
        attribute float phase;
        uniform float time;
        uniform float sizeScale;
        uniform float maxPx;
        uniform float shimmerAmp;
        uniform float fogD;
        varying vec3 vColor;
        varying float vFog;
        varying float vPhase;
        void main() {
          vec3 p = position;
          // the slow drift that makes the sand feel alive
          p.y += sin(time * 0.6 + phase * 6.2831) * shimmerAmp;
          p.x += cos(time * 0.43 + phase * 12.566) * shimmerAmp * 0.6;
          vec4 mv = viewMatrix * vec4(p, 1.0);
          float dist = max(1.0, -mv.z);
          // Sub-linear falloff: distant motes stay ~3px and overlap
          // into a continuous glowing surface instead of a 1px
          // screen-door speckle (physical 1/dist made the far desert
          // vanish entirely).
          gl_PointSize = clamp(sizeScale * 220.0 / pow(dist, 0.72), 1.5, maxPx);
          vFog = exp(-dist * fogD);
          vColor = color;
          vPhase = phase;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float opacity;
        uniform float twinkle;
        uniform float time;
        varying vec3 vColor;
        varying float vFog;
        varying float vPhase;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.12, d) * opacity;
          a *= mix(1.0, 0.5 + 0.5 * sin(time * 2.4 + vPhase * 40.0), twinkle);
          gl_FragColor = vec4(vColor * vFog, a * mix(0.65, 1.0, vFog));
        }
      `,
    });
    this.animMats.push(mat);
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    return points;
  }

  // ── Sky: stars + the dawn glow we fly toward ───────────────────────
  buildSky() {
    const s = this.scene;
    {
      const count = 1600;
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i += 1) {
        pos[i * 3] = (Math.random() - 0.5) * 60000;
        pos[i * 3 + 1] = 600 + Math.random() * 17000;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 60000;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      s.add(new THREE.Points(g, new THREE.PointsMaterial({
        color: 0xbfd0e8, size: 2, sizeAttenuation: false, fog: false,
      })));
    }
    const cnv = document.createElement('canvas');
    cnv.width = 1024;
    cnv.height = 512;
    const ctx = cnv.getContext('2d');
    const grad = ctx.createRadialGradient(512, 256, 12, 512, 256, 480);
    grad.addColorStop(0, 'rgba(255,214,140,0.95)');
    grad.addColorStop(0.35, 'rgba(200,130,50,0.5)');
    grad.addColorStop(1, 'rgba(120,70,20,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);
    // Feather to FULLY transparent well inside every edge — a circular
    // gradient can't fade within the 512-tall canvas, so its top/bottom
    // stayed ~0.36 opaque and the plane's rectangle showed as a hard gold
    // seam. An elliptical alpha mask erases the edges so the glow is just a
    // soft, borderless band on the horizon.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.save();
    ctx.translate(512, 256);
    ctx.scale(1, 0.5);            // squash → a wide ellipse (fades within 256 vertically)
    const mask = ctx.createRadialGradient(0, 0, 0, 0, 0, 500);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.72, 'rgba(0,0,0,1)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mask;
    ctx.fillRect(-512, -512, 1024, 1024);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    // A low, soft dawn band on the horizon — sized so its gradient
    // fades within the plane (no visible rectangle) but not so large it
    // washes the sky or silhouettes the far cliff.
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(46000, 12000),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(cnv), transparent: true, fog: false,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85,
      }),
    );
    glow.position.set(0, 300, -30000);
    s.add(glow);
  }

  // ── The cloud sea (beats 1–2 hang above it, the drop punches through)
  // A soft fluffy cloud sprite — overlapping radial blobs, edge-masked.
  makeCloudTexture() {
    const cnv = document.createElement('canvas');
    cnv.width = 128;
    cnv.height = 128;
    const x = cnv.getContext('2d');
    for (let i = 0; i < 16; i += 1) {
      const cx = 64 + (Math.random() - 0.5) * 74;
      const cy = 64 + (Math.random() - 0.5) * 56;
      const r = 16 + Math.random() * 32;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fill();
    }
    // fade the whole puff out toward its edges so sprites don't box-clip
    const img = x.getImageData(0, 0, 128, 128);
    for (let j = 0; j < 128; j += 1) {
      for (let i = 0; i < 128; i += 1) {
        const dx = (i - 64) / 64;
        const dy = (j - 64) / 64;
        const fade = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
        const idx = (j * 128 + i) * 4 + 3;
        img.data[idx] *= fade * fade;
      }
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cnv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // The cloud SEA the flight hangs over and then PUNCHES THROUGH (beats
  // 1–2): a real volumetric bank of soft cloud sprites the camera flies
  // into, not a flat deck. Dense along the descent corridor so the drop
  // reads as clouds rushing up and past; a sparse far ring gives the
  // horizon "sea of clouds". Built from a soft puff texture so each
  // sprite is a wisp of cloud, lit cool on top and warm from the dawn.
  buildClouds() {
    const s = this.scene;
    const tex = this.makeCloudTexture();

    // (No flat deck — a horizontal plane reads as a hard band edge-on as
    // the camera drops through it. The volumetric clouds + depth haze
    // hide the desert far below at beat 1 on their own.)

    const cool = new THREE.Color(0x9fb0cc);
    const warm = new THREE.Color(0xd8b070);
    const tmp = new THREE.Color();

    const build = (count, place, bright = 1) => {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const siz = new Float32Array(count);
      for (let i = 0; i < count; i += 1) {
        const [px, py, pz, size] = place();
        pos[i * 3] = px;
        pos[i * 3 + 1] = py;
        pos[i * 3 + 2] = pz;
        siz[i] = size;
        // cool on top, warming toward the dawn (−z) and the underside
        const warmth = Math.min(1, Math.max(0,
          (2900 - py) / 700 * 0.5 + (5000 - pz) / 30000 * 0.6));
        tmp.copy(cool).lerp(warm, warmth * 0.7);
        const b = (0.7 + Math.random() * 0.3) * bright;
        col[i * 3] = tmp.r * b;
        col[i * 3 + 1] = tmp.g * b;
        col[i * 3 + 2] = tmp.b * b;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('psize', new THREE.BufferAttribute(siz, 1));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2600, 0), 60000);
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        uniforms: {
          map: { value: tex },
          opacity: { value: 1.7 },  // fuller, more solid cloud (near white-out)
          ppm: { value: window.innerHeight / 2 }, // world→px scale factor
        },
        vertexShader: /* glsl */ `
          attribute vec3 color;
          attribute float psize;
          uniform float ppm;
          varying vec3 vColor;
          varying float vFog;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float dist = max(1.0, -mv.z);
            gl_PointSize = psize * ppm / dist;   // perspective size
            vFog = clamp(exp(-dist * 0.00007), 0.0, 1.0);
            vColor = color;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D map;
          uniform float opacity;
          varying vec3 vColor;
          varying float vFog;
          void main() {
            vec4 t = texture2D(map, gl_PointCoord);
            gl_FragColor = vec4(vColor, t.a * opacity * vFog);
          }
        `,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      s.add(pts);
    };

    // corridor bank — FULL WIDTH now, so at the drop the clouds fill the
    // entire frame edge to edge, not just a central band; thick in y so
    // the camera flies through a wall of cloud.
    build(6000, () => [
      (Math.random() - 0.5) * 20000,
      2050 + Math.random() * 1250,
      -4200 + Math.random() * 11000,
      700 + Math.random() * 1250,
    ]);
    // NEAR WHITE-OUT tube — a dense knot of big, bright cloud sprites
    // hugging the descent line (camera runs x≈0, z≈2350→900, y≈3140→2100
    // across beats 2–3). As the nose punches through, each near sprite
    // covers most of the lens and they overlap into a near-solid white-out,
    // which then clears as the desert opens below.
    build(4200, () => [
      (Math.random() - 0.5) * 4200,
      1950 + Math.random() * 1500,
      -800 + Math.random() * 3200,
      1050 + Math.random() * 1700,
    ], 1.35);
    // far horizon ring — the "sea of clouds" seen at beat 1, wider/fuller
    build(1100, () => {
      const a = Math.random() * Math.PI * 2;
      const rad = 12000 + Math.random() * 23000;
      return [Math.cos(a) * rad, 2400 + Math.random() * 620,
        Math.sin(a) * rad - 4000, 3000 + Math.random() * 4400];
    });
  }

  // ── Dunes: the ridge heightfield of drifting gold motes ────────────
  duneHeight(x, z) {
    const w = config.intro.world;
    const sBand = z * 0.0045 + fbm(x * 0.0016, z * 0.0016) * 3.0;
    let h = ((0.5 + 0.5 * Math.sin(sBand)) ** 1.6) * w.crestHeight;
    h += fbm(x * 0.0009 + 7.3, z * 0.0009 - 4.1) * w.baseHeight;
    // the oasis valley carves through…
    h *= 0.22 + 0.78 * sstep(160, 460, Math.abs(z - w.oasisZ));
    // …and the field flattens to an apron at the cliff's feet
    h *= 0.15 + 0.85 * clamp01((z + 8150) / 950);
    return h;
  }

  buildDunes() {
    const w = config.intro.world;
    const [x0, x1, z0, z1] = w.duneArea;
    const nCore = w.duneCount;
    const nOut = w.duneOutskirts;
    const n = nCore + nOut;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const ph = new Float32Array(n);
    const dark = srgb(w.sandDark);
    const gold = srgb(w.sandGold);
    const hMax = w.crestHeight + w.baseHeight;
    for (let i = 0; i < n; i += 1) {
      // dense gold now spans the FULL width of the ground (not just a
      // center strip); outskirts reach further still beyond the frame
      const x = i < nCore
        ? x0 + Math.random() * (x1 - x0)
        : x0 * 1.4 + Math.random() * (x1 - x0) * 1.4;
      const z = z0 + Math.random() * (z1 - z0);
      const h = this.duneHeight(x, z);
      pos[i * 3] = x;
      pos[i * 3 + 1] = h + Math.random() * 2;
      pos[i * 3 + 2] = z;
      // brighter, fuller gold — even the flats catch light, so the whole
      // floor reads as one glowing gold body, not just the lit crests
      const t = clamp01(0.4 + (h / hMax) * 0.9);
      const b = 1.05 + Math.random() * 0.3;
      col[i * 3] = (dark[0] + (gold[0] - dark[0]) * t) * b;
      col[i * 3 + 1] = (dark[1] + (gold[1] - dark[1]) * t) * b;
      col[i * 3 + 2] = (dark[2] + (gold[2] - dark[2]) * t) * b;
      ph[i] = Math.random();
    }
    // Additive: distant motes ACCUMULATE into the soft glow of moonlit
    // sand — the same luminous-on-black language as the whole piece.
    // Denser + fuller so the desert reads as one cohesive body of sand,
    // not scattered specks.
    this.makeMotes(pos, col, ph, {
      size: w.moteSize, opacity: 1.0, shimmer: 0.9, additive: true,
    });
  }

  // ── The oasis: poplar clusters + the twinkling river ───────────────
  buildOasis() {
    const w = config.intro.world;
    const zLine = w.oasisZ;
    // green blobs along the valley
    const clusters = 24;
    const per = Math.floor(w.oasisMotes / clusters);
    const n = clusters * per;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const ph = new Float32Array(n);
    const g1 = srgb('#173420');
    const g2 = srgb('#3f7a3a');
    let i = 0;
    for (let cIdx = 0; cIdx < clusters; cIdx += 1) {
      const cx = -2100 + cIdx * 178 + (Math.random() - 0.5) * 90;
      const cz = zLine + (Math.random() - 0.5) * 260;
      const rad = 40 + Math.random() * 34;
      const hgt = 45 + Math.random() * 55;
      for (let k = 0; k < per; k += 1, i += 1) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * rad;
        pos[i * 3] = cx + Math.cos(a) * r;
        pos[i * 3 + 1] = Math.random() * hgt;
        pos[i * 3 + 2] = cz + Math.sin(a) * r * 0.8;
        const t = Math.random();
        const b = 0.7 + Math.random() * 0.5;
        col[i * 3] = (g1[0] + (g2[0] - g1[0]) * t) * b;
        col[i * 3 + 1] = (g1[1] + (g2[1] - g1[1]) * t) * b;
        col[i * 3 + 2] = (g1[2] + (g2[2] - g1[2]) * t) * b;
        ph[i] = Math.random();
      }
    }
    this.makeMotes(pos, col, ph, { size: 2.8, opacity: 0.6, shimmer: 0.8, additive: true });

    // the river: a dark surface + additive glints that twinkle
    // No solid water surface: flying nearly overhead, ANY slab reads
    // as a pale wall across the frame. The twinkling glints alone
    // carry the river.
    const gn = 900;
    const gp = new Float32Array(gn * 3);
    const gc = new Float32Array(gn * 3);
    const gph = new Float32Array(gn);
    const gcol = srgb('#9fc8e8');
    for (let k = 0; k < gn; k += 1) {
      gp[k * 3] = (Math.random() - 0.5) * 4600;
      gp[k * 3 + 1] = 3 + Math.random() * 2;
      gp[k * 3 + 2] = zLine + (Math.random() - 0.5) * 80;
      const b = 0.5 + Math.random() * 0.5;
      gc[k * 3] = gcol[0] * b;
      gc[k * 3 + 1] = gcol[1] * b;
      gc[k * 3 + 2] = gcol[2] * b;
      gph[k] = Math.random();
    }
    this.makeMotes(gp, gc, gph, {
      size: 2.2, opacity: 0.8, twinkle: 0.8, additive: true,
    });
  }

  // ── The Mogao cliff (莫高窟): the unmistakable grotto wall — a bright
  // dawn-lit sandstone face with rows of dark cave-mouths carved into it,
  // railed galleries between the tiers, a scatter of lamplit chambers,
  // and the vermilion nine-story pagoda (九层楼) standing against it.
  buildCliff() {
    const s = this.scene;
    const w = config.intro.world;
    const mat = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, ...opts });

    // occluding mass (hides stars/dunes behind the rock)
    const cliff = new THREE.Mesh(new THREE.BoxGeometry(6800, 620, 240), mat(0x140d07));
    cliff.position.set(0, 300, -8322); // front face ≈ z=-8202
    s.add(cliff);

    // ── the honeycomb: tiers × columns of cave mouths, carved as EMPTY
    // rectangles in the sandstone field so they read as dark openings in
    // a lit wall (not glowing planes on black). Neat rows, lightly weathered.
    const tiers = [90, 185, 280, 375, 470, 555];
    const colStep = 150, mouthW = 74, mouthH = 70;
    const mouthList = [];
    for (const ty of tiers) {
      for (let x = -3150; x <= 3150; x += colStep) {
        if (Math.random() < 0.10) continue;              // weathered gaps
        mouthList.push({ x: x + (Math.random() - 0.5) * 26, y: ty + (Math.random() - 0.5) * 12 });
      }
    }
    const inMouth = (x, y) => {
      for (let k = 0; k < mouthList.length; k += 1) {
        const m = mouthList[k];
        if (Math.abs(x - m.x) < mouthW * 0.5 && Math.abs(y - m.y) < mouthH * 0.5) return true;
      }
      return false;
    };

    // sandstone mote field — dense & dawn-lit, skipping the mouth rects
    const n = w.cliffMotes;
    const pos = [], col = [], ph = [];
    const r1 = srgb('#3a2712');  // shadowed sand
    const r2 = srgb('#c1904f');  // dawn-lit sand (crests warm)
    let placed = 0;
    for (let i = 0; i < n * 2 && placed < n; i += 1) {
      const x = (Math.random() - 0.5) * 6400;
      const y = 10 + Math.random() * 570;
      if (inMouth(x, y)) continue;                       // leave mouths empty
      pos.push(x, y, -8200 + Math.random() * 14);
      const t = clamp01(0.3 + fbm(x * 0.004, y * 0.004) * 0.7);
      const b = 0.8 + Math.random() * 0.5;
      col.push((r1[0] + (r2[0] - r1[0]) * t) * b,
        (r1[1] + (r2[1] - r1[1]) * t) * b,
        (r1[2] + (r2[2] - r1[2]) * t) * b);
      ph.push(Math.random());
      placed += 1;
    }
    // railed galleries: a pale mote line running along each tier's foot
    const rail = srgb('#8f7c5c');
    for (const ty of tiers) {
      for (let x = -3150; x <= 3150; x += 9) {
        if (inMouth(x, ty - mouthH * 0.5 - 6)) continue;
        pos.push(x + (Math.random() - 0.5) * 6, ty - mouthH * 0.5 - 6 + (Math.random() - 0.5) * 5,
          -8196 + Math.random() * 6);
        const b = 0.7 + Math.random() * 0.4;
        col.push(rail[0] * b, rail[1] * b, rail[2] * b);
        ph.push(Math.random());
      }
    }
    this.makeMotes(new Float32Array(pos), new Float32Array(col), new Float32Array(ph),
      { size: 3.4, opacity: 0.85, shimmer: 0.3, additive: true });

    // a scatter of lamplit chambers — warm embers deep in some mouths
    const litGeo = new THREE.PlaneGeometry(mouthW * 0.82, mouthH * 0.82);
    for (let k = 0; k < 30; k += 1) {
      const m = mouthList[(Math.random() * mouthList.length) | 0];
      const lit = new THREE.Mesh(litGeo, mat(0x6a3d12, { transparent: true, opacity: 0.45 }));
      lit.position.set(m.x, m.y, -8203);
      s.add(lit);
    }

    // 九层楼 — the nine-story pagoda: Mogao's landmark, standing against
    // the cliff right of our entry mouth, rising above the ridge. Frontal
    // stack of vermilion tiers tapering upward, each capped by a dark eave.
    this.buildPagoda(560, 4, -8180);

    // the doorway we aim for (Cave 217) — dead centre, a glowing rim
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(108, 132), mat(0x7a4a18));
    rim.position.set(0, 120, -8200);
    s.add(rim);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(80, 104), mat(0x000000));
    mouth.position.set(0, 120, -8199);
    s.add(mouth);
  }

  // The nine-story pagoda (九层楼), read frontally: stacked red tiers with
  // dark roof eaves, tapering up to a peak — the instantly-Mogao silhouette.
  buildPagoda(cx, cy, cz) {
    const s = this.scene;
    const mat = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, ...opts });
    const grp = new THREE.Group();
    grp.position.set(cx, cy, cz);
    const red = 0xc0461f, eave = 0x321708, post = 0x8a2c12;
    const nTier = 8, baseW = 340, topW = 176, tierH = 86;
    // a pale masonry base hall the tower rises from (Mogao's ground story)
    const base = new THREE.Mesh(new THREE.PlaneGeometry(baseW * 1.15, tierH * 0.9), mat(0x9a7c52));
    base.position.set(0, tierH * 0.32, -0.5);
    grp.add(base);
    for (let i = 0; i < nTier; i += 1) {
      const f = i / (nTier - 1);
      const wd = baseW + (topW - baseW) * f;
      const y = tierH * 0.5 + (i + 0.5) * tierH;
      const body = new THREE.Mesh(new THREE.PlaneGeometry(wd, tierH * 0.8), mat(red));
      body.position.set(0, y, 0);
      grp.add(body);
      // vertical posts (dark columns dividing the balcony)
      for (const px of [-0.36, -0.12, 0.12, 0.36]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(wd * 0.045, tierH * 0.66), mat(post));
        p.position.set(px * wd, y, 0.5);
        grp.add(p);
      }
      // overhanging roof eave (wider than the body, dark tile)
      const ev = new THREE.Mesh(new THREE.PlaneGeometry(wd * 1.26, tierH * 0.26), mat(eave));
      ev.position.set(0, y + tierH * 0.5, 1);
      grp.add(ev);
    }
    // crowning roof peak
    const peak = new THREE.Mesh(new THREE.PlaneGeometry(topW * 0.6, tierH * 0.7), mat(0x8a3316));
    peak.position.set(0, tierH * 0.5 + (nTier + 0.4) * tierH, 0);
    grp.add(peak);
    s.add(grp);
  }

  // ── Corridor + chamber placeholders (CaveInterior replaces, step 7) ─
  buildInterior() {
    const s = this.scene;
    const mat = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, ...opts });

    for (const sx of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat(0x0d0906, {
        side: THREE.DoubleSide,
      }));
      wall.rotation.y = Math.PI / 2;
      wall.position.set(sx * 58, 105, -8300);
      s.add(wall);
    }

    const room = new THREE.Mesh(
      new THREE.BoxGeometry(760, 380, 460),
      mat(0x191108, { side: THREE.BackSide }),
    );
    room.position.set(0, 190, -8630);
    s.add(room);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(room.geometry),
      new THREE.LineBasicMaterial({ color: 0x3a2a12 }),
    );
    edges.position.copy(room.position);
    s.add(edges);

    // (The niche Buddha, north-wall tableau, west panel and ceiling are
    // REAL murals now — PhotoClouds in config.intro.interior, condensing
    // via CaveInterior. Only the bare rock shell lives here.)
  }
}
