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

    const H = config.worldHeight;
    this.material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending, // light on black — never grays it
      depthWrite: false,
      depthTest: false,
    });
    // Height-oversized so the slow pan never shows an edge; the WIDTH is
    // set from the image's real aspect once it loads (no stretching —
    // matters on the 48:9 wall).
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(H * 1.35 * 1.4, H * 1.35),
      this.material,
    );
    this.mesh.position.z = -60;
    this.mesh.renderOrder = -1;
    this.mesh.visible = false;
    scene.add(this.mesh);

    this.tryVideo();
    this.buildEndMesh(scene);
  }

  /** Resize the wall plane to the loaded texture's true aspect. */
  sizeMesh(aspect) {
    const H = config.worldHeight * 1.35;
    this.mesh.geometry.dispose();
    this.mesh.geometry = new THREE.PlaneGeometry(H * aspect, H);
  }

  /**
   * THE ENDING's centerpiece: the vivid Pure-Land tableau on its own
   * plane — height-fit, centered, native aspect — revealed over the
   * epilogue while the faint wall breathes behind it.
   */
  buildEndMesh(scene) {
    const file = config.backdrop.endImage;
    if (!file) return;
    new THREE.TextureLoader().load(
      `/murals/${file}`,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const h = config.worldHeight * 0.96;
        const a = tex.image.width / tex.image.height;
        this.endMaterial = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          depthTest: false,
        });
        this.endMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(h * a, h),
          this.endMaterial,
        );
        this.endMesh.position.z = -57;
        this.endMesh.renderOrder = -1;
        scene.add(this.endMesh);
      },
      undefined,
      () => console.warn(`[backdrop] missing endImage ${file} — ending uses the wall`),
    );
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
      this.sizeMesh((video.videoWidth / video.videoHeight) || 16 / 9);
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
        this.sizeMesh(tex.image.width / tex.image.height);
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
    const phase = this.state.phase;
    let target = b.opacityByPhase[phase] ?? 0;

    // 若隐若现: during the acts the wall surfaces on its own clock —
    // a slow swell into faint visibility, then it sinks away again.
    if (phase === 'act1' || phase === 'act2' || phase === 'act3') {
      this.surfIn = (this.surfIn ?? b.surface.everySec * (0.3 + Math.random())) - dt;
      if (this.surfIn <= 0 && this.surfT === undefined) this.surfT = 0;
      if (this.surfT !== undefined) {
        this.surfT += dt;
        const f = this.surfT / b.surface.holdSec;
        if (f >= 1) {
          this.surfT = undefined;
          this.surfIn = b.surface.everySec * (0.6 + Math.random() * 0.8);
        } else {
          target = Math.max(target, b.surface.opacity * Math.sin(f * Math.PI));
        }
      }
    }

    // THE ENDING: the vivid tableau comes fully out over the epilogue
    // (its own centered plane; the faint wall stays breathing behind).
    if (this.endMaterial) {
      let env = 0;
      if (phase === 'epilogue') {
        const er = b.endReveal;
        const t = this.state.phaseTime - er.inAt;
        if (t > 0) {
          if (t < er.inSec) env = t / er.inSec;
          else if (t < er.inSec + er.holdSec) env = 1;
          else env = Math.max(0, 1 - (t - er.inSec - er.holdSec) / er.outSec);
        }
        env = env * env * (3 - 2 * env); // smooth both ends
      }
      this.endMaterial.opacity += (env * b.endReveal.opacity - this.endMaterial.opacity)
        * Math.min(1, dt * 1.2);
    } else if (phase === 'epilogue') {
      // no end image shipped — fall back to revealing the wall itself
      const er = b.endReveal;
      const t = this.state.phaseTime - er.inAt;
      let env = 0;
      if (t > 0) {
        if (t < er.inSec) env = t / er.inSec;
        else if (t < er.inSec + er.holdSec) env = 1;
        else env = Math.max(0, 1 - (t - er.inSec - er.holdSec) / er.outSec);
      }
      target = Math.max(target, er.opacity * env * env * (3 - 2 * env));
    }

    this.opacity += (target - this.opacity) * Math.min(1, dt * 0.9);
    this.material.opacity = clamp01(this.opacity);

    // The wall breathes: a slow drift and a slower swell.
    this.mesh.position.x = Math.sin(time * 0.021) * b.panAmount * config.worldWidth;
    const s = 1 + Math.sin(time * 0.013) * b.breatheAmount;
    this.mesh.scale.set(s, s, 1);
  }
}
