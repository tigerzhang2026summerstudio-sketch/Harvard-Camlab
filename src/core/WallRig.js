/**
 * WallRig — correct wraparound perspective for the Cave's three walls
 * (intro build step 9).
 *
 * The Cave's side walls face the audience at an angle; stretching one
 * wide-FOV image across all three makes them read as a distorted flat
 * picture. The rig instead renders THREE cameras that share one eye —
 * the rail pose — each with an OFF-AXIS (asymmetric) frustum built
 * from its wall's real rectangle, composited side by side into the
 * ultra-wide canvas. Seen from inside the U of walls, the panorama
 * then reads as continuous SPACE: peripheral optical flow lands on the
 * side walls with true perspective, which is the entire reason the
 * flight is rendered in 3D.
 *
 * Geometry lives in config.walls: wall width/height, viewer distance,
 * and the interior angle between the front and side walls (90° = box).
 * Walls are defined in the VIEWER-LOCAL frame (eye at origin, looking
 * -Z) and carried through the world by the rail camera's pose, so
 * roll/bank tilt the whole room together. Projection per wall follows
 * Kooima's "Generalized Perspective Projection" — frustum extents from
 * the eye→corner vectors in the wall's own basis.
 *
 * mode 'single' keeps the ordinary one-camera render (flat monitors);
 * 'auto' engages the rig only when the canvas is ultra-wide (the
 * 5760×1080 wall), so a 16:9 rehearsal monitor never changes.
 */
import * as THREE from 'three';
import { config } from '../config/config.js';

export class WallRig {
  constructor() {
    const w = config.walls;
    const W = w.width;
    const H = w.height;
    const D = w.viewerDistance;
    const th = (w.interiorAngleDeg * Math.PI) / 180;

    // Wall rectangles in the viewer-local frame (eye at origin, -Z
    // forward): pa = bottom-left, pb = bottom-right, pc = top-left, as
    // seen by the viewer. Side walls hinge on the front wall's edges;
    // u points from each hinge along its side wall (θ=90° → toward
    // the audience, θ=180° → flat extension).
    const uL = new THREE.Vector3(-Math.cos(th), 0, Math.sin(th));
    const uR = new THREE.Vector3(Math.cos(th), 0, Math.sin(th));
    const hl = new THREE.Vector3(-W / 2, 0, -D); // left hinge (wall centre height)
    const hr = new THREE.Vector3(W / 2, 0, -D);
    const dn = new THREE.Vector3(0, -H / 2, 0);
    const up = new THREE.Vector3(0, H / 2, 0);
    const p = (base, along, vert) => base.clone().addScaledVector(along.u, along.s).add(vert);
    const none = { u: uL, s: 0 };

    this.wallsLocal = [
      { // left wall — far end is its left edge as seen from the eye
        pa: p(hl, { u: uL, s: W }, dn), pb: p(hl, none, dn), pc: p(hl, { u: uL, s: W }, up),
      },
      { // front wall
        pa: hl.clone().add(dn), pb: hr.clone().add(dn), pc: hl.clone().add(up),
      },
      { // right wall — hinge is its left edge
        pa: p(hr, none, dn), pb: p(hr, { u: uR, s: W }, dn), pc: p(hr, none, up),
      },
    ];

    this.cams = this.wallsLocal.map(() => {
      const c = new THREE.Camera();
      c.matrixAutoUpdate = false;
      c.matrixWorldAutoUpdate = false; // we write matrixWorld directly
      return c;
    });

    // scratch
    this._size = new THREE.Vector2();
    this._pa = new THREE.Vector3();
    this._pb = new THREE.Vector3();
    this._pc = new THREE.Vector3();
    this._vr = new THREE.Vector3();
    this._vu = new THREE.Vector3();
    this._vn = new THREE.Vector3();
    this._va = new THREE.Vector3();
    this._vb = new THREE.Vector3();
    this._vc = new THREE.Vector3();
    this._eye = new THREE.Vector3();
    this._m = new THREE.Matrix4();
  }

  /** Should the rig composite, at this canvas aspect? */
  active(aspect) {
    const mode = config.walls.mode;
    if (mode === 'rig') return true;
    if (mode === 'single') return false;
    return aspect >= config.walls.rigAspect;
  }

  /** Render the scene once per wall, side by side across the canvas. */
  render(renderer, scene, poseCam) {
    poseCam.updateMatrixWorld();
    poseCam.getWorldPosition(this._eye);
    const near = poseCam.near;
    const far = poseCam.far;

    const size = renderer.getSize(this._size);
    const n = this.cams.length;
    const wpx = size.x / n;

    renderer.setScissorTest(true);
    for (let i = 0; i < n; i += 1) {
      const wall = this.wallsLocal[i];
      // wall corners: viewer-local → world through the rail pose
      this._pa.copy(wall.pa).applyMatrix4(poseCam.matrixWorld);
      this._pb.copy(wall.pb).applyMatrix4(poseCam.matrixWorld);
      this._pc.copy(wall.pc).applyMatrix4(poseCam.matrixWorld);

      // Kooima: wall basis, eye→corner vectors, frustum extents
      const vr = this._vr.subVectors(this._pb, this._pa).normalize();
      const vu = this._vu.subVectors(this._pc, this._pa).normalize();
      const vn = this._vn.crossVectors(vr, vu).normalize();
      const va = this._va.subVectors(this._pa, this._eye);
      const vb = this._vb.subVectors(this._pb, this._eye);
      const vc = this._vc.subVectors(this._pc, this._eye);
      const d = Math.max(1e-4, -va.dot(vn));
      const s = near / d;
      const l = vr.dot(va) * s;
      const r = vr.dot(vb) * s;
      const b = vu.dot(va) * s;
      const t = vu.dot(vc) * s;

      const cam = this.cams[i];
      cam.matrix.makeBasis(vr, vu, vn).setPosition(this._eye);
      cam.matrixWorld.copy(cam.matrix);
      cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
      cam.projectionMatrix.makePerspective(l, r, t, b, near, far);
      cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

      const x = Math.floor(i * wpx);
      const wCol = Math.floor((i + 1) * wpx) - x; // no gap from rounding
      renderer.setViewport(x, 0, wCol, size.y);
      renderer.setScissor(x, 0, wCol, size.y);
      renderer.render(scene, cam);
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, size.x, size.y);
  }
}
