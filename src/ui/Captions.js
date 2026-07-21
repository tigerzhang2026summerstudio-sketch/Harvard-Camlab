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
    this.actEl = document.createElement('div');
    this.actEl.id = 'act-title';
    this.actTimers = [];
    this.injectStyles();
    document.body.appendChild(this.el);
    document.body.appendChild(this.actEl);

    state.on('phase', ({ phase }) => {
      const [title, line] = config.captions.phases[phase] ?? ['', ''];
      if (title) this.showActTitle(title);
      if (line) this.show(line);
    });

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

  /** The big center-screen act card ("ACT III · …") on each transition. */
  showActTitle(title) {
    if (!this.enabled) return;
    for (const t of this.actTimers) clearTimeout(t);
    this.actTimers = [];
    this.actEl.textContent = title;
    this.actEl.style.transitionDuration = '1.6s';
    void this.actEl.offsetWidth; // eslint-disable-line no-void
    this.actEl.style.opacity = '1';
    this.actTimers.push(setTimeout(() => {
      this.actEl.style.transitionDuration = '2.6s';
      this.actEl.style.opacity = '0';
    }, 6000));
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
    this.actEl.style.transitionDuration = '0.6s';
    this.actEl.style.opacity = '0';
  }

  injectStyles() {
    const css = document.createElement('style');
    css.textContent = `
      #captions {
        position: fixed; left: 0; right: 0; bottom: 13vh; z-index: 6;
        text-align: center; pointer-events: none;
        font-family: 'EB Garamond', 'Noto Serif SC', 'Songti SC', 'STSong', serif;
        font-style: italic;
        font-size: clamp(16px, 1.8vw, 28px); line-height: 1.8;
        letter-spacing: 0.06em; color: #e8d9ae;
        /* dark halo FIRST so the words survive any particle storm… */
        text-shadow:
          0 1px 3px rgba(0, 0, 0, 0.95), 0 0 10px rgba(0, 0, 0, 0.9),
          0 0 24px rgba(0, 0, 0, 0.85), 0 0 3px rgba(0, 0, 0, 1),
          0 0 40px rgba(232, 193, 90, 0.25);
        opacity: 0; transition: opacity 2s ease;
      }
      #captions .cap-title {
        display: block; margin-bottom: 0.55em;
        font-style: normal; font-weight: 600; font-size: 0.74em;
        letter-spacing: 0.24em; color: #e8c15a;
      }
      #act-title {
        position: fixed; left: 0; right: 0; top: 34vh; z-index: 6;
        text-align: center; pointer-events: none;
        font-family: 'EB Garamond', 'Noto Serif SC', 'Songti SC', 'STSong', serif;
        font-weight: 600;
        font-size: clamp(28px, 3.8vw, 58px);
        letter-spacing: 0.22em; text-indent: 0.22em; color: #e8c15a;
        text-shadow:
          0 1px 4px rgba(0, 0, 0, 0.95), 0 0 14px rgba(0, 0, 0, 0.9),
          0 0 30px rgba(0, 0, 0, 0.8), 0 0 40px rgba(232, 193, 90, 0.4);
        opacity: 0; transition: opacity 1.6s ease;
      }`;
    document.head.appendChild(css);
  }
}
