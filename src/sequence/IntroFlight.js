/**
 * IntroFlight — the ~60s flight into Cave 217 (config.intro).
 *
 * Runs BEFORE the prologue: attract screen → launch → ten beats on
 * rails (night sky → Gobi → dunes → oasis → the Mogao cliff → through
 * a cave mouth → the chamber → INTO the north-wall mural) → prologue.
 *
 * BUILD STEP 1 SCAFFOLD: state machinery only. The flight is a timed
 * placeholder that walks the ten beats as small captions so launch,
 * hold-to-skip, abort, and the handoff can all be rehearsed now; the
 * camera rail (step 2), vection layer (3), procedural world (4) and
 * photo point clouds (5+) will replace the placeholder in place.
 *
 * StateManager owns WHERE we are (intro / introMode); this module owns
 * WHAT HAPPENS during the flight and calls state.introComplete() when
 * beat 10 fades. Skip/abort need no cleanup hooks here — everything
 * keys off state.introMode per frame.
 */
import { config } from '../config/config.js';

export class IntroFlight {
  constructor(state, captions) {
    this.state = state;
    this.captions = captions;
    this.beatIndex = -1;

    state.on('introMode', ({ mode }) => {
      this.beatIndex = -1;
      if (mode === 'flight') console.info('[intro] launch — the flight begins');
      else console.info('[intro] attract — waiting');
    });
    state.on('phase', ({ phase, prev }) => {
      if (prev === 'intro') this.beatIndex = -1;
      if (prev === 'intro' && phase === 'prologue') {
        console.info('[intro] handoff → prologue');
      }
    });
  }

  /** Current beat index for a flight time, from the config table. */
  beatAt(t) {
    const { beats } = config.intro;
    let i = 0;
    while (i + 1 < beats.length && t >= beats[i + 1][0]) i += 1;
    return i;
  }

  update() {
    const s = this.state;
    if (s.phase !== 'intro' || s.introMode !== 'flight') return;

    const t = s.introTime;
    if (t >= config.intro.durationSec) {
      s.introComplete();
      return;
    }

    // Placeholder: announce each beat as it arrives (rehearsal only —
    // replaced by the camera rail + worlds in later build steps).
    const i = this.beatAt(t);
    if (i !== this.beatIndex) {
      this.beatIndex = i;
      const [atSec, name, cohesion] = config.intro.beats[i];
      this.captions?.show(
        `[intro · beat ${i + 1}/10 · ${name} · t=${atSec}s · cohesion ${cohesion}]`,
      );
    }
  }
}
