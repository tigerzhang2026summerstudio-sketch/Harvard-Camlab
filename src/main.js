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
import { StateManager } from './core/StateManager.js';
import { DebugOverlay } from './ui/DebugOverlay.js';
import { ParticleSystem } from './visual/ParticleSystem.js';
import { Postprocessing } from './visual/Postprocessing.js';
import { Ground } from './visual/Ground.js';
import { Act1 } from './visual/Act1.js';
import { Act2 } from './visual/Act2.js';
import { Act3 } from './visual/Act3.js';
import { VaidehiFigure } from './visual/VaidehiFigure.js';
import { AudioManager } from './audio/AudioManager.js';
import { Transitions } from './visual/Transitions.js';
import { Tutorial } from './ui/Tutorial.js';
import { Captions } from './ui/Captions.js';

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

// ── Visual engine ─────────────────────────────────────────────────────
// Everything that belongs to the paradise lives in worldGroup, so the
// wind knob can sway the whole vision like a slowly turning mandala.
const worldGroup = new THREE.Group();
scene.add(worldGroup);

const particles = new ParticleSystem(worldGroup);
const ground = new Ground(worldGroup);
const post = new Postprocessing(renderer, scene, camera);

// Screen pixels per world unit — keeps particle sizes proportional when
// the window (or projector wall) changes.
function pixelsPerWorldUnit() {
  return (window.innerHeight * renderer.getPixelRatio()) / config.worldHeight;
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  layoutCamera();
  post.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);
onResize();

// ── Input → state machine ─────────────────────────────────────────────
// MidiManager normalizes the hardware; StateManager owns the arc and
// routes events to whichever act is alive; visuals subscribe to the state.
const midi = new MidiManager();
const state = new StateManager();
const overlay = new DebugOverlay(midi, state);
midi.init();

midi.on('key', (e) => state.onKey(e));
midi.on('knob', (e) => state.onKnob(e));
midi.on('pad', (e) => state.onPad(e));

// ── Acts ──────────────────────────────────────────────────────────────
// Act 1 (blooms, chord mandalas) listens to routed key events; the ground
// freezes with the state's fullness meter. The tutorial rides the phase.
const act1 = new Act1(particles);
state.on('key', (e) => act1.onKey(e));

// Act 2 (knob-grown layers + refinements) reads K1–K4 continuously from
// the state and K5–K8 as events; the joystick steers the wind.
const act2 = new Act2(worldGroup, state, particles, post);
state.on('knob', (e) => act2.onKnob(e));
midi.on('joystick', (e) => act2.onJoystick(e));

// Vaidehī kneels in the scene from the very first darkness; Act 3 raises
// the throne, assembles the holy figures, and answers the pads.
const vaidehi = new VaidehiFigure(worldGroup, particles);
const act3 = new Act3(worldGroup, state, particles, post, vaidehi);
state.on('pad', (e) => act3.onPad(e));

const tutorial = new Tutorial(state, midi);
const captions = new Captions(state, midi);
const transitions = new Transitions(state, particles, post);

// Audio: score crossfades + accents. The browser only allows sound after
// a real gesture, so the first click/keypress unlocks it (MIDI can't).
const audio = new AudioManager(state);
window.addEventListener('pointerdown', () => audio.unlock());
window.addEventListener('keydown', () => audio.unlock());

// ── Main loop ─────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let elapsed = 0;

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  elapsed += dt;
  state.update(dt);
  overlay.tick(dt);

  const ppwu = pixelsPerWorldUnit();
  particles.update(elapsed, ppwu);

  // The coda melts the beryl ground away along with everything else.
  const codaFade = state.phase === 'coda'
    ? Math.max(0, 1 - state.phaseTime / config.acts.codaFadeSec)
    : 1;
  ground.update(elapsed, ppwu, state.fullness * codaFade, dt);

  const shared = act2.update(elapsed, dt, ppwu);
  act3.update(elapsed, dt, ppwu, shared);
  vaidehi.update(elapsed, dt, ppwu);
  transitions.update(dt);
  post.render();
});

// Dev-only handle for debugging from the browser console (also lets tests
// drive frames manually where requestAnimationFrame is throttled).
if (import.meta.env.DEV) {
  window.__paintedCave = {
    midi, state, particles, post, ground, act1, act2, act3, vaidehi,
    tutorial, captions, transitions, audio, renderer,
    keyBurst: (note, velocity) => act1.onKey({ on: true, note, velocity }),
    now: () => elapsed,
    ppwu: pixelsPerWorldUnit,
  };
}

// ── Shell key toggles ─────────────────────────────────────────────────
// While keyboard-play is on, bare letters are notes (R is one) — the
// toggles then require Shift, same rule as the overlay panels.
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (midi.fallbackActive && !e.shiftKey) return;
  const k = e.key.toLowerCase();
  if (k === 'f') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
  if (k === 'r') state.reset();
  if (k === 'a') {
    const on = state.toggleAuto();
    console.info(`[painted-cave] attract mode ${on ? 'armed' : 'off'}`);
  }
  // e.code: Shift+0 types ')' but the physical key is still Digit0.
  if (k === '0' || e.code === 'Digit0') {
    console.info(`[painted-cave] audio ${audio.toggleMute() ? 'muted' : 'unmuted'}`);
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
