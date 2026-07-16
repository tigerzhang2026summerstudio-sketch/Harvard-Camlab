/**
 * Clock.js — tiny shared time/easing helpers used across modules.
 * (The render loop itself lives in main.js with THREE.Clock.)
 */

export const clamp01 = (x) => Math.min(1, Math.max(0, x));

export const lerp = (a, b, t) => a + (b - a) * t;

/** Smooth 0..1 → 0..1 with zero slope at both ends. */
export const smooth01 = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Random element of an array. */
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Random float in [min, max). */
export const rand = (min, max) => min + Math.random() * (max - min);
