/**
 * Backdrop — the cave wall breathing behind the darkness. A very dim,
 * slowly drifting image of the real Cave 217 wall sits behind every
 * particle layer (additive, so pure black stays pure black). If a video
 * file exists at assets/video/<config.backdrop.video> it takes the
 * image's place — looping, muted, equally dim. The prologue keeps it
 * fully dark (the prison); each act lifts it a little further.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { clamp01 } from '../core/Clock.js';

export class Backdrop {
  constructor(scene, state) {
    this.state = state;
    this.opacity = 0;
    this.mesh = null;
    if (!config.backdrop.enabled) return;

    const W = config.worldWidth;
    const H = config.worldHeight;
    this.material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending, // light on black — never grays it
      depthWrite: false,
      depthTest: false,
    });
    // Oversized so the slow pan never shows an edge.
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 1.35, H * 1.35),
      this.material,
    );
    this.mesh.position.z = -60;
    this.mesh.renderOrder = -1;
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.tryVideo();
  }

  /** Prefer a video backdrop when the file exists; else the wall photo. */
  tryVideo() {
    const file = config.backdrop.video;
    if (!file) { this.loadImage(); return; }
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.oncanplay = () => {
      video.play().catch(() => { /* plays after the audio-unlock gesture */ });
      this.material.map = new THREE.VideoTexture(video);
      this.material.needsUpdate = true;
      this.mesh.visible = true;
      console.info(`[backdrop] video ${file}`);
    };
    video.onerror = () => {
      console.warn(`[backdrop] no video at /video/${file} — using the wall photo`);
      this.loadImage();
    };
    video.src = `/video/${file}`;
  }

  loadImage() {
    new THREE.TextureLoader().load(
      `/murals/${config.backdrop.image}`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.material.map = tex;
        this.material.needsUpdate = true;
        this.mesh.visible = true;
        console.info(`[backdrop] wall photo ${config.backdrop.image}`);
      },
      undefined,
      () => console.warn(`[backdrop] missing image ${config.backdrop.image} — backdrop off`),
    );
  }

  update(time, dt) {
    if (!this.mesh || !this.mesh.visible) return;
    const b = config.backdrop;
    const target = b.opacityByPhase[this.state.phase] ?? 0;
    this.opacity += (target - this.opacity) * Math.min(1, dt * 0.4);
    this.material.opacity = clamp01(this.opacity);

    // The wall breathes: a slow drift and a slower swell.
    this.mesh.position.x = Math.sin(time * 0.021) * b.panAmount * config.worldWidth;
    const s = 1 + Math.sin(time * 0.013) * b.breatheAmount;
    this.mesh.scale.set(s, s, 1);
  }
}
