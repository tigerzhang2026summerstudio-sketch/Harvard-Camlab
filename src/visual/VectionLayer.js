/**
 * VectionLayer — the near-field motes that SELL the flight (intro step 3).
 *
 * Peripheral optical flow is the strongest self-motion cue there is:
 * faint dust/sand/ice streaking past the camera convinces the body it
 * is moving long before anything in the distance does. This layer is a
 * field of world-anchored motes around the camera, drawn as short line
 * segments whose trailing ends stretch along the camera's velocity —
 * so streak length scales with speed for free, and a hanging camera
 * (beat 1) sees only still dust.
 *
 * The field is INFINITE at zero CPU cost: each mote's home position is
 * wrapped into a camera-centered box in the vertex shader
 * (mod(seed - camPos, box) - box/2), so flying forward forever never
 * exhausts it and nothing is ever respawned on the CPU. Edge + near
 * fades hide the wrap seams. Per spec, density thins with altitude
 * (ground rush) and the palette cools from sand-gold low to ice-blue
 * high; indoors the speed factor collapses and the survivors read as
 * drifting incense motes.
 *
 * Felt more than seen: keep opacity low (config.intro.vection).
 */
import * as THREE from 'three';
import { config } from '../config/config.js';

const rawSrgb = (hex) => {
  const c = parseInt(hex.replace('#', ''), 16);
  return new THREE.Vector3(
    ((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255,
  );
};

export class VectionLayer {
  constructor(scene) {
    const v = config.intro.vection;
    const count = v.count;

    // Two vertices per mote (head + tail), both at the seed position;
    // the shader pushes the tail back along the velocity.
    const seeds = new Float32Array(count * 2 * 3);
    const side = new Float32Array(count * 2);
    const rand = new Float32Array(count * 2);
    for (let i = 0; i < count; i += 1) {
      const x = Math.random() * v.box[0];
      const y = Math.random() * v.box[1];
      const z = Math.random() * v.box[2];
      const r = Math.random();
      for (let k = 0; k < 2; k += 1) {
        const j = (i * 2 + k) * 3;
        seeds[j] = x;
        seeds[j + 1] = y;
        seeds[j + 2] = z;
        side[i * 2 + k] = k;
        rand[i * 2 + k] = r;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(seeds, 3)); // seed home
    geo.setAttribute('side', new THREE.BufferAttribute(side, 1));
    geo.setAttribute('rand', new THREE.BufferAttribute(rand, 1));
    // The field surrounds the camera at all times — never cull it.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        camPos: { value: new THREE.Vector3() },
        velWorld: { value: new THREE.Vector3() },
        boxSize: { value: new THREE.Vector3(...v.box) },
        streakSec: { value: v.streakSec },
        baseOpacity: { value: v.opacity },
        speedFac: { value: 0 },   // 0 still … 1 full flight
        altFac: { value: 1 },     // 1 ground rush … low = thin high air
        // Raw sRGB (not THREE.Color — that would linearize, and this
        // shader writes gl_FragColor without a linear→sRGB pass).
        colorLow: { value: rawSrgb(v.colorLow) },
        colorHigh: { value: rawSrgb(v.colorHigh) },
      },
      vertexShader: /* glsl */ `
        attribute float side;
        attribute float rand;
        uniform vec3 camPos;
        uniform vec3 velWorld;
        uniform vec3 boxSize;
        uniform float streakSec;
        uniform float baseOpacity;
        uniform float speedFac;
        uniform float altFac;
        varying float vAlpha;
        varying float vRand;

        void main() {
          // Infinite wrap: this mote's nearest image in a camera box.
          vec3 rel = mod(position - camPos, boxSize) - 0.5 * boxSize;
          vec3 world = camPos + rel;
          // The tail trails along the motion (apparent streak).
          if (side > 0.5) world -= velWorld * streakSec;

          // Hide the wrap seams and the lens: fade at box edges + near.
          vec3 e = abs(rel) / (0.5 * boxSize);
          float fade = smoothstep(1.0, 0.72, e.x)
                     * smoothstep(1.0, 0.72, e.y)
                     * smoothstep(1.0, 0.85, e.z);
          fade *= smoothstep(7.0, 32.0, length(rel));

          // Faint at rest, present in flight; thinner in the high air;
          // the tail end dies out (streaks fade along their length).
          float body = mix(0.25, 1.0, speedFac) * altFac;
          float tail = side > 0.5 ? 0.12 : 1.0;
          vAlpha = baseOpacity * fade * body * tail * (0.35 + 0.65 * rand);
          vRand = rand;
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 colorLow;
        uniform vec3 colorHigh;
        uniform float altFac;
        varying float vAlpha;
        varying float vRand;
        void main() {
          // Sand-gold near the ground, ice-blue in the high air.
          vec3 col = mix(colorHigh, colorLow, altFac * (0.7 + 0.3 * vRand));
          gl_FragColor = vec4(col, vAlpha);
        }
      `,
    });

    this.lines = new THREE.LineSegments(geo, this.material);
    this.lines.frustumCulled = false;
    scene.add(this.lines);
  }

  /**
   * Per frame from IntroFlight: camera position, world velocity
   * (units/sec, from the rail's derivative), and altitude above ground.
   */
  update(camPos, vel) {
    const v = config.intro.vection;
    const u = this.material.uniforms;
    u.camPos.value.copy(camPos);
    u.velWorld.value.copy(vel);
    const speed = vel.length();
    u.speedFac.value = Math.min(1, speed / v.fullSpeed);
    // Ground rush: densest skimming the dunes, thin in the night sky,
    // never fully gone (the high air keeps its ice crystals).
    u.altFac.value = Math.min(1, Math.max(v.altFloor,
      1.15 - Math.max(0, camPos.y) / v.altFadeHeight));
  }
}
