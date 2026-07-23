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
import { OscManager } from './core/OscManager.js';
import { oscConfig } from './config/oscConfig.js';
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
import { Backdrop } from './visual/Backdrop.js';
import { StoryScenes } from './visual/StoryScenes.js';
import { DarkSpace } from './visual/DarkSpace.js';
import { Tutorial } from './ui/Tutorial.js';
import { Captions } from './ui/Captions.js';
import { Meditations } from './ui/Meditations.js';
import { IntroFlight } from './sequence/IntroFlight.js';

// ── Display adaptation ────────────────────────────────────────────────
// One 16:9 monitor or the Cave's three-projector 48:9 wall: the
// panorama's layout width follows the real display aspect at boot
// (never narrower than the 16:9 base). Move the window to the wall,
// fullscreen it across all three screens, and reload.
{
  // Fit the panorama to whatever display the browser is FULLSCREENED on
  // at load: the Cave's 5760×1080 (48:9) → 5760; a 16:9 monitor → ~1920,
  // so the whole composition is visible either way. (Guarded so a
  // zero-height boot can't poison every layout position with NaN; falls
  // back to the config's 5760.) Fullscreen first, then load/reload.
  const aspect = window.innerWidth / window.innerHeight;
  if (Number.isFinite(aspect) && aspect > 0.5) {
    config.worldWidth = Math.round(config.worldHeight * Math.min(aspect, 8));
  }
}

// Warm the bundled serifs so the particle-formed text (drawn to an
// offscreen canvas) has them ready rather than falling back.
if (document.fonts) {
  document.fonts.load('italic 56px "EB Garamond"');
  document.fonts.load('600 58px "EB Garamond"');
  document.fonts.load('500 170px "Noto Serif SC"');
}

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

// ── Self-running (demo / kiosk) ────────────────────────────────────────
// Play the whole arc by itself — the intro flight, then every act driven
// by synthetic input, looping forever. On via config.acts.autoRun (a
// permanent kiosk build) or the ?auto / ?demo URL param; `A` still
// toggles it live. Real hands always take over and pause it.
if (config.acts.autoRun || /[?&](auto|demo)\b/i.test(window.location.search)) {
  state.autoEnabled = true;
  console.info('[painted-cave] self-running mode ON — the piece plays itself, all the acts');
}

// ── Acts ──────────────────────────────────────────────────────────────
// Act 1 (blooms, chord mandalas) listens to routed key events; the ground
// freezes with the state's fullness meter. The tutorial rides the phase.
const act1 = new Act1(worldGroup, state, particles);
state.on('key', (e) => act1.onKey(e));

// The cave wall breathes dimly behind everything (image or video).
const backdrop = new Backdrop(scene, state);

// Act 2 (knob-grown layers + refinements) reads K1–K4 continuously from
// the state and K5–K8 as events; the joystick steers the wind.
const act2 = new Act2(worldGroup, state, particles, post);
state.on('knob', (e) => act2.onKnob(e));
midi.on('joystick', (e) => act2.onJoystick(e));

// OSC over WebSocket (the controller on WiFi → relay → browser). The
// controller sends raw MIDI at /midi/raw, which we hand to MidiManager
// so USB and WiFi decode through ONE routing map — its 'key'/'knob'/
// 'pad'/'joystick' events are already wired to the state above. The
// legacy semantic scheme (/pc/*) still emits directly, for non-MIDI
// senders. When OSC is live the computer-keyboard fallback is silenced.
const osc = new OscManager();
osc.onRawMidi = (status, d1, d2, channel) => midi.ingestOscMidi(status, d1, d2, channel);
osc.on('key', (e) => state.onKey(e));
osc.on('knob', (e) => state.onKnob(e));
osc.on('pad', (e) => state.onPad(e));
osc.on('joystick', (e) => act2.onJoystick(e));
osc.onLiveChange = (live) => {
  if (oscConfig.suppressKeyboardWhenLive) {
    midi.setFallback(live ? false : midi.devices.length === 0);
  }
  console.info(`[osc] ${live ? 'live' : 'disconnected'}`);
};
osc.init();

// Vaidehī kneels in the scene from the very first darkness; Act 3 raises
// the throne, assembles the holy figures, and answers the pads.
const vaidehi = new VaidehiFigure(worldGroup, particles);
const act3 = new Act3(worldGroup, state, particles, post, vaidehi);
state.on('pad', (e) => act3.onPad(e));

const tutorial = new Tutorial(state, midi);
const captions = new Captions(state, midi);
const transitions = new Transitions(state, particles, post);
// The knobs and pads each tell their contemplation through the captions,
// and the piece meditates aloud when left alone.
act1.captions = captions;
act2.captions = captions;
act3.captions = captions;
// Act 3's contemplations act on the world Act 2 grew: 第四观 makes the
// jeweled trees surge huge and settle; 第五观 blooms the ponds.
act3.treesLayer = act2.trees;
act3.pondsLayer = act2.ponds;
const meditations = new Meditations(state, captions);
// The flight into Cave 217 — the piece's front door, before the prologue.
const introFlight = new IntroFlight(state, captions);
// The narrated bookends: Vaidehī's prison story and the epilogue lotus.
const storyScenes = new StoryScenes(state, particles, captions);
// The black space itself is alive: dust, ink clouds, ghost murals,
// and faint ripples answering the keys.
const darkSpace = new DarkSpace(state, particles);

