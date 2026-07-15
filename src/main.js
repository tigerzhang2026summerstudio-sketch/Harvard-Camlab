/**
 * main.js — bootstrap only.
 *
 * Owns: renderer, camera, resize handling, the render loop, and the few
 * global key toggles that belong to the shell (F = fullscreen).
 * Everything artistic lives in /visual, /audio, /ui modules (later steps).
 */
import * as THREE from 'three';
import { config } from './config/config.js';
import { MidiManager } from './core/MidiManager.js';
import { DebugOverlay } from './ui/DebugOverlay.js';

// ── Renderer ──────────────────────────────────────────────────────────
const canvas = document.getElementById('app-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,           // particles + bloom don't need MSAA
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.maxPixelRatio));
renderer.setClearColor(new THREE.Color(config.palette.background), 1);

// ── Scene & camera ────────────────────────────────────────────────────
// Orthographic camera over a fixed-height world: the panorama always shows
// the full worldHeight; horizontal extent follows the screen's aspect so a
// 5760×1080 wall simply reveals more of the same world (config-only change).
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);

function layoutCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const halfH = config.worldHeight / 2;
  const halfW = halfH * aspect;
  camera.left = -halfW;
  camera.right = halfW;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  layoutCamera();
}
window.addEventListener('resize', onResize);
onResize();

// ── Temporary boot beacon ─────────────────────────────────────────────
// A single faint breathing mote at center proves the loop, additive
// blending, and world coordinates work before the particle engine exists.
// It foreshadows Vaidehī's thread of light; replaced in later steps.
const beaconMat = new THREE.PointsMaterial({
  color: new THREE.Color(config.palette.white),
  size: 6,
  transparent: true,
  opacity: 0.0,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const beaconGeo = new THREE.BufferGeometry();
beaconGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, -config.worldHeight * 0.15, 0], 3));
const beacon = new THREE.Points(beaconGeo, beaconMat);
scene.add(beacon);

// ── Input (Step 2): MIDI + keyboard fallback + monitor ────────────────
const midi = new MidiManager();
const overlay = new DebugOverlay(midi);
midi.init();

// Until the particle engine lands (Step 3), prove the input path visually:
// every key strike kicks the beacon's brightness, scaled by velocity, and
// decays smoothly (no hard flicker — seizure safety).
let strikePulse = 0;
midi.on('key', (e) => { if (e.on) strikePulse = Math.min(1.5, strikePulse + e.velocity); });
midi.on('pad', (e) => { if (e.on) strikePulse = Math.min(1.5, strikePulse + 0.8); });

// ── Main loop ─────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let elapsed = 0;

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  elapsed += dt;
  overlay.tick(dt);

  // Slow breathing pulse — smooth fade, never a flicker (seizure safety).
  strikePulse *= Math.exp(-dt * 3);
  beaconMat.opacity = 0.25 + 0.2 * Math.sin(elapsed * 0.8) + 0.55 * strikePulse;

  renderer.render(scene, camera);
});

// ── Shell key toggles ─────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
});

// ── Cursor auto-hide (show mode) ──────────────────────────────────────
let cursorTimer = null;
function pokeCursor() {
  document.body.classList.remove('hide-cursor');
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(
    () => document.body.classList.add('hide-cursor'),
    config.cursorHideDelayMs,
  );
}
window.addEventListener('mousemove', pokeCursor);
pokeCursor();

console.info('[painted-cave] renderer up —', renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1');
