/**
 * GrowthLayer — the shared machinery behind every persistent Act-2 layer
 * (trees, ponds, instruments): a static THREE.Points whose motes appear as
 * a growth value (a knob) passes each point's stage, sway in the wind, and
 * respond to the global refinement knobs (warmth, density, sway speed).
 *
 * A layer is defined only by its geometry: the constructor receives a
 * builder function which calls add(...) once per point. Everything after
 * that — reveal, motion, tinting — is this one shader.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPPWU;
  uniform float uGrowth;    // the layer's knob, smoothed (0..1)
  uniform float uDensity;   // K6
  uniform float uSwaySpeed; // K8
  uniform float uWindAmp;   // K4 (adds to each point's own sway)

  attribute vec3  aColor;
  attribute float aSize;
  attribute float aStage; // point appears when uGrowth passes this
  attribute float aSway;  // world units of wander (leaves > trunks)
  attribute float aSeed;
  attribute float aPhase; // extra phase (pond ripples travel outward)

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    // Remap stages above the fade width so stage-0 points are still fully
    // dark at growth 0 (smoothstep with edge0 < 0 would leak them in).
    float s = 0.17 + aStage * 0.83;
    float vis = smoothstep(s - 0.15, s, uGrowth);
    if (vis <= 0.001) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0; vColor = vec3(0.0); vAlpha = 0.0;
      return;
    }

    float w = aSeed * 6.2831853;
    float t = uTime * uSwaySpeed;
    float amp = aSway * (0.45 + uWindAmp);
    vec3 pos = position;
    pos.x += sin(t * 0.6 + w * 4.0) * amp;
    pos.y += cos(t * 0.5 + w * 7.0) * amp * 0.35;

    // Slow breathing shimmer; aPhase lets ponds run travelling ripples.
    float tw = 0.72 + 0.28 * sin(t * 1.25 + aPhase + w);

    vColor = aColor;
    vAlpha = vis * tw * min(uDensity, 1.0);
    gl_PointSize = aSize * uPPWU * (0.5 + 0.5 * vis) * clamp(uDensity, 0.8, 1.1);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uWarmth;    // K5: cool beryl ↔ warm gold cast
  uniform float uIntensity;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float core = smoothstep(0.5, 0.08, d);
    if (core <= 0.001) discard;
    // "cast" is a reserved word in GLSL — hence "tint".
    vec3 tint = mix(vec3(0.88, 0.96, 1.14), vec3(1.14, 1.0, 0.84), uWarmth);
    vec3 col = vColor * tint * uIntensity * (0.7 + 0.5 * core * core);
    gl_FragColor = vec4(col, vAlpha * core);
  }
`;

export class GrowthLayer {
  /**
   * build(add) is called once; add(x, y, size, color, stage, sway, phase)
   * registers one point (color may exceed 1.0 for bloom-hot points).
   */
  constructor(parent, build, { intensity = 1.0 } = {}) {
    const pos = []; const color = []; const size = [];
    const stage = []; const sway = []; const seed = []; const phase = [];

    const add = (x, y, sz, col, stg, sw = 1, ph = 0) => {
      pos.push(x, y, 0);
      color.push(col.r, col.g, col.b);
      size.push(sz);
      stage.push(stg);
      sway.push(sw);
      seed.push(Math.random());
      phase.push(ph);
    };
    build(add);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(color), 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(size), 1));
    geo.setAttribute('aStage', new THREE.BufferAttribute(new Float32Array(stage), 1));
    geo.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(sway), 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(seed), 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(phase), 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.uniforms = {
      uTime: { value: 0 },
      uPPWU: { value: 1 },
      uGrowth: { value: 0 },
      uDensity: { value: 1 },
      uSwaySpeed: { value: 1 },
      uWindAmp: { value: 0 },
      uWarmth: { value: config.act2.refine.warmthDefault },
      uIntensity: { value: intensity },
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
  }

  /** Push the shared per-frame values; growth is this layer's own knob. */
  update({ time, ppwu, wind, sway, warmth, density }, growth) {
    const u = this.uniforms;
    u.uTime.value = time;
    u.uPPWU.value = ppwu;
    u.uGrowth.value = growth;
    u.uWindAmp.value = wind;
    u.uSwaySpeed.value = sway;
    u.uWarmth.value = warmth;
    u.uDensity.value = density;
  }
}
