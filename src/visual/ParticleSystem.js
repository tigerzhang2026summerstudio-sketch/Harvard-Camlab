/**
 * ParticleSystem — the core engine: one pooled THREE.Points with a custom
 * shader. The CPU only WRITES spawn data (origin, velocity, color, birth
 * time) into a ring buffer; every frame of motion, fading and sizing is
 * computed in the vertex shader from uTime. No per-particle JS ever runs
 * per frame, which is what makes 10⁵–10⁶ particles feasible.
 *
 * Usage:  ps.burst({ x, y, color, count, speed, ... })  from anywhere;
 *         ps.update(time, ppwu) once per frame.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPPWU;       // screen pixels per world unit (ortho camera)
  uniform float uSizeScale;  // artist knob: global particle size multiplier
  uniform float uStreak;     // comet-trail strength (world speed → tail length)

  attribute vec3  aOrigin;
  attribute vec3  aVelocity;
  attribute vec3  aColor;
  attribute float aSize;     // world units
  attribute float aBirth;    // uTime at spawn; negative = dead slot
  attribute float aLife;     // seconds
  attribute float aSeed;     // 0..1 per-particle randomness
  attribute float aGrav;     // per-particle gravity (world u/s²); 0 = weightless
  attribute float aStreak;   // per-particle comet-trail strength; 0 = round mote

  varying vec3  vColor;
  varying float vAlpha;
  varying vec2  vDir;        // screen-space motion direction (for the trail)
  varying float vStreak;     // 0..1 tail elongation

  void main() {
    float age = uTime - aBirth;
    if (aLife <= 0.0 || age < 0.0 || age >= aLife) {
      // Dead slot: throw the vertex outside the clip volume, costs nothing.
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vColor = vec3(0.0);
      vAlpha = 0.0;
      return;
    }

    float t = age / aLife;

    // Analytic drag integration: velocity decays, position converges —
    // a burst blooms outward fast then hangs in the air like seed-down.
    float drag = 1.8;
    vec3 pos = aOrigin + aVelocity * (1.0 - exp(-drag * age)) / drag;
    // Gravity arc (fireworks rise then fall) — per particle, so weightless
    // scenes (murals, settled motes) are untouched.
    pos.y -= 0.5 * aGrav * age * age;

    // Buoyant lift + seeded wander so settled motes keep drifting gently.
    float w = aSeed * 6.2831853;
    float lift = age * 14.0 * (0.3 + 0.7 * fract(aSeed * 7.31)) * (aGrav > 0.0 ? 0.0 : 1.0);
    pos.x += sin(age * 0.9 + w * 3.0) * 6.0 * t;
    pos.y += lift + cos(age * 0.7 + w * 5.0) * 4.0 * t;

    float fadeIn  = smoothstep(0.0, 0.12, t);
    float fadeOut = 1.0 - smoothstep(0.55, 1.0, t);
    vAlpha = fadeIn * fadeOut;
    vColor = aColor;

    // Instantaneous velocity → the comet trail streaks along it, longer
    // the faster the mote is moving, tapering to a round dot as it slows.
    vec3 vinst = aVelocity * exp(-drag * age);
    vinst.y -= aGrav * age;
    vec4 vClip = projectionMatrix * modelViewMatrix * vec4(vinst, 0.0);
    vDir = length(vClip.xy) > 1e-5 ? normalize(vClip.xy) * vec2(1.0, -1.0) : vec2(0.0, 1.0);
    vStreak = clamp(length(vinst.xy) * aStreak, 0.0, 1.0) * fadeOut;

    gl_PointSize = aSize * uPPWU * uSizeScale
                 * (0.7 + 0.5 * fadeIn) * (1.0 - 0.35 * t)
                 * (1.0 + vStreak * 1.6);   // room for the tail

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uIntensity; // >1 pushes cores past 1.0 so bloom catches them

  varying vec3  vColor;
  varying float vAlpha;
  varying vec2  vDir;
  varying float vStreak;

  void main() {
    // Comet shape: stretch the mote BACKWARD along its motion (the tail),
    // fading toward the far end. vStreak 0 → a plain round mote.
    vec2 p = gl_PointCoord - 0.5;
    float along = dot(p, vDir);                       // + toward the head
    float perp  = dot(p, vec2(-vDir.y, vDir.x));
    float k = 1.0 + vStreak * 3.2;                    // tail elongation
    float a = along < 0.0 ? along / k : along;        // compress the tail
    float d = length(vec2(a, perp));
    float core = smoothstep(0.5, 0.04, d);            // soft head + tail
    float tail = along < 0.0 ? clamp(1.0 + along / 0.5, 0.0, 1.0) : 1.0;
    core *= mix(1.0, tail, vStreak);
    if (core <= 0.001) discard;
    float hot = core * core;                          // brighter center
    vec3 col = vColor * uIntensity * (0.65 + 0.6 * hot);
    // LUMA KEY: the dimmer a mote's own light, the more transparent it
    // is — so faint halos drop out and the mural behind reads through,
    // while bright cores stay full. (Additive: less alpha = less wash.)
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    float key = mix(0.5, 1.0, smoothstep(0.02, 0.4, luma));
    gl_FragColor = vec4(col, vAlpha * core * key);
  }
`;

export class ParticleSystem {
  constructor(scene) {
    const qs = config.qualityScale[config.quality];
    this.capacity = Math.floor(config.particles.maxCount * qs.particleScale);
    this.cursor = 0; // ring-buffer write head

    const geo = new THREE.BufferGeometry();
    const cap = this.capacity;
    this.attrs = {
      aOrigin:   new THREE.BufferAttribute(new Float32Array(cap * 3), 3),
      aVelocity: new THREE.BufferAttribute(new Float32Array(cap * 3), 3),
      aColor:    new THREE.BufferAttribute(new Float32Array(cap * 3), 3),
      aSize:     new THREE.BufferAttribute(new Float32Array(cap), 1),
      aBirth:    new THREE.BufferAttribute(new Float32Array(cap).fill(-1), 1),
      aLife:     new THREE.BufferAttribute(new Float32Array(cap), 1),
      aSeed:     new THREE.BufferAttribute(new Float32Array(cap), 1),
      aGrav:     new THREE.BufferAttribute(new Float32Array(cap), 1),
      aStreak:   new THREE.BufferAttribute(new Float32Array(cap), 1),
    };
    for (const [name, attr] of Object.entries(this.attrs)) {
      attr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, attr);
    }
    // Three needs a 'position' attribute to compute draw count; alias origin.
    geo.setAttribute('position', this.attrs.aOrigin);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6); // never cull

    this.uniforms = {
      uTime:      { value: 0 },
      uPPWU:      { value: 1 },
      uSizeScale: { value: 1 },
      uIntensity: { value: config.particles.intensity },
      uStreak:    { value: config.particles.streak ?? 0.006 },
    };

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending, // light adds to light; black stays black
      depthWrite: false,
      depthTest: false,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    this.time = 0;
    this.scratchColor = new THREE.Color();
    this.spawnScale = 1; // K6 density knob scales every burst's count
  }

  /** Once per frame. ppwu = renderer pixels per world unit (for point size). */
  update(time, ppwu) {
    this.time = time;
    this.uniforms.uTime.value = time;
    this.uniforms.uPPWU.value = ppwu;
  }

  /**
   * Spawn a radial bloom of particles.
   * { x, y, color, count, speed, size, life, upBias, spread, jitter,
   *   driftX, driftY,      — drift adds a shared directional velocity
   *   swirl,               — tangential fraction: the burst rotates/spirals
   *   minSpeedFrac }       — 0.25 = filled bloom · ~0.9 = expanding ring
   * color: THREE.Color (or anything THREE.Color accepts). speed/size/life
   * are means; each particle randomizes around them.
   */
  burst({
    x = 0, y = 0, color = '#ffffff', count = 500,
    speed = 120, size = 4, life = 2.4, upBias = 0.3,
    spread = 1, jitter = 8, driftX = 0, driftY = 0,
    swirl = 0, minSpeedFrac = 0.25, gravity = 0, streak = 0,
  }) {
    const c = this.scratchColor.set(color);
    const { aOrigin, aVelocity, aColor, aSize, aBirth, aLife, aSeed, aGrav, aStreak } = this.attrs;
    const n = Math.min(Math.round(count * this.spawnScale), this.capacity);
    const start = this.cursor;

    for (let k = 0; k < n; k += 1) {
      const i = (start + k) % this.capacity;
      const i3 = i * 3;

      aOrigin.array[i3]     = x + (Math.random() - 0.5) * jitter * 2;
      aOrigin.array[i3 + 1] = y + (Math.random() - 0.5) * jitter * 2;
      aOrigin.array[i3 + 2] = 0;

      // Radial direction (+ optional tangential swirl), biased upward.
      const ang = Math.random() * Math.PI * 2;
      const r = (minSpeedFrac + (1 - minSpeedFrac) * Math.random() ** 1.5) * speed * spread;
      const cos = Math.cos(ang); const sin = Math.sin(ang);
      aVelocity.array[i3]     = (cos - sin * swirl) * r + driftX;
      aVelocity.array[i3 + 1] = (sin + cos * swirl) * r + speed * upBias * Math.random() + driftY;
      aVelocity.array[i3 + 2] = 0;

      // Slight per-particle tint drift keeps large bursts from looking flat.
      const v = 0.85 + Math.random() * 0.3;
      aColor.array[i3]     = c.r * v;
      aColor.array[i3 + 1] = c.g * v;
      aColor.array[i3 + 2] = c.b * v;

      aSize.array[i]  = size * (0.5 + Math.random());
      aBirth.array[i] = this.time;
      aLife.array[i]  = life * (0.6 + 0.8 * Math.random());
      aSeed.array[i]  = Math.random();
      aGrav.array[i]  = gravity * (0.8 + 0.4 * Math.random());
      aStreak.array[i] = streak;
    }

    this.markUpdated(start, n);
    this.cursor = (start + n) % this.capacity;
    return n;
  }

  /**
   * Spawn particles that CONVERGE onto explicit target points instead of
   * flying apart — the combo 图案 and the ember-formed sutra text.
   * No shader changes needed: velocity integrates with drag toward an
   * asymptote of v/drag, so a mote spawned at (target − v/drag) drifts in
   * and settles exactly on its target as it slows.
   *
   * pts: array of { x, y, col? } — offsets (world units) around x/y;
   * col is an optional per-point THREE.Color (else `color` is used).
   * scatter: how far the embers gather in from. stagger: birth spread (s).
   */
  settle({
    pts, x = 0, y = 0, color = '#ffffff', size = 2.6, life = 5,
    scatter = 160, stagger = 0.9,
  }) {
    const DRAG = 1.8; // must match the vertex shader's drag constant
    const base = this.scratchColor.set(color);
    const { aOrigin, aVelocity, aColor, aSize, aBirth, aLife, aSeed, aGrav, aStreak } = this.attrs;
    const n = Math.min(
      Math.round(pts.length * Math.min(1, this.spawnScale)),
      this.capacity,
    );
    if (n <= 0) return 0;
    const stride = pts.length / n;
    const start = this.cursor;

    for (let k = 0; k < n; k += 1) {
      const p = pts[Math.min(pts.length - 1, Math.floor(k * stride))];
      const i = (start + k) % this.capacity;
      const i3 = i * 3;

      const tx = x + p.x;
      const ty = y + p.y;
      const ang = Math.random() * Math.PI * 2;
      const m = scatter * (0.3 + 0.7 * Math.random());
      aOrigin.array[i3]     = tx - Math.cos(ang) * m;
      aOrigin.array[i3 + 1] = ty - Math.sin(ang) * m;
      aOrigin.array[i3 + 2] = 0;
      aVelocity.array[i3]     = Math.cos(ang) * m * DRAG;
      aVelocity.array[i3 + 1] = Math.sin(ang) * m * DRAG;
      aVelocity.array[i3 + 2] = 0;

      const c = p.col ?? base;
      const v = 0.92 + Math.random() * 0.16;
      aColor.array[i3]     = c.r * v;
      aColor.array[i3 + 1] = c.g * v;
      aColor.array[i3 + 2] = c.b * v;

      aSize.array[i]  = size * (0.65 + 0.7 * Math.random());
      aBirth.array[i] = this.time + Math.random() * stagger;
      aLife.array[i]  = life * (0.85 + 0.3 * Math.random());
      aSeed.array[i]  = Math.random();
      aGrav.array[i]  = 0; // settled forms are weightless — no gravity arc
      aStreak.array[i] = 0; // settled forms are round motes — no trail
    }

    this.markUpdated(start, n);
    this.cursor = (start + n) % this.capacity;
    return n;
  }

  /** Push only the written spans to the GPU (ring buffer may wrap → 2 spans). */
  markUpdated(start, n) {
    const spans = start + n <= this.capacity
      ? [[start, n]]
      : [[start, this.capacity - start], [0, (start + n) % this.capacity]];
    for (const attr of Object.values(this.attrs)) {
      for (const [s, len] of spans) {
        attr.addUpdateRange(s * attr.itemSize, len * attr.itemSize);
      }
      attr.needsUpdate = true;
    }
  }
}
