// Freehand drawing ↔ spline control points (the Design Lab's Draw tool). A stroke is
// captured in pad pixels, thinned to its shape-defining points, and placed on a drawing
// plane in metres, ready to become the `pts` of a spline (`polyline`) node. The same plane
// maths runs backwards to load an existing spline onto the pad so its points can be edited.
import type { Vec3 } from "./types";
import * as G from "./geometry";

export type Pt2 = [number, number];

/** A drawing plane: where the pad sits in the world and which way it faces.
 *  - `turn` spins it about the vertical: 0 faces +z (the pad's right is +x), 90 faces −x
 *    (its right is +z).
 *  - `pitch` tilts it from flat (0, a plan) to upright (90, an elevation); in between it rises
 *    away from the viewer like a roof slope.
 *  - `origin` anchors the pad: the middle of its bottom edge on a pitched plane (so a drawn
 *    arch stands on it), its centre on a flat one. */
export interface DrawPlane {
  origin: Vec3;
  turn: number; // degrees
  pitch: number; // degrees
}

export type PlanePreset = "xy" | "xz" | "yz";

/** The three axis planes, as turn/pitch pairs. */
export const PLANE_PRESETS: Record<PlanePreset, { turn: number; pitch: number }> = {
  xy: { turn: 0, pitch: 90 }, // elevation
  xz: { turn: 0, pitch: 0 }, // plan
  yz: { turn: 90, pitch: 90 }, // side
};

export function presetPlane(preset: PlanePreset, origin: Vec3 = [0, 0, 0]): DrawPlane {
  return { origin, ...PLANE_PRESETS[preset] };
}

/** An angle folded into [-180, 180). */
const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

/** Which preset a plane's orientation matches (its origin may be anywhere), if any. */
export function matchPreset(pl: DrawPlane): PlanePreset | null {
  for (const key of Object.keys(PLANE_PRESETS) as PlanePreset[]) {
    const p = PLANE_PRESETS[key];
    if (Math.abs(pl.pitch - p.pitch) < 1e-6 && Math.abs(wrapDeg(pl.turn - p.turn)) < 1e-6) return key;
  }
  return null;
}

export const isFlat = (pl: DrawPlane) => Math.abs(pl.pitch) < 1e-6;

/** A plane's axes: `u` is the pad's right (always horizontal), `v` its up, `n` = u × v
 *  points out of the pad towards the viewer. */
