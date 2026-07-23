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
      <div class="tut-inner">
        <h1>${t.title}</h1>
        <h2>${t.subtitle}</h2>
        <p class="tut-quote">${t.quote}</p>
        <div class="tut-steps">
          ${t.steps.map(([zone, text]) => `
            <div class="tut-step"><h3>${zone}</h3><p>${text}</p></div>`).join('')}
        </div>
        <p class="tut-hint">${t.hint}</p>
        <p class="tut-begin">${t.begin}</p>
      </div>`;
    this.injectStyles();
    document.body.appendChild(this.el);

    // The tutorial doubles as the ATTRACT screen: it waits over the intro's
    // starfield and dissolves when the flight launches. (With the intro
    // disabled it keeps its old home over the prologue instead — after the
    // flight the piece must arrive in unbroken darkness, so it never
    // returns at prologue when the intro delivered us there.)
    const wanted = (phase) => (config.intro.enabled
      ? phase === 'intro' && state.introMode === 'attract'
      : phase === 'prologue');
    this.setVisible(t.enabled && wanted(state.phase));
    state.on('phase', ({ phase }) => this.setVisible(t.enabled && wanted(phase)));
    state.on('introMode', () => this.setVisible(t.enabled && wanted(state.phase)));

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
        pointer-events: none; /* the instrument itself is the "begin" button */
        color: #cfe3f5;
        font-family: 'EB Garamond', 'Noto Serif SC', 'Songti SC', 'STSong', serif;
        opacity: 1; transition: opacity 1.6s ease;
        text-shadow: 0 0 18px rgba(30, 111, 176, 0.35);
        background: transparent; /* lotus-mandala dropped — clean over the starfield */
      }
      /* The intro lives in ONE centered box. On the 48:9 Cave wall it is
         confined to the MIDDLE screen (centre third); a normal display fills
         the width up to a readable max. A soft vignette sits behind the words. */
      #tutorial .tut-inner {
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        text-align: center; box-sizing: border-box;
        width: 100%; max-width: min(1100px, 92vw); padding: 4vh 3vw;
        background: radial-gradient(ellipse 72% 78% at 50% 50%,
          rgba(2, 7, 14, 0.6) 42%, rgba(2, 7, 14, 0) 82%);
      }
      @media (min-aspect-ratio: 3 / 1) {
        /* three-screen wall — keep the intro on the centre screen only */
        #tutorial .tut-inner { max-width: 33.333vw; padding: 3.5vh 1.2vw; }
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
      .tut-steps { display: flex; gap: 2.4em; max-width: 1200px; }
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
