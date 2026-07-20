/**
 * StoryScenes — the narrated bookends of the arc.
 *
 * PRISON (after the first key): Vaidehī's story told line by line
 * (config.prison.lines; keys pace it), while the real Cave-217 prison
 * mural holds dimly on the wall, re-condensing as it frays.
 *
 * EPILOGUE (after the coda): a single lotus of light stays lit in the
 * darkness, the closing line appears, and the cave wall itself glows
 * once (backdrop opacityByPhase.epilogue) before the loop returns.
 */
import { config } from '../config/config.js';
import { lotusPoints, preloadMural, muralPointsFor } from './ComboPatterns.js';

export class StoryScenes {
  constructor(state, particles, captions) {
    this.state = state;
    this.particles = particles;
    this.captions = captions;
    this.time = 0;
    this.muralAt = -1e9;   // last prison-mural condensation
    this.lotusAt = -1e9;   // last epilogue lotus refresh
    this.epilogueLineShown = false;

    this.budget = Math.round(
      5200 * Math.max(0.4, config.qualityScale[config.quality].particleScale),
    );
    preloadMural(config.prison.mural, this.budget);

    state.on('prisonLine', ({ index }) => {
      const [title, line] = config.prison.lines[index];
      this.captions.showStory(title, line);
    });
    state.on('phase', ({ phase }) => {
      if (phase === 'epilogue') {
        this.epilogueLineShown = false;
        this.lotusAt = -1e9;
      }
    });
  }

  update(time) {
    this.time = time;
    const s = this.state;

    if (s.phase === 'prison') {
      // The prison mural holds on the wall — dim, patient, re-condensing.
      if (time - this.muralAt >= 4.6) {
        const m = muralPointsFor(config.prison.mural);
        if (m) {
          this.muralAt = time;
          const hW = config.worldHeight * 0.44;
          this.particles.settle({
            pts: m.pts.map((p) => ({
              x: p.x * hW, y: p.y * hW, col: p.col.clone().multiplyScalar(0.4),
            })),
            x: 0.26 * config.worldWidth,
            y: 0.06 * config.worldHeight,
            size: 2.1, life: 6.4, scatter: 90, stagger: 2.2,
          });
        }
      }
    }

    if (s.phase === 'epilogue') {
      // One lotus stays lit in the dark until the scene lets go.
      if (s.phaseTime <= config.acts.epilogueSec - 4 && time - this.lotusAt >= 4.4) {
        this.lotusAt = time;
        this.particles.settle({
          pts: lotusPoints(110, Math.round(this.budget * 0.6)),
          x: 0, y: -0.08 * config.worldHeight,
          size: 2.4, life: 5.6, scatter: 130, stagger: 1.4,
        });
      }
      if (!this.epilogueLineShown && s.phaseTime >= 2.5) {
        this.epilogueLineShown = true;
        const [title, line] = config.epilogue.line;
        this.captions.showStory(title, line);
      }
    }
  }
}
