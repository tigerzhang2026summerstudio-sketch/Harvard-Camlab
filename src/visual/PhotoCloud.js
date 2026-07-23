/**
 * PhotoCloud — a photograph displaced into a 3D point cloud
 * (intro build step 5, the heart of the hybrid look).
 *
 * A color image is sampled on a grid; every sample becomes one point
 * whose color is the source pixel and whose home position is the image
 * plane displaced in Z by a depth map — so the camera flying PAST it
 * gets real parallax, not a billboard. Clouds are placed as stations
 * along the flight path via config.intro.stations.
 *
 * DEPTH: if `<name>_depth.png` exists beside the image it is used
 * (white = near). Otherwise a procedural approximation suitable for
 * aerial landscape shots runs: depth from the vertical image
 * coordinate (bottom of frame = near, top = far), modulated a little
 * by luminance. The mode is logged per asset; the fallback must look
 * acceptable on its own — depth maps may never arrive.
 *
 * COHESION (see visual/Cohesion.js): at 1 the points hold their homes
 * (photographic); as it falls each point drifts along a noise velocity
 * seeded by its index, growing and loosening — the image disintegrates
 * into the same luminous mote-medium as the rest of the piece. The
 * uniform is driven per frame by IntroFlight from the global track.
 *
 * A missing image never breaks the flight — it logs and the procedural
 * world simply shows through.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

export class PhotoCloud {
  /**
   * st: one entry of config.intro.stations —
   *   {file, pos:[x,y,z], width, ry?, rx?, depthScale, grid:[gw,gh],
   *    size?, opacity?, lumaCutoff?, crop?:[u0,v0,u1,v1], fogMul?}
   * crop samples only that sub-rect of the image (trim skies, wires,
   * fences without touching the file); rx leans a panel back like a
   * hillside; fogMul<1 keeps distant backdrop stations readable
   * through the depth haze; tint [r,g,b] multiplies the photo into the
   * night (daylight shots must not glare over the dark desert);
   * edgeFade dissolves the rectangular border into the dark;
   * window [t0,t1] shows the station only in its beats (±2s fades) —
   * a distant backdrop must not bleed under later horizons.
   */
  constructor(scene, st) {
    this.scene = scene;
    this.st = st;
    this.points = null;
    this.ready = false;
    this.load();
  }

  async load() {
    const st = this.st;
    const img = await loadImage(st.file);
    if (!img) {
      console.warn(`[photocloud] ${st.file} missing — station skipped, procedural world shows through`);
      return;
    }
    const depthImg = await loadImage(st.file.replace(/\.(jpe?g|png)$/i, '_depth.png'));
    console.info(`[photocloud] ${st.file}: ${depthImg ? 'depth map' : 'procedural depth (bottom=near)'}`);

    const [gw, gh] = st.grid;
    const [cu0, cv0, cu1, cv1] = st.crop ?? [0, 0, 1, 1];
    const sx = cu0 * img.width;
    const sy = cv0 * img.height;
    const sw = (cu1 - cu0) * img.width;
    const sh = (cv1 - cv0) * img.height;
    const cnv = document.createElement('canvas');
    cnv.width = gw;
    cnv.height = gh;
    const ctx = cnv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, gw, gh);
    const rgba = ctx.getImageData(0, 0, gw, gh).data;

    let depth = null;
    if (depthImg) {
      ctx.drawImage(depthImg, sx, sy, sw, sh, 0, 0, gw, gh);
      depth = ctx.getImageData(0, 0, gw, gh).data;
    }

    // World size of the image plane; height follows the CROPPED aspect.
    const width = st.width;
    const height = width * (sh / sw);
    const cutoff = st.lumaCutoff ?? 0.045;

    const edge = st.edgeFade ?? 0.12; // border dissolve, in uv units
    const eFade = (x) => Math.min(1, Math.max(0, x / edge)) ** 1.5;

    const pos = [];
    const col = [];
    const seed = [];
    const att = [];
    for (let iy = 0; iy < gh; iy += 1) {
      for (let ix = 0; ix < gw; ix += 1) {
        const j = (iy * gw + ix) * 4;
        const r = rgba[j] / 255;
        const g = rgba[j + 1] / 255;
        const b = rgba[j + 2] / 255;
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luma < cutoff) continue; // dark ground stays empty space

        const u = ix / (gw - 1);
        const v = iy / (gh - 1); // 0 top … 1 bottom
        let d;
        if (depth) d = depth[j] / 255; // white = near
        else d = Math.min(1, 0.78 * v + 0.22 * (1 - luma)); // bottom = near
        pos.push(
          (u - 0.5) * width,
          (0.5 - v) * height,
          d * st.depthScale,
        );
        col.push(r, g, b); // canvas bytes ARE sRGB — raw shader wants that
        seed.push(Math.random());
        att.push(eFade(Math.min(u, 1 - u)) * eFade(Math.min(v, 1 - v)));
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(seed), 1));
    geo.setAttribute('att', new THREE.BufferAttribute(new Float32Array(att), 1));

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      // Additive suits luminous flyby motes; a pale-ground PAINTING needs
      // normal blending so its dark pigment reads as dark (additive can
      // only ever add light, washing the picture into uniform glitter).
      blending: st.blend === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending,
      uniforms: {
        time: { value: 0 },
        cohesion: { value: 1 },
        sizeBase: { value: (st.size ?? 3.0) * Math.min(window.devicePixelRatio || 1, 2) },
        maxPx: { value: 10 },
        opacity: { value: st.opacity ?? 0.85 },
        driftAmp: { value: st.driftAmp ?? config.intro.cloudDrift },
        fogD: { value: config.intro.camera.fogDensity * (st.fogMul ?? 1) },
        tint: { value: new THREE.Vector3(...(st.tint ?? [1, 1, 1])) },
        winA: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute vec3 color;
        attribute float seed;
        attribute float att;
        uniform float time;
        uniform float cohesion;
        uniform float sizeBase;
        uniform float maxPx;
        uniform float driftAmp;
        uniform float fogD;
        varying vec3 vColor;
        varying float vFog;
        varying float vA;
        void main() {
          float k = 1.0 - cohesion;
          vec3 p = position;
          // noise-velocity drift, seeded per point: quadratic in k so
          // high cohesion barely trembles and low cohesion wanders far
          float a1 = seed * 50.265;
          float a2 = seed * 23.248 + time * 0.22;
          vec3 dir = vec3(
            sin(a1 + time * 0.31),
            0.55 * cos(a1 * 1.7 + time * 0.23),
            cos(a2));
          p += dir * (k * k) * driftAmp * (0.35 + 0.65 * fract(seed * 7.13));
          // and a faint breath even when solid — a photo made of light
          p += dir * 0.35 * sin(time * 0.5 + seed * 20.0);

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = max(1.0, -mv.z);
          // loosened points swell (same sub-linear law as the world)
          gl_PointSize = clamp(
            (sizeBase * (1.0 + k * 1.6)) * 220.0 / pow(dist, 0.72), 1.5, maxPx);
          vFog = exp(-dist * fogD);
          vColor = color;
          vA = (1.0 - 0.4 * k) * att; // dispersing light thins; edges dissolve
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float opacity;
        uniform float winA;
        uniform vec3 tint;
        varying vec3 vColor;
        varying float vFog;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.15, d) * opacity * vA * winA;
          gl_FragColor = vec4(vColor * tint * vFog, a * mix(0.65, 1.0, vFog));
        }
      `,
    });

    this.points = new THREE.Points(geo, this.material);
    this.points.position.set(...st.pos);
    this.points.rotation.set(st.rx ?? 0, st.ry ?? 0, 0);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.ready = true;
    console.info(`[photocloud] ${st.file}: ${pos.length / 3} points`);
  }

  /** Per frame from IntroFlight: the global cohesion + the clock. */
  set(cohesion, time) {
    if (!this.ready) return;
    this.material.uniforms.cohesion.value = cohesion;
    this.material.uniforms.time.value = time;
    let w = 1;
    if (this.st.window) {
      const [t0, t1] = this.st.window;
      w = Math.min(
        Math.min(1, Math.max(0, (time - (t0 - 2)) / 2)),   // fade in
        1 - Math.min(1, Math.max(0, (time - t1) / 2)),      // fade out
      );
    }
    this.material.uniforms.winA.value = w;
    this.points.visible = w > 0.001;
  }
}
