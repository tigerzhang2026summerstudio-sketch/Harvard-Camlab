/**
 * CaveInterior — the chamber of Cave 217, condensing out of the motes
 * (intro build step 7).
 *
 * Beats 8–10 invert the flight's mechanic: outside, photographs
 * DISINTEGRATED as cohesion fell; in here the murals GATHER as it
 * rises — the west-wall niche Buddha ahead, the great north-wall
 * tableau to the right, the heavens on the ceiling, and the WEST PANEL
 * of the tableau — the imprisoned queen's story, the whole piece's
 * push-in target — burning nearest and brightest.
 *
 * Every surface is a PhotoCloud (real Cave 217 mural crops from
 * assets/murals/), driven by the SAME global cohesion track as the
 * outdoor stations, but each with a small cohesionLag so the room
 * assembles in order: niche → panel → tableau → ceiling. The camera
 * rail (beat 10) then turns and pushes into the panel as it closes
 * solid, and the blackout hands the piece to the prologue — from
 * looking at a painting to standing inside its story.
 *
 * Surfaces are configured in config.intro.interior (same schema as
 * stations, plus cohesionLag). A missing mural logs and skips; the
 * bare rock placeholder simply remains.
 */
import { config } from '../config/config.js';
import { PhotoCloud } from '../visual/PhotoCloud.js';

export class CaveInterior {
  constructor(scene) {
    this.surfaces = config.intro.interior.map((st) => ({
      cloud: new PhotoCloud(scene, st),
      lag: st.cohesionLag ?? 0,
    }));
  }

  /**
   * Per frame from IntroFlight: sample the global track per surface,
   * shifted by its lag, so the condensation sweeps through the room
   * rather than snapping everywhere at once.
   */
  set(track, t) {
    for (const s of this.surfaces) {
      s.cloud.set(track.at(t - s.lag), t);
    }
  }
}
