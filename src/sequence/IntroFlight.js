/**
 * IntroFlight — the ~60s flight into Cave 217 (config.intro).
 *
 * Runs BEFORE the prologue: attract screen → launch → ten beats on
 * rails (night sky → Gobi → dunes → oasis → the Mogao cliff → through
 * a cave mouth → the chamber → INTO the north-wall mural) → prologue.
 *
 * The flight owns its own 3D scene and perspective camera (the rest of
 * the piece is an orthographic panorama); main.js renders this pass
 * INSTEAD of the panorama while the flight is live. Built so far:
 *
 *   step 2 — the rail: three TimeSplines (position, look-at, fov) over
 *     config.intro.camera.keyframes, one unbroken move, with the glider
 *     feel layered on top (slow roll + bob, banking into lateral drift,
 *     everything calming at the threshold — a corridor doesn't bob).
 *   step 3 — VectionLayer: near-field motes streaking past the lens.
 *   step 4 — IntroWorld: the procedural desert (dune heightfield of
 *     gold motes, cloud sea, oasis, the honeycombed cliff) — the whole
 *     60s watchable with zero photographs.
 *   step 5 — PhotoCloud + CohesionTrack: photographs displaced into 3D
 *     point clouds parked as stations on the path, all breathing on
 *     one global cohesion track (photographic → drift → condensing).
 *   step 6 — the real shot list (assets/flight/) as tinted stations
 *     along beats 1–6, ending in the Mogao wall that granulates open.
 *   step 7 — CaveInterior: the chamber's murals (real Cave 217 crops)
 *     condensing OUT of the motes as cohesion rises — niche → west
 *     panel → tableau → ceiling — then the push into the panel.
 *   step 8 — the deep push into the west panel + the "strike a key"
 *     handoff caption once the black settles in the prologue.
 *   step 9 — WallRig: three off-axis cameras for the Cave's wraparound.
 *   step 10 — audio: the intro track, a wind bed tracking airspeed/
 *     altitude that CUTS at the threshold, and the intro→prologue
 *     crossfade (driven per-frame through this.audio.introAudio).
 *
 * StateManager owns WHERE we are (intro / introMode); this module owns
 * WHAT HAPPENS during the flight and calls state.introComplete() when
 * the final fade lands. Skip/abort need no cleanup — everything keys
 * off state.introMode per frame, and the blackout overlay always eases
 * itself back out.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';
import { TimeSpline } from './TimeSpline.js';
import { IntroWorld } from './IntroWorld.js';
import { CaveInterior } from './CaveInterior.js';
import { WallRig } from '../core/WallRig.js';
import { VectionLayer } from '../visual/VectionLayer.js';
import { CohesionTrack } from '../visual/Cohesion.js';
import { PhotoCloud } from '../visual/PhotoCloud.js';

const DEG = Math.PI / 180;
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class IntroFlight {
  constructor(state, captions) {
    this.state = state;
    this.captions = captions;
    this.audio = null;          // main.js wires the AudioManager here
    this.beatIndex = -1;

    const cam = config.intro.camera;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, cam.fogDensity);
    this.camera = new THREE.PerspectiveCamera(cam.fovBase, 16 / 9, 2, 60000);

    this.posSpline = new TimeSpline(cam.keyframes.map((k) => [k[0], ...k[1]]));
    this.lookSpline = new TimeSpline(cam.keyframes.map((k) => [k[0], ...k[2]]));
    this.fovSpline = new TimeSpline(cam.keyframes.map((k) => [k[0], k[3]]));
    this.bank = 0;          // smoothed banking roll, degrees
    this.pos = [];          // scratch spline outputs
    this.look = [];
    this.fov1 = [];

    // The procedural desert night (config.intro.world) — photos later
    // land on top of it, never replace it.
    this.world = new IntroWorld(this.scene);

    // Three off-axis wall cameras for the Cave's wraparound (config.walls).
    this.wallRig = new WallRig();

    // Near-field motes streaking past the lens — the speed you FEEL.
    this.vection = new VectionLayer(this.scene);
    this.vel = new THREE.Vector3();

    // Photo stations along the path, all breathing on ONE cohesion
    // track (photographic → luminous drift → condensing again inside).
    this.cohesion = new CohesionTrack();
    this.cohesionNow = 1;
    this.clouds = config.intro.stations.map((st) => new PhotoCloud(this.scene, st));

    // The chamber of Cave 217 — its murals condense as cohesion rises.
    this.interior = new CaveInterior(this.scene);

    // Blackout overlay: the last seconds sink to black, and the same
    // veil lifts gently off whatever phase we hand over to.
    this.blackout = 0;
    this.fadeEl = document.createElement('div');
    this.fadeEl.id = 'intro-fade';
    this.fadeEl.style.cssText =
      'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:30;';
    document.body.appendChild(this.fadeEl);

    state.on('introMode', ({ mode }) => {
      this.beatIndex = -1;
      this.bank = 0;
      if (mode === 'flight') console.info('[intro] launch — the flight begins');
      else console.info('[intro] attract — waiting');
    });
    state.on('phase', ({ phase, prev }) => {
      if (prev === 'intro') this.beatIndex = -1;
      if (prev === 'intro' && phase === 'prologue') {
        console.info('[intro] handoff → prologue');
        // Step 8: once the black has settled, one line seals the
        // transition — the wall's story is now the room — and asks for
        // the first key, which begins Vaidehī's story.
        const h = config.intro.handoff;
        setTimeout(() => {
          if (this.state.phase !== 'prologue') return; // key already struck
          this.captions?.showActTitle(h.title);
          this.captions?.show(h.line);
        }, h.delaySec * 1000);
      }
    });
  }

  /** main.js renders the flight's 3D pass instead of the panorama when true. */
  get active() {
    return this.state.phase === 'intro' && this.state.introMode === 'flight';
  }

  /** Current beat index for a flight time, from the config table. */
  beatAt(t) {
    const { beats } = config.intro;
    let i = 0;
    while (i + 1 < beats.length && t >= beats[i + 1][0]) i += 1;
    return i;
  }

  update(dt) {
    // Intro audio runs through BOTH attract and flight (the wind bed and
    // the intro→prologue crossfade). Uses last frame's velocity/altitude
    // — a one-frame lag is inaudible.
    if (this.state.phase === 'intro') {
      const speed01 = Math.min(1, this.vel.length() / config.intro.vection.fullSpeed);
      const alt01 = Math.min(1, Math.max(0, this.camera.position.y) / 3000);
      this.audio?.introAudio?.(this.state.introMode, this.state.introTime, speed01, alt01);
    }

    if (!this.active) {
      // Off the flight, the veil always eases itself away (handoff or abort).
      if (this.blackout > 0) {
        this.blackout = Math.max(0, this.blackout - dt / 1.8);
        this.fadeEl.style.opacity = this.blackout.toFixed(3);
      }
      return;
    }

    const t = this.state.introTime;
    const { durationSec, fadeOutSec } = config.intro;
    if (t >= durationSec) {
      this.state.introComplete();
      return;
    }

    // Beat readout — OPERATOR ONLY (visible while the D overlay is
    // open). The audience flies wordless; the captions belong to the
    // handoff and the acts.
    const i = this.beatAt(t);
    if (i !== this.beatIndex) {
      this.beatIndex = i;
      if (document.body.classList.contains('operator-ui')) {
        const [atSec, name, cohesion] = config.intro.beats[i];
        this.captions?.show(
          `[intro · beat ${i + 1}/10 · ${name} · t=${atSec}s · cohesion ${cohesion}]`,
        );
      }
    }

    // The world's motes shimmer on their own clock; the photo clouds
    // hold or scatter with the global cohesion.
    this.world.update(t);
    this.cohesionNow = this.cohesion.at(t);
    for (const c of this.clouds) c.set(this.cohesionNow, t);
    this.interior.set(this.cohesion, t);

    // ── The rail ─────────────────────────────────────────────────────
    const cam = config.intro.camera;
    const p = this.posSpline.eval(t, this.pos);
    const look = this.lookSpline.eval(t, this.look);

    // The glider feel dies down crossing the threshold — a stone
    // corridor doesn't bob.
    const calm = 1 - smoothstep(cam.calmAfter[0], cam.calmAfter[1], t) * 0.85;

    const bob = Math.sin((t / cam.bobPeriodSec) * Math.PI * 2) * cam.bobAmp * calm;
    this.camera.position.set(p[0], p[1] + bob, p[2]);
    this.camera.lookAt(look[0], look[1], look[2]);

    // Banking: lean into lateral drift, relative to forward speed.
    const h = 0.25;
    const a = this.posSpline.eval(Math.max(0, t - h), []);
    const b = this.posSpline.eval(Math.min(durationSec, t + h), []);
    const vx = (b[0] - a[0]) / (2 * h);
    const vy = (b[1] - a[1]) / (2 * h);
    const vz = (b[2] - a[2]) / (2 * h);

    // The rail's velocity drives the near-field streaks.
    this.vel.set(vx, vy, vz);
    this.vection.update(this.camera.position, this.vel);
    const speed = Math.max(40, Math.hypot(vx, vz));
    const bankTarget = Math.max(
      -cam.bankMaxDeg,
      Math.min(cam.bankMaxDeg, -(vx / speed) * cam.bankGainDeg),
    ) * calm;
    this.bank += (bankTarget - this.bank) * Math.min(1, dt * cam.bankSmooth);

    const roll = this.bank
      + Math.sin((t / cam.rollPeriodSec) * Math.PI * 2) * cam.rollAmpDeg * calm;
    this.camera.rotateZ(roll * DEG);

    const fov = this.fovSpline.eval(t, this.fov1)[0];
    if (Math.abs(fov - this.camera.fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    // ── The final fade into black (then the prologue's darkness) ─────
    this.blackout = smoothstep(durationSec - fadeOutSec, durationSec, t);
    this.fadeEl.style.opacity = this.blackout.toFixed(3);
  }

  render(renderer) {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    // On the Cave's ultra-wide wall the WallRig composites three
    // off-axis cameras sharing this camera's pose; on a flat monitor
    // the ordinary single-camera render stands.
    if (this.wallRig.active(aspect)) {
      this.wallRig.render(renderer, this.scene, this.camera);
      return;
    }
    if (Math.abs(aspect - this.camera.aspect) > 1e-3) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    renderer.render(this.scene, this.camera);
  }
}
