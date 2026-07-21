/**
 * Tutorial — the opening screen. Fades in over the black prologue and
 * teaches the three zones of the instrument; dissolves the moment the
 * performer strikes the first key (the phase leaves 'prologue'), and
 * returns each time the loop comes back around. H (Shift+H while
 * keyboard-play is on) re-shows it at any time. All text lives in config.
 */
import { config } from '../config/config.js';

export class Tutorial {
  constructor(state, midi) {
    this.midi = midi;
    const t = config.tutorial;
    this.el = document.createElement('div');
    this.el.id = 'tutorial';
    this.el.innerHTML = `
      <h1>${t.title}</h1>
      <h2>${t.subtitle}</h2>
      <p class="tut-quote">${t.quote}</p>
      <div class="tut-steps">
        ${t.steps.map(([zone, text]) => `
          <div class="tut-step"><h3>${zone}</h3><p>${text}</p></div>`).join('')}
      </div>
      <p class="tut-hint">${t.hint}</p>
      <p class="tut-begin">${t.begin}</p>`;
    this.injectStyles();
    document.body.appendChild(this.el);

    this.setVisible(t.enabled && state.phase === 'prologue');
    state.on('phase', ({ phase }) => {
      this.setVisible(t.enabled && phase === 'prologue');
    });

    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (this.midi.fallbackActive && !e.shiftKey) return;
      if (e.key.toLowerCase() === 'h') this.setVisible(this.el.classList.contains('tut-hidden'));
    });
  }

  setVisible(visible) {
    this.el.classList.toggle('tut-hidden', !visible);
  }

  injectStyles() {
    const css = document.createElement('style');
    css.textContent = `
      #tutorial {
        position: fixed; inset: 0; z-index: 5;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        text-align: center; padding: 4vh 8vw; box-sizing: border-box;
        pointer-events: none; /* the instrument itself is the "begin" button */
        color: #cfe3f5;
        font-family: 'EB Garamond', 'Noto Serif SC', 'Songti SC', 'STSong', serif;
        opacity: 1; transition: opacity 1.6s ease;
        text-shadow: 0 0 18px rgba(30, 111, 176, 0.35);
        /* the show poster's lotus-mandala breathes behind the words */
        background:
          radial-gradient(ellipse 60% 60% at 50% 46%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.82) 78%),
          url('/ui/poster-mandala.png') center 46% / min(72vh, 60vw) no-repeat;
        animation: tut-emblem 14s ease-in-out infinite;
      }
      @keyframes tut-emblem {
        0%, 100% { background-color: rgba(0,0,0,0); }
        50% { background-color: rgba(0,0,0,0.25); }
      }
      #tutorial.tut-hidden { opacity: 0; }
      #tutorial h1 {
        margin: 0; font-size: clamp(28px, 4.2vw, 58px); font-weight: normal;
        letter-spacing: 0.32em; text-indent: 0.32em; color: #e8c15a;
        text-shadow: 0 0 26px rgba(232, 193, 90, 0.45);
      }
      #tutorial h2 {
        margin: 0.4em 0 0; font-size: clamp(14px, 1.6vw, 22px); font-weight: normal;
        letter-spacing: 0.42em; text-indent: 0.42em; color: #8fb7d9;
      }
      .tut-quote { margin: 3.5vh 0 4vh; font-style: italic; font-size: clamp(13px, 1.4vw, 19px); color: #a9c6e2; }
      .tut-steps { display: flex; gap: 3.5vw; max-width: 1200px; }
      .tut-step { flex: 1; }
      .tut-step h3 {
        margin: 0 0 0.5em; font-weight: normal; font-size: clamp(12px, 1.1vw, 16px);
        letter-spacing: 0.28em; color: #e8c15a;
      }
      .tut-step p { margin: 0; font-size: clamp(11px, 1vw, 15px); line-height: 1.7; color: #9db8d2; }
      .tut-hint {
        margin: 5vh 0 0; font-size: clamp(10px, 0.9vw, 13px); color: #6f87a0;
        font-family: ui-monospace, Menlo, monospace;
      }
      .tut-begin {
        margin: 1.2em 0 0; font-size: clamp(12px, 1.1vw, 16px); letter-spacing: 0.3em;
        color: #fff6e0; animation: tut-breathe 4s ease-in-out infinite;
      }
      @keyframes tut-breathe { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.95; } }`;
    document.head.appendChild(css);
  }
}