export interface Frame {
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  n: Vec3;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
// Snap trig noise (cos 90° ≈ 6e-17) to zero so axis planes map exactly; also drops -0.
const tidy = (x: number) => (Math.abs(x) < 1e-12 ? 0 : x);

export function planeFrame(pl: DrawPlane): Frame {
  const t = rad(pl.turn), p = rad(pl.pitch);
  const ct = Math.cos(t), st = Math.sin(t), cp = Math.cos(p), sp = Math.sin(p);
  return {
    origin: pl.origin,
    u: [tidy(ct), 0, tidy(st)],
    v: [tidy(cp * st), tidy(sp), tidy(-cp * ct)],
    n: [tidy(-sp * st), tidy(cp), tidy(sp * ct)],
  };
}

/** Plane coordinates (a along the pad's right, b up it, c out of it — metres) → world. */
export function planeToWorld([a, b, c]: Vec3, f: Frame): Vec3 {
  return [
    f.origin[0] + a * f.u[0] + b * f.v[0] + c * f.n[0],
    f.origin[1] + a * f.u[1] + b * f.v[1] + c * f.n[1],
    f.origin[2] + a * f.u[2] + b * f.v[2] + c * f.n[2],
  ];
}

/** World → plane coordinates (the inverse of `planeToWorld`; the frame is orthonormal). */
export function worldToPlane(p: Vec3, f: Frame): Vec3 {
  const d = G.sub(p, f.origin);
  return [G.dot(d, f.u), G.dot(d, f.v), G.dot(d, f.n)];
}

/** Whole degrees when within 0.05° of one (fitting mm-rounded points leaves that much
 *  noise), else tenths. Snapping only turns the pad; points keep their exact positions. */
function snapAngle(d: number): number {
  const r = Math.round(d);
  return Math.abs(d - r) < 0.05 ? r + 0 : Math.round(d * 10) / 10 + 0;
}

/** Turn and pitch that face a plane with this normal. A normal and its reverse are the same
 *  plane, so the one that faces up is used — or, for an upright plane, the one facing +z (or
 *  −x), which keeps the pad un-mirrored for the axis planes. A flat plane has no turn of its
 *  own; it gets 0. */
export function orientationFromNormal(normal: Vec3): { turn: number; pitch: number } {
  let [x, y, z] = G.normalize(normal);
  if (y < 0) {
    x = -x;
    y = -y;
    z = -z;
  }
  let pitch = snapAngle(deg(Math.atan2(Math.hypot(x, z), y))); // 0 flat … 90 upright
  if (pitch >= 90) {
    pitch = 90;
    if (z < -1e-3 || (Math.abs(z) <= 1e-3 && x > 0)) {
      x = -x;
      z = -z;
    }
  }
  const turn = pitch === 0 ? 0 : snapAngle(wrapDeg(deg(Math.atan2(-x, z))));
  return { turn, pitch };
}

// --- pad pixels ↔ plane metres ---

/** How the pad's pixels map onto its plane: `size` metres across `width` px, anchored at
 *  the bottom-centre on a pitched plane and at the centre on a flat one. */
export interface PadView {
  width: number;
  height: number;
  size: number;
  flat: boolean;
}

export function padToPlane([sx, sy]: Pt2, v: PadView): Pt2 {
  const k = v.size / v.width;
  return [(sx - v.width / 2) * k, (v.flat ? v.height / 2 - sy : v.height - sy) * k];
}

export function planeToPad([a, b]: Pt2 | Vec3, v: PadView): Pt2 {
  const k = v.width / v.size;
  return [a * k + v.width / 2, v.flat ? v.height / 2 - b * k : v.height - b * k];
}

/** The pad's four corners, placed on its plane in the world (the 3D view's ghost outline). */
export function padOutline(v: PadView, f: Frame): Vec3[] {
  const corners: Pt2[] = [[0, 0], [v.width, 0], [v.width, v.height], [0, v.height]];
  return corners.map((s) => {
    const [a, b] = padToPlane(s, v);
    return planeToWorld([a, b, 0], f);
  });
}

export const mm = (v: number) => Math.round(v * 1000) / 1000 + 0; // round to mm; "+ 0" drops -0
export const roundMm = (p: Vec3): Vec3 => [mm(p[0]), mm(p[1]), mm(p[2])];

export interface PadMapping {
  width: number; // pad size in px
  height: number;
  size: number; // metres spanned by the pad's width
  plane: DrawPlane | PlanePreset;
}

/** Map a pad pixel (origin top-left, y down) to metres on a plane, rounded to the mm. On the
 *  elevation (xy) and side (yz) presets the pad's bottom edge is the ground (y = 0), so a
 *  drawn arch stands on it; the plan (xz) is centred both ways, with screen-down toward +z. */
export function padToWorld(s: Pt2, m: PadMapping): Vec3 {
  const pl = typeof m.plane === "string" ? presetPlane(m.plane) : m.plane;
  const [a, b] = padToPlane(s, { width: m.width, height: m.height, size: m.size, flat: isFlat(pl) });
  return roundMm(planeToWorld([a, b, 0], planeFrame(pl)));
}

// --- stroke simplification ---

/** Distance from p to the segment a–b. */
function segDist(p: Pt2, a: Pt2, b: Pt2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer–Douglas–Peucker: keep only the points that deviate more than `epsilon` from the
 *  simplified line, so a jittery hand stroke becomes a handful of clean control points.
 *  Iterative, so long strokes can't overflow the stack. */
export function simplify(pts: Pt2[], epsilon: number): Pt2[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxD = -1, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segDist(pts[i], pts[s], pts[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > epsilon) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** A stroke → the control points of a spline on the chosen plane. */
export function strokeToPoints(stroke: Pt2[], m: PadMapping, epsilonPx: number): Vec3[] {
  return simplify(stroke, epsilonPx).map((p) => padToWorld(p, m));
}

/** Points in the spline node's `pts` text format (one `x, y, z` per line, to the mm). */
export function formatPoints(pts: Vec3[], note = "drawn freehand"): string {
  return [`# x, y, z per line — ${note}`, ...pts.map((p) => roundMm(p).join(", "))].join("\n");
}

// --- fitting a plane to existing points ---

/** Eigen-decomposition of a symmetric 3×3 matrix by cyclic Jacobi rotations; eigenpairs
 *  come back smallest eigenvalue first, with unit eigenvectors. */
function symEigen3(m: number[][]): { value: number; vector: Vec3 }[] {
  const a = m.map((r) => r.slice());
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 32; sweep++) {
    const off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
    const diag = Math.abs(a[0][0]) + Math.abs(a[1][1]) + Math.abs(a[2][2]);
    if (off <= 1e-15 * diag || off < 1e-300) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      const apq = a[p][q];
      if (Math.abs(apq) < 1e-300) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * apq);
      const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      a[p][p] -= t * apq;
      a[q][q] += t * apq;
      a[p][q] = a[q][p] = 0;
      const r = 3 - p - q; // the third index
      const arp = a[r][p], arq = a[r][q];
      a[r][p] = a[p][r] = c * arp - s * arq;
      a[r][q] = a[q][r] = s * arp + c * arq;
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq;
        v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  return [0, 1, 2]
    .map((i) => ({ value: a[i][i], vector: [v[0][i], v[1][i], v[2][i]] as Vec3 }))
    .sort((x, y) => x.value - y.value);
}

export interface PlaneFit {
  normal: Vec3; // unit
  centroid: Vec3;
  deviation: number; // farthest any point lies off the plane (m)
  planar: boolean; // every point within the tolerance
}

/** Best-fit plane through a point set: least squares, i.e. the covariance's weakest axis.
 *  Points on one line don't fix a plane, so they get the upright plane containing the line
 *  (the elevation plane if the line is vertical) — what you'd sketch a beam or post on. */
export function fitPlane(pts: Vec3[], tol = 0.002): PlaneFit {
  const n = pts.length;
  if (n === 0) return { normal: [0, 0, 1], centroid: [0, 0, 0], deviation: 0, planar: true };
  const c = pts.reduce<Vec3>((acc, p) => G.add(acc, G.scale(p, 1 / n)), [0, 0, 0]);
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) {
    const d = G.sub(p, c);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += d[i] * d[j];
  }
  const [least, mid, most] = symEigen3(m);
  const rms = (e: { value: number }) => Math.sqrt(Math.max(0, e.value) / n);
  let normal: Vec3;
  if (rms(most) < tol / 2) {
    normal = [0, 0, 1]; // every point in one spot
  } else if (rms(mid) < tol / 2) {
    const dir = G.normalize(most.vector);
    normal = Math.abs(dir[1]) > 0.999 ? [0, 0, 1] : G.normalize(G.cross(dir, [0, 1, 0]));
  } else {
    normal = G.normalize(least.vector);
  }
  const deviation = Math.max(...pts.map((p) => Math.abs(G.dot(G.sub(p, c), normal))));
  return { normal, centroid: c, deviation, planar: deviation <= tol };
}

export interface PadFit {
  plane: DrawPlane;
  size: number; // pad width (m) that shows the whole curve
  pts: Vec3[]; // the points in plane coordinates (a, b, c)
  planar: boolean;
}

/** Put existing control points on the pad: fit their plane, anchor it where it keeps context
 *  (on the ground under an upright curve standing at or a little above it, else at the
 *  curve's foot; centred for a flat plane), and zoom to show the whole curve. Each point
 *  keeps its offset `c` off the plane, so a curve that isn't quite flat round-trips intact.
 *  `aspect` is the pad's height / width. */
export function fitToPad(world: Vec3[], aspect: number): PadFit {
  const fit = fitPlane(world);
  const { turn, pitch } = orientationFromNormal(fit.normal);
  const f0 = planeFrame({ origin: fit.centroid, turn, pitch });
  const q = world.map((p) => worldToPlane(p, f0));
  const as = q.map((p) => p[0]), bs = q.map((p) => p[1]);
  const aMin = Math.min(...as), aMax = Math.max(...as);
  const bMin = Math.min(...bs), bMax = Math.max(...bs);
  const flat = Math.abs(pitch) < 1e-6;
  let b0 = (bMin + bMax) / 2;
  if (!flat) {
    // Up the pad from the centroid to where the plane meets the ground (v·y = sin pitch > 0).
    const bGround = -fit.centroid[1] / f0.v[1];
    const lift = bMin - bGround;
    b0 = lift >= -1e-6 && lift <= Math.max(4, 2 * (bMax - bMin)) ? bGround : bMin;
  }
  const plane: DrawPlane = { origin: roundMm(planeToWorld([(aMin + aMax) / 2, b0, 0], f0)), turn, pitch };
  const f = planeFrame(plane);
  const pts = world.map((p) => worldToPlane(p, f));
  const halfW = Math.max(...pts.map((p) => Math.abs(p[0])));
  const tall = flat ? 2 * Math.max(...pts.map((p) => Math.abs(p[1]))) : Math.max(0, ...pts.map((p) => p[1]));
  const need = Math.max((2 * halfW) / 0.85, tall / (0.85 * aspect), 2);
  return { plane, size: Math.ceil(need * 2) / 2, pts, planar: fit.planar };
}

// --- editing a control list ---

/** Where a point added at `at` (plane coords a, b) belongs in the control list: in the span
 *  of the spline it lands nearest, so it refines that stretch. Also returns how far `at` is
 *  from the curve (m), so a click well away from it can extend the curve instead. */
export function insertionIndex(
  ctrl: Vec3[],
  closed: boolean,
  smooth: number,
  tension: number,
  at: Pt2,
): { index: number; distance: number } {
  const n = ctrl.length;
  if (n === 0) return { index: 0, distance: Infinity };
  if (n === 1) return { index: 1, distance: Math.hypot(at[0] - ctrl[0][0], at[1] - ctrl[0][1]) };
  const curve = G.polyline(ctrl, closed, smooth, tension).points;
  const between = Math.max(0, Math.floor(smooth));
  const div = between < 1 ? 1 : between + 1; // curve samples per control span
  const spans = closed ? n : n - 1;
  let best = Infinity, span = 0;
  for (let j = 0; j < curve.length - 1; j++) {
    const d = segDist(at, [curve[j][0], curve[j][1]], [curve[j + 1][0], curve[j + 1][1]]);
    if (d < best) {
      best = d;
      span = Math.min(spans - 1, Math.floor(j / div));
    }
  }
  return { index: span + 1, distance: best };
}

/** Rewrite one point of a spline's `pts` text in place: every other line (comments, blank
 *  lines, spacing) stays as the user left it. `index` counts point lines the way
 *  `parsePoints` does; with no such point the text comes back unchanged. */
export function setPointInText(text: string, index: number, p: Vec3): string {
  const lines = String(text ?? "").split("\n");
  let k = -1;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const hash = raw.indexOf("#");
    const body = hash === -1 ? raw : raw.slice(0, hash);
    const nums = body.trim().split(/[,\s]+/).filter(Boolean).map(Number);
    if (nums.length < 3 || !nums.slice(0, 3).every((v) => Number.isFinite(v))) continue;
    if (++k !== index) continue;
    const lead = body.match(/^\s*/)![0];
    const trail = body.match(/\s*$/)![0];
    lines[i] = lead + roundMm(p).join(", ") + trail + (hash === -1 ? "" : raw.slice(hash));
    return lines.join("\n");
  }
  return text;
}

/** A direction as a short label: "+x" when it runs along an axis, else its rounded components. */
export function axisLabel(d: Vec3): string {
  const names = ["x", "y", "z"];
  for (let i = 0; i < 3; i++) if (Math.abs(d[i]) > 0.9999) return `${d[i] > 0 ? "+" : "−"}${names[i]}`;
  return `(${d.map((v) => (Math.round(v * 100) / 100 + 0).toFixed(2)).join(", ")})`;
}
