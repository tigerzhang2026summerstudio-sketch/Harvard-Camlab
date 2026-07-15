/**
 * Postprocessing — UnrealBloom (the glow that makes particles read as
 * light) + a subtle vignette. Strong but SMOOTH: bloom parameters never
 * jump per-frame, so there is no flicker (seizure-safety requirement).
 * Threshold stays high enough that pure black stays pure black.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { config } from '../config/config.js';

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: 0.28 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      // Gentle radial darkening toward the frame edge — draws the eye in.
      float d = distance(vUv, vec2(0.5)) * 1.4142;
      c.rgb *= 1.0 - uStrength * smoothstep(0.55, 1.0, d);
      gl_FragColor = c;
    }
  `,
};

export class Postprocessing {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = config.qualityScale[config.quality].bloom;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      config.bloom.strength,
      config.bloom.radius,
      config.bloom.threshold,
    );
    this.composer.addPass(this.bloom);

    this.vignette = new ShaderPass(VignetteShader);
    this.composer.addPass(this.vignette);
    this.composer.addPass(new OutputPass());

    this.setSize(window.innerWidth, window.innerHeight);
  }

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.composer.setPixelRatio(Math.min(window.devicePixelRatio, config.maxPixelRatio));
  }

  /** Live control hook — K7 "bloom strength" refinement knob (Act 2). */
  setBloomStrength(v) { this.bloom.strength = v; }

  render() {
    if (this.enabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