// Audio: score crossfades + accents. Sound is an OPTION — it stays off
// until the corner "♪" button is clicked (that click doubles as the
// browser's autoplay unlock; the button then toggles mute).
const audio = new AudioManager(state);
// The intro flight drives its own wind bed + intro→prologue crossfade.
introFlight.audio = audio;
// Act3 resolves which story each pad tells (pad 8 is a sequence), then
// rings that story's accent.
act3.onStory = (action) => audio.storyAccent(action);
// Combo 图案 in Act 1 ring a small flourish of their own.
act1.combos.onCombo = (family, tier) => audio.comboAccent(family, tier);

// Music is ON by default: the first real user gesture that begins the piece
// (the "strike any key to begin", or a click) unlocks the AudioContext and
// starts the score unmuted. Browsers require a gesture before any sound, so
// this is the earliest we can honour "default on". Idempotent + one-shot.
const unlockAudioOnce = () => audio.unlock();
window.addEventListener('keydown', unlockAudioOnce, { once: true });
window.addEventListener('pointerdown', unlockAudioOnce, { once: true });

// ── Auto-quality ──────────────────────────────────────────────────────
// If the projector machine can't hold frame rate (especially at 48:9),
// degrade gracefully: first drop the pixel ratio, then thin the bursts.
// A WARM-UP window is ignored (the heavy asset build janks the first few
// seconds — that must never permanently degrade a machine that then runs
// at 60fps), and degrading needs TWO consecutive slow 4s windows so a
// single transient hitch can't trip it.
let fpsTime = 0;
let fpsFrames = 0;
let degradeStep = 0;
let warmup = 6;      // seconds of boot/asset load to ignore
let slowStreak = 0;  // consecutive slow windows
function autoQuality(dt) {
  if (warmup > 0) { warmup -= dt; fpsTime = 0; fpsFrames = 0; return; }
  fpsTime += dt;
  fpsFrames += 1;
  if (fpsTime < 4) return;
  const fps = fpsFrames / fpsTime;
  fpsTime = 0;
  fpsFrames = 0;
  slowStreak = fps < 38 ? slowStreak + 1 : 0;
  if (slowStreak < 2) return; // one slow window is a hitch, not a trend
  if (degradeStep === 0 && renderer.getPixelRatio() > 1) {
    degradeStep = 1;
    renderer.setPixelRatio(1);
    onResize();
    console.info(`[quality] sustained ${fps.toFixed(0)} fps — pixel ratio dropped to 1`);
  } else if (degradeStep === 1 && fps < 33) {
    degradeStep = 2;
    particles.spawnScale = 0.65;
    console.info(`[quality] sustained ${fps.toFixed(0)} fps — burst density reduced`);
  }
}

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

  // The coda melts the beryl ground away with everything else; the dark
  // scenes (prologue, prison, epilogue) never show it at all.
  let groundFade = 1;
  if (state.phase === 'coda') {
    groundFade = Math.max(0, 1 - state.phaseTime / config.acts.codaFadeSec);
  } else if (state.phase === 'intro' || state.phase === 'prologue'
      || state.phase === 'prison' || state.phase === 'epilogue') {
    groundFade = 0;
  }
  ground.update(elapsed, ppwu, state.fullness * groundFade, dt);

  act1.update(elapsed, dt, ppwu);
  const shared = act2.update(elapsed, dt, ppwu);
  act3.update(elapsed, dt, ppwu, shared);
  vaidehi.update(elapsed, dt, ppwu);
  transitions.update(dt);
  backdrop.update(elapsed, dt);
  meditations.update(dt);
  storyScenes.update(elapsed);
  darkSpace.update(elapsed, dt);
  introFlight.update(dt);
  audio.update();
  autoQuality(dt);
  // The intro flight is a 3D perspective pass with its own scene; while
  // it is live it replaces the orthographic panorama entirely.
  if (introFlight.active) introFlight.render(renderer);
  else post.render();
});

// Dev-only handle for debugging from the browser console (also lets tests
// drive frames manually where requestAnimationFrame is throttled).
if (import.meta.env.DEV) {
  window.__paintedCave = {
    midi, osc, state, particles, post, ground, act1, act2, act3, vaidehi,
    tutorial, captions, transitions, backdrop, meditations, storyScenes,
    darkSpace, audio, renderer, introFlight, config,
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
  // Intro shell keys work in ANY keyboard mode: Space launches from the
  // attract screen (and doubles as the hold-to-skip key during the
  // flight, through the same onKey path as MIDI/OSC); Esc aborts the
  // flight back to attract.
  if (state.phase === 'intro') {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) state.onKey({ on: true, note: 60, velocity: 0.6 });
      return;
    }
    if (e.key === 'Escape') { state.introAbort(); return; }
  }
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
  // Shift + '+' opens the sound · Shift + '-' closes it. (Shift is
  // already held, so these pass the keyboard-play guard above; match by
  // typed character AND physical key so layouts can't break it.)
  if (e.shiftKey && (e.key === '+' || e.code === 'Equal')) audio.soundOn();
  if (e.shiftKey && (e.key === '_' || e.key === '-' || e.code === 'Minus')) audio.soundOff();
});
// Releasing Space ends the hold-to-skip gesture (matches the keydown above).
window.addEventListener('keyup', (e) => {
  if (state.phase === 'intro' && e.code === 'Space') {
    state.onKey({ on: false, note: 60, velocity: 0 });
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
