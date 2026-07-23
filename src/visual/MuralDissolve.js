/**
 * MuralDissolve — the piece's central image: real mural imagery that
 * materializes out of drifting particles and dissolves back into them.
 *
 * An image (Cave 217 crop, or a shipped placeholder) is drawn to an
 * offscreen canvas and sampled on a grid: every bright-enough pixel
 * becomes one particle whose HOME is that pixel's place in the world and
 * whose color is the pixel's color, re-tinted toward the mineral palette.
 *
 * One uniform does the art: uDissolve ∈ [0,1].
 *   0 → every particle sits at home; the image reads clearly.
 *   1 → particles are flung along their own scatter vectors and wander
 *       as faint motes. Departures are staggered (aStage), so the image
 *       frays away / condenses back rather than snapping.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPPWU;
  uniform float uDissolve; // 0 image ↔ 1 drifting motes
  uniform float uAlpha;    // overall presence (0 hides the layer entirely)

  attribute vec3  aColor;
  attribute vec3  aScatter; // where this particle flies when dissolved
  attribute float aSize;
  attribute float aSeed;
  attribute float aStage;   // staggers departure/return

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    if (uAlpha <= 0.001) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0; vColor = vec3(0.0); vAlpha = 0.0;
      return;
    }

    // Per-particle progress: early stages leave first, return last.
    float local = clamp(uDissolve * 1.5 - aStage * 0.5, 0.0, 1.0);
    float k = local * local * (3.0 - 2.0 * local);

    float w = aSeed * 6.2831853;
    vec3 pos = position + aScatter * k;
    // Alive even at rest (faint shimmer); adrift when dissolved.
    pos.x += sin(uTime * 0.5 + w * 5.0) * (1.2 + 30.0 * k);
    pos.y += cos(uTime * 0.42 + w * 3.0) * (0.9 + 22.0 * k);

    vColor = aColor;
    vAlpha = mix(1.0, 0.14, k) * uAlpha;
    // Motes swell a little mid-flight — the fraying edge glitters.
    gl_PointSize = aSize * uPPWU * (1.0 + 0.7 * k * (1.0 - k));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uIntensity;
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float core = smoothstep(0.5, 0.1, d);
    if (core <= 0.001) discard;
    vec3 col = vColor * uIntensity * (0.75 + 0.45 * core * core);
    // LUMA KEY (see ParticleSystem): dark mural motes go transparent so
    // the painted wall behind reads through; bright ones stay.
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    float key = mix(0.5, 1.0, smoothstep(0.02, 0.4, luma));
    gl_FragColor = vec4(col, vAlpha * core * key);
  }
`;

export class MuralDissolve {
  /**
   * opts: { url, x, y, height } in world units (x,y = panel center);
   * width follows the image aspect. Missing files log a warning and the
   * instance stays inert — visuals never break on absent assets.
   */
  constructor(parent, opts) {
    this.opts = opts;
    this.ready = false;
    this.dissolve = 1; // born as scattered motes
    this.alpha = 0;    // and invisible until something assembles it
    this.photo = 0;    // photoThrough: 0..1 presence of the REAL image

    const img = new Image();
    img.onload = () => {
      try {
        this.build(img, parent);
        this.ready = true;
      } catch (err) {
        console.warn(`[murals] failed to build ${opts.url}:`, err);
      }
    };
    img.onerror = () => {
      console.warn(`[murals] missing ${opts.url} — add the image to assets/murals/ (see README)`);
    };
    img.src = opts.url;
  }

  build(img, parent) {
    const m = config.murals;
    const qs = config.qualityScale[config.quality].particleScale;
    const budget = Math.floor(m.maxParticlesPerMural * Math.max(qs, 0.25));

    // Sample the image on a grid sized to the particle budget.
    const aspect = img.width / img.height;
    let gh = Math.round(Math.sqrt(budget / aspect));
    let gw = Math.round(gh * aspect);
    const canvas = document.createElement('canvas');
    canvas.width = gw; canvas.height = gh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, gw, gh);
    const data = ctx.getImageData(0, 0, gw, gh).data;

    const worldH = this.opts.height;
    const worldW = worldH * aspect;
    const lapis = new THREE.Color(config.palette.lapis);
    const gold = new THREE.Color(config.palette.gold);
    const tint = new THREE.Color();
    const c = new THREE.Color();

    const home = []; const color = []; const size = [];
    const seed = []; const stage = []; const scatter = [];

    for (let gy = 0; gy < gh; gy += 1) {
      for (let gx = 0; gx < gw; gx += 1) {
        const i = (gy * gw + gx) * 4;
        const a = data[i + 3] / 255;
        if (a < 0.35) continue;
        // Scene-specific silhouette mask so the images aren't all bare
        // rectangles: oval · mandorla (aura) · arch (niche) · lotus (throne).
        // Back-compat: a bare `mask` box with no maskShape stays an oval.
        const shape = this.opts.maskShape ?? (this.opts.mask ? 'oval' : null);
        if (shape) {
          const alpha = shapeAlpha(gx / gw, gy / gh, shape, this.opts.mask);
          if (Math.random() > alpha) continue; // soft, feathered silhouette edge
        }
        const r = data[i] / 255; const g = data[i + 1] / 255; const b = data[i + 2] / 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (this.opts.invert) {
          // Dark-figure murals (aged pigments darker than the plaster):
          // keep the DARK strokes and render them as light, below.
          if (lum > (this.opts.cutoff ?? 0.45)) continue;
        } else {
          if (lum < (this.opts.cutoff ?? m.luminanceCutoff)) continue;
          // Mural photos sit on pale plaster: skip bright low-saturation
          // pixels so only the painted figures become particles.
          if (this.opts.plasterSkip) {
            const mx = Math.max(r, g, b); const mn = Math.min(r, g, b);
            const sat = mx > 0 ? (mx - mn) / mx : 0;
            if (lum > m.plasterLum && sat < m.plasterSat) continue;
          }
        }

        home.push(
          this.opts.x + (gx / gw - 0.5) * worldW,
          this.opts.y + (0.5 - gy / gh) * worldH,
          0,
        );

        if (this.opts.invert) {
          // The darker the stroke, the brighter it burns — the figure
          // becomes a body of gold light drawn by the painter's line.
          const glow = 1 - lum;
          tint.lerpColors(lapis, gold, 0.55 + glow * 0.45);
          c.setRGB(r, g, b).lerp(tint, this.opts.retint ?? 0.55)
            .multiplyScalar(0.55 + glow * 0.95);
          size.push(1.7 + glow * 1.7 + Math.random() * 0.5);
        } else {
          // Optional contrast curve for flat/busy murals: darks thin out
          // (fewer particles) and dim by lum^gamma, so the painting's
          // forms survive the additive glow instead of washing to white.
          if (this.opts.gamma && Math.random() > 0.28 + lum * 0.9) continue;
          const curve = this.opts.gamma
            ? Math.pow(lum, this.opts.gamma) * (this.opts.gain ?? 1.7)
            : 0.75 + lum * 0.65;
          // Re-tint toward the mineral palette: shadows toward lapis,
          // lights toward gold — keeps every mural in the piece's key.
          tint.lerpColors(lapis, gold, Math.min(1, lum * 1.4));
          c.setRGB(r, g, b).lerp(tint, this.opts.retint ?? m.retint)
            .multiplyScalar(curve);
          size.push(1.7 + lum * 1.6 + Math.random() * 0.5);
        }
        color.push(c.r, c.g, c.b);
        seed.push(Math.random());
        stage.push(Math.random());

        // Scatter vector: outward-ish with upward drift — dissolving
        // murals rise away like smoke from a lamp.
        const ang = Math.random() * Math.PI * 2;
        const dist = m.scatterDist * (0.35 + Math.random());
        scatter.push(
          Math.cos(ang) * dist,
          Math.sin(ang) * dist * 0.7 + m.scatterDist * 0.45,
          0,
        );
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(home), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(color), 3));
    geo.setAttribute('aScatter', new THREE.BufferAttribute(new Float32Array(scatter), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(size), 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(seed), 1));
    geo.setAttribute('aStage', new THREE.BufferAttribute(new Float32Array(stage), 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.uniforms = {
      uTime: { value: 0 },
      uPPWU: { value: 1 },
      uDissolve: { value: this.dissolve },
      uAlpha: { value: this.alpha },
      uIntensity: { value: this.opts.intensity ?? config.murals.intensity },
    };

    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    }));
    this.points.frustumCulled = false;
    parent.add(this.points);

    // photoThrough: the ACTUAL photograph on a soft-edged plane that can
    // fade in through the condensed particles — unmistakably readable.
    if (this.opts.photoThrough) {
      const shape = this.opts.maskShape ?? (this.opts.mask ? 'oval' : null);
      const tex = new THREE.CanvasTexture(featherImage(img, shape, this.opts.mask));
      tex.colorSpace = THREE.SRGBColorSpace;
      this.photoMaterial = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending, // light on black, soft edges
        depthWrite: false,
        depthTest: false,
      });
      this.photoMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(worldW, worldH),
        this.photoMaterial,
      );
      this.photoMesh.position.set(this.opts.x, this.opts.y, 5);
      parent.add(this.photoMesh);
    }

    console.info(`[murals] ${this.opts.url}: ${seed.length} particles`);
  }

  update(time, ppwu) {
    if (!this.ready) return;
    this.uniforms.uTime.value = time;
    this.uniforms.uPPWU.value = ppwu;
    this.uniforms.uDissolve.value = this.dissolve;
    this.uniforms.uAlpha.value = this.alpha;
    if (this.photoMaterial) {
      this.photoMaterial.opacity = this.photo * (this.opts.photoMax ?? 0.85);
    }
  }
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Silhouette alpha (0..1, soft-edged) for a mural point/pixel at image
 * coords u,v ∈ [0,1] (v from the top). box = [cx, cy, rx, ry] fractions
 * (defaults to the whole image). Shapes chosen to fit each scene:
 *   oval      — a soft disc (sun, sky)
 *   mandorla  — a pointed almond aura (the Buddha's body of light)
 *   arch      — a niche: straight sides, rounded top (standing attendants)
 *   lotus     — a scalloped bloom (the flower throne)
 */
export function shapeAlpha(u, v, shape, box) {
  const [cx, cy, rx, ry] = box || [0.5, 0.5, 0.5, 0.5];
  const du = (u - cx) / rx;   // -1..1 across the box
  const dv = (v - cy) / ry;   // -1 (top) .. 1 (bottom)
  const f = 0.13;             // feather width
  switch (shape) {
    case 'mandorla': {
      const hw = Math.max(0, 1 - dv * dv); // half-width, → 0 at top & bottom
      return smoothstep(f, -f, Math.abs(du) - hw);
    }
    case 'arch': {
      const spring = -0.25;              // arch springs from the upper part
      const archW = dv < spring
        ? Math.sqrt(Math.max(0, 1 - ((dv - spring) / (-1 - spring)) ** 2))
        : 1;
      const inside = Math.min(archW - Math.abs(du), 1 - Math.abs(dv));
      return smoothstep(-f, f, inside);
    }
    case 'lotus': {
      const th = Math.atan2(dv, du);
      const rr = Math.hypot(du, dv);
      const rim = 0.82 + 0.18 * Math.cos(7 * th); // scalloped petal edge
      const bowl = smoothstep(-0.7, -0.4, dv);     // trim the very top
      return smoothstep(f, -f, rr - rim) * bowl;
    }
    case 'oval':
    default:
      return smoothstep(1 + f * 2, 1 - f * 2, du * du + dv * dv);
  }
}

/** The image feathered to transparency (no hard frame); an optional shape
 *  punches a scene-specific silhouette into the alpha. */
function featherImage(img, shape, box) {
  const w = Math.min(1024, img.width);
  const h = Math.round(w * (img.height / img.width));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  if (shape) {
    // Per-pixel silhouette alpha so the photo shows in the scene's shape.
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const idx = (y * w + x) * 4 + 3;
        d[idx] = Math.round(d[idx] * shapeAlpha(x / w, y / h, shape, box));
      }
    }
    ctx.putImageData(id, 0, 0);
    return canvas;
  }
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(w / 2, h / 2);
  ctx.scale(w / 2, h / 2);
  const grad = ctx.createRadialGradient(0, 0, 0.55, 0, 0, 1);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-1, -1, 2, 2);
  return canvas;
}
