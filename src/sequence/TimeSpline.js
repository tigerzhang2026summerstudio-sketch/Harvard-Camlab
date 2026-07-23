/**
 * TimeSpline — a C1-smooth keyframe track evaluated by TIME, not by
 * normalized curve parameter. Cubic Hermite with finite-difference
 * (Catmull-Rom-style) tangents that respect non-uniform keyframe
 * spacing, so a beat that lasts 10s and one that lasts 3s join without
 * a velocity pop. Works in any dimension: camera position (3D), look-at
 * target (3D), FOV or cohesion (1D) all use the same class.
 *
 * keys: [[t, ...components], …] sorted by t.
 */
export class TimeSpline {
  constructor(keys) {
    this.t = keys.map((k) => k[0]);
    this.v = keys.map((k) => k.slice(1));
    this.dim = this.v[0].length;

    // Finite-difference tangents (per component, non-uniform knots).
    const n = keys.length;
    const { t, v } = this;
    this.m = [];
    for (let i = 0; i < n; i += 1) {
      const m = new Array(this.dim);
      for (let c = 0; c < this.dim; c += 1) {
        if (i === 0) m[c] = (v[1][c] - v[0][c]) / (t[1] - t[0]);
        else if (i === n - 1) m[c] = (v[n - 1][c] - v[n - 2][c]) / (t[n - 1] - t[n - 2]);
        else {
          const a = (v[i][c] - v[i - 1][c]) / (t[i] - t[i - 1]);
          const b = (v[i + 1][c] - v[i][c]) / (t[i + 1] - t[i]);
          m[c] = (a + b) / 2;
        }
      }
      this.m.push(m);
    }
  }

  /** Evaluate at a time (clamped to the track's ends). */
  eval(time, out = []) {
    const { t, v, m, dim } = this;
    const n = t.length;
    if (time <= t[0]) { for (let c = 0; c < dim; c += 1) out[c] = v[0][c]; return out; }
    if (time >= t[n - 1]) { for (let c = 0; c < dim; c += 1) out[c] = v[n - 1][c]; return out; }

    let i = 0;
    while (i < n - 2 && time > t[i + 1]) i += 1;
    const h = t[i + 1] - t[i];
    const s = (time - t[i]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;
    for (let c = 0; c < dim; c += 1) {
      out[c] = h00 * v[i][c] + h10 * h * m[i][c] + h01 * v[i + 1][c] + h11 * h * m[i + 1][c];
    }
    return out;
  }
}
