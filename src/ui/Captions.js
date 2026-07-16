/**
 * Captions — sparse poetic lines that mark each act change, the verbal
 * half of the transition scenes. One line fades in over the lower third,
 * holds, and dissolves. Toggle with C (Shift+C while keyboard-play is on)
 * or pad B7; all text and timing live in config.captions.
 */
import { config } from '../config/config.js';

export class Captions {
  constructor(state, midi) {
    this.enabled = config.captions.enabled;
    this.timers = [];

    this.el = document.createElement('div');
    this.el.id = 'captions';
    this.injectStyles();
    document.body.appendChild(this.el);

    state.on('phase', ({ phase }) => this.show(config.captions.phases[phase]));

    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (midi.fallbackActive && !e.shiftKey) return; // C is a note while playing
      if (e.key.toLowerCase() === 'c') this.toggle();
    });
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.hide();
    console.info(`[captions] ${this.enabled ? 'on' : 'off'}`);
    return this.enabled;
  }

  /** A pad/knob story: a small gold title above the caption line. */
  showStory(title, line) {
    this.show(`<span class="cap-title">${title}</span>\n${line}`);
  }

  show(text) {
    if (!this.enabled || !text) return;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];

    const c = config.captions;
    this.el.innerHTML = text.replaceAll('\n', '<br>');
    this.el.style.transitionDuration = `${c.fadeInSec}s`;
    // reflow so the browser notices the transition even mid-fade
    void this.el.offsetWidth; // eslint-disable-line no-void
    this.el.style.opacity = '1';

    this.timers.push(setTimeout(() => {
      this.el.style.transitionDuration = `${c.fadeOutSec}s`;
      this.el.style.opacity = '0';
    }, (c.fadeInSec + c.holdSec) * 1000));
  }

  hide() {
    this.el.style.transitionDuration = '0.6s';
    this.el.style.opacity = '0';
  }

  injectStyles() {
    const css = document.createElement('style');
    css.textContent = `
      #captions {
        position: fixed; left: 0; right: 0; bottom: 13vh; z-index: 6;
        text-align: center; pointer-events: none;
        font-family: Georgia, 'Times New Roman', serif; font-style: italic;
        font-size: clamp(15px, 1.7vw, 26px); line-height: 1.75;
        letter-spacing: 0.14em; color: #dcc895;
        text-shadow: 0 0 22px rgba(232, 193, 90, 0.35), 0 0 60px rgba(30, 111, 176, 0.25);
        opacity: 0; transition: opacity 2s ease;
      }
      #captions .cap-title {
        display: block; margin-bottom: 0.5em;
        font-style: normal; font-size: 0.72em;
        letter-spacing: 0.34em; color: #e8c15a;
      }`;
    document.head.appendChild(css);
  }
}
