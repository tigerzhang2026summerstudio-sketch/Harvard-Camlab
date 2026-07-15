/**
 * config.js — EVERY artist-tunable value lives here.
 *
 * Open this file, change a number, save: the dev server hot-reloads.
 * No visual/audio constant should be buried inside a module.
 *
 * Sections: DISPLAY · PALETTE · PARTICLES · ACTS & TRANSITIONS ·
 *           AUDIO · CAPTIONS · QUALITY
 */

export const config = {
  // ── DISPLAY / WORLD ────────────────────────────────────────────────
  // The "world" is one continuous horizontal panorama across all walls.
  // All layout math is done in world units relative to these two values,
  // so switching from a single monitor to the three-projector Cave is
  // ONLY a config change (e.g. worldWidth: 5760, worldHeight: 1080).
  worldWidth: 1920,
  worldHeight: 1080,

  // Cap the device pixel ratio: retina 2x is plenty, more wastes GPU.
  maxPixelRatio: 2,

  // Hide the mouse cursor after this many ms of inactivity (show mode).
  cursorHideDelayMs: 3000,

  // ── PALETTE (Dunhuang Cave 217 mineral pigments, as light) ─────────
  palette: {
    background: '#000000',   // pure black — bloom threshold must keep it black
    beryl:      '#1e6fb0',   // luminous beryl blue (the ground, low keys)
    lapis:      '#173d7a',   // deep lapis blue (shadow tones, sky depth)
    gold:       '#e8c15a',   // gold (high keys, Buddha light, fruit of trees)
    cinnabar:   '#c34a33',   // cinnabar red accent (lotus hearts, banners)
    malachite:  '#3f9b6e',   // malachite green accent (leaves, pond glints)
    white:      '#fff6e0',   // warm white (peak highlights, Vaidehī)
  },

  // ── PARTICLES ──────────────────────────────────────────────────────
  particles: {
    // Total pooled particle budget (scaled by quality, see below).
    maxCount: 300_000,
    baseSizePx: 2.2,        // base point size at world scale 1
  },

  // ── QUALITY ────────────────────────────────────────────────────────
  // 'low' | 'medium' | 'high' — scales particle counts and bloom cost.
  quality: 'high',
  qualityScale: {
    low:    { particleScale: 0.15, bloom: false },
    medium: { particleScale: 0.5,  bloom: true },
    high:   { particleScale: 1.0,  bloom: true },
  },

  // ── POSTPROCESSING ─────────────────────────────────────────────────
  bloom: {
    strength: 0.9,    // overall glow amount (K7 refines this live)
    radius: 0.6,
    threshold: 0.15,  // keep high enough that black stays black
  },

  // ── ACTS & TRANSITIONS (thresholds/durations, seconds) ─────────────
  acts: {
    crossfadeSec: 3,          // audio crossfade on act change
    act1FullnessTarget: 1.0,  // energy needed to freeze the beryl ground
    act2LushnessTarget: 1.0,  // trees+ponds+music needed to raise the throne
    codaFadeSec: 20,          // dissolution length
    loopPauseSec: 8,          // black pause before the prologue returns
  },

  // ── AUDIO ──────────────────────────────────────────────────────────
  audio: {
    masterVolumeDb: -6,
    trackNames: ['prologue', 'part1', 'part2', 'part3', 'coda'],
  },

  // ── CAPTIONS ───────────────────────────────────────────────────────
  captions: {
    enabled: true,
    prologue: 'Reveal to me a land without sorrow.',
  },
};
