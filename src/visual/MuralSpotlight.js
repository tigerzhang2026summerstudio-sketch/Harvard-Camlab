/**
 * MuralSpotlight — the real Cave 217 north wall DEPICTS the sixteen
 * contemplations, so each 观 lights its own painted panel: a soft-edged
 * pool of light rises over that region of the photograph, holds while
 * the vision plays, and sinks back. Regions (UV fractions of the image,
 * v from the top) live in config.act3.muralRegions — tune them there.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec4  uSpot;     // u, v (from top), radius, strength
  uniform float uAspect;   // plane w/h — keeps the pool round on screen
  varying vec2 vUv;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    vec2 d = vec2((vUv.x - uSpot.x) * uAspect, (1.0 - vUv.y) - uSpot.y);
    float pool = smoothstep(uSpot.z, uSpot.z * 0.35, length(d));
    gl_FragColor = vec4(tex.rgb, 1.0) * pool * uSpot.w;
  }
`;

export class MuralSpotlight {
  constructor(parent) {
    this.ready = false;
    this.strength = 0;
    this.target = 0;
    this.holdLeft = 0;
    if (!config.backdrop.enabled) return;

    new THREE.TextureLoader().load(
      `/murals/${config.backdrop.image}`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const W = config.worldWidth;
        const H = config.worldHeight;
        this.uniforms = {
          uMap: { value: tex },
          uSpot: { value: new THREE.Vector4(0.5, 0.5, 0.1, 0) },
          uAspect: { value: W / H },
        };
        // Sized to the EXACT visible wall (unlike the oversized panning
        // backdrop) so every region of the image is reachable on screen.
        this.mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(W, H),
          new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: this.uniforms,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
          }),
        );
        this.mesh.position.z = -58; // just in front of the backdrop
        this.mesh.renderOrder = -1;
        parent.add(this.mesh);
        this.ready = true;
      },
      undefined,
      () => console.warn('[spotlight] backdrop image missing — spotlight off'),
    );
  }

  /** Light the panel painted for this story (if a region is mapped). */
  show(action, holdSec) {
    if (!this.ready) return;
    const r = config.act3.muralRegions[action];
    if (!r) { this.target = 0; return; }
    this.uniforms.uSpot.value.x = r[0];
    this.uniforms.uSpot.value.y = r[1];
    this.uniforms.uSpot.value.z = r[2];
    this.target = config.act3.spotlightOpacity;
    this.holdLeft = holdSec;
  }

  update(dt, phase) {
    if (!this.ready) return;
    if (phase !== 'act3') this.target = 0;
    else if (this.holdLeft > 0) {
      this.holdLeft -= dt;
      if (this.holdLeft <= 0) this.target = 0;
    }
    this.strength += (this.target - this.strength) * Math.min(1, dt * 1.1);
    this.uniforms.uSpot.value.w = this.strength;
  }
}
