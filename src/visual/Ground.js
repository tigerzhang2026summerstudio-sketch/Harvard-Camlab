/**
 * Ground — the crystalline beryl floor across the bottom of the panorama.
 *
 * In the sutra the meditator sees water, then ice, then a ground of beryl:
 * here a bed of dormant motes "freezes into being" bottom-up as Act 1's
 * fullness meter rises (uReveal). While forming it shimmers like water;
 * as it completes, the twinkle calms to a still, icy glitter. A persistent
 * layer — unlike key bursts, these particles never die.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPPWU;
  uniform float uReveal; // 0..1 — Act 1 ground fullness

  attribute float aThreshold; // this mote appears when uReveal passes it
  attribute float aSeed;
  attribute float aSize;
  attribute vec3  aColor;

  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    // Freeze bottom-up: each mote fades in as the meter crosses its threshold.
    float vis = smoothstep(aThreshold - 0.12, aThreshold, uReveal);
    if (vis <= 0.001) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vColor = vec3(0.0); vAlpha = 0.0;
      return;
    }

    // Water-shimmer while forming; near-still ice once the ground is set.
    float w = aSeed * 6.2831853;
    float calm = mix(0.5, 0.12, uReveal);
    float twinkle = 1.0 - calm + calm * sin(uTime * ${config.ground.twinkleSpeed.toFixed(2)} + w * 9.0);

    vec3 pos = position;
    pos.x += sin(uTime * 0.11 + w * 5.0) * 1.5 * (1.0 - uReveal); // faint water sway

    vColor = aColor;
    vAlpha = vis * (0.35 + 0.65 * twinkle);
    gl_PointSize = aSize * uPPWU * (0.8 + 0.4 * vis);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uIntensity;
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float core = smoothstep(0.5, 0.08, d);
    if (core <= 0.001) discard;
    gl_FragColor = vec4(vColor * uIntensity * (0.7 + 0.5 * core * core), vAlpha * core);
  }
`;

export class Ground {
  constructor(scene) {
    const g = config.ground;
    const qs = config.qualityScale[config.quality];
    const count = Math.floor(g.count * Math.max(qs.particleScale, 0.25));

    const beryl = new THREE.Color(config.palette.beryl);
    const lapis = new THREE.Color(config.palette.lapis);
    const gold = new THREE.Color(config.palette.gold);
    const tint = new THREE.Color();

    const pos = new Float32Array(count * 3);
    const color = new Float32Array(count * 3);
    const threshold = new Float32Array(count);
    const seed = new Float32Array(count);
    const size = new Float32Array(count);

    const H = config.worldHeight;
    const halfW = config.worldWidth / 2;
    const band = g.bandFrac * H;

    for (let i = 0; i < count; i += 1) {
      // Denser toward the very bottom; yFrac 0 = bottom edge of the band.
      const yFrac = Math.random() ** 1.7;
      pos[i * 3] = (Math.random() * 2 - 1) * halfW;
      pos[i * 3 + 1] = -H / 2 + yFrac * band;
      pos[i * 3 + 2] = 0;

      // Bottom rows freeze first, with scatter so the edge stays organic.
      // Floor of 0.14 keeps every mote fully dark at reveal 0 (fade width 0.12).
      threshold[i] = Math.min(1, 0.14 + yFrac * 0.66 + Math.random() * 0.2);

      if (Math.random() < g.goldFrac) tint.copy(gold);
      else tint.lerpColors(lapis, beryl, Math.random());
      const v = 0.7 + Math.random() * 0.5;
      color[i * 3] = tint.r * v;
      color[i * 3 + 1] = tint.g * v;
      color[i * 3 + 2] = tint.b * v;

      seed[i] = Math.random();
      size[i] = g.sizeMin + Math.random() * (g.sizeMax - g.sizeMin);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    geo.setAttribute('aThreshold', new THREE.BufferAttribute(threshold, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.uniforms = {
      uTime: { value: 0 },
      uPPWU: { value: 1 },
      uReveal: { value: 0 },
      uIntensity: { value: g.intensity },
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
    scene.add(this.points);

    this.reveal = 0; // smoothed so the freeze advances gently, never steps
  }

  /** fullnessTarget comes from StateManager (Act 1 meter, stays 1 after). */
  update(time, ppwu, fullnessTarget, dt) {
    this.reveal += (fullnessTarget - this.reveal) * Math.min(1, dt * 0.8);
    this.uniforms.uTime.value = time;
    this.uniforms.uPPWU.value = ppwu;
    this.uniforms.uReveal.value = this.reveal;
  }
}
