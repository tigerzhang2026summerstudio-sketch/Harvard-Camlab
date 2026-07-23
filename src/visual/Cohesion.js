/**
 * Cohesion — the ONE parameter that governs the intro's hybrid look
 * (intro build step 5).
 *
 *   cohesion = 1.0 → photo points rest at their depth positions;
 *                    reads as a photograph with real parallax.
 *   cohesion → 0.0 → points drift free on noise velocities; the world
 *                    disintegrates into luminous motes.
 *
 * The value is a TIME TRACK, not a constant: it falls beat by beat on
 * the way in (reality granulating as the cave nears) and RISES again
 * inside the chamber (the murals condensing out of the drift). The
 * keyframes live in config.intro.beats — third column — evaluated
 * through the same C1 TimeSpline as the camera rail, with the final
 * push-in pinned to 1.0 at durationSec.
 *
 * Every PhotoCloud samples this one track, so the whole world loosens
 * and gathers in unison.
 */
import { config } from '../config/config.js';
import { TimeSpline } from '../sequence/TimeSpline.js';

export class CohesionTrack {
  constructor() {
    const keys = config.intro.beats.map((b) => [b[0], b[2]]);
    keys.push([config.intro.durationSec, 1.0]); // the painting closes solid
    this.spline = new TimeSpline(keys);
    this.out = [];
  }

  /** Cohesion ∈ [0,1] at a flight time. */
  at(t) {
    return Math.min(1, Math.max(0, this.spline.eval(t, this.out)[0]));
  }
}
