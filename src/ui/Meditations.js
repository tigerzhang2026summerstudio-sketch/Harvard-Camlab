/**
 * Meditations — when nobody touches the instrument for a while, the
 * piece meditates aloud: short Contemplation-Sutra passages surface one
 * at a time through the caption system. Idle time becomes part of the
 * show instead of dead air. Passages/timing in config.captions.meditation.
 */
import { config } from '../config/config.js';

export class Meditations {
  constructor(state, captions) {
    this.state = state;
    this.captions = captions;
    this.wait = 0;
    this.index = 0;
  }

  update(dt) {
    const m = config.captions.meditation;
    const s = this.state;
    const passages = m.passages[s.phase];
    if (!passages || s.idleTime < m.idleSec) {
      this.wait = 0;
      return;
    }
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = m.everySec;
    this.captions.show(passages[this.index % passages.length]);
    this.index += 1;
  }
}
