// Geometry kernel — the mathematical foundation (whitepaper §6a). Pure functions over
// points and curves, plus loft/sweep mesh builders. Framework-agnostic except for the
// mesh builders, which return THREE.BufferGeometry for the live 3D view.
import * as THREE from "three";
import type { Vec3, Curve } from "./types";

// --- vector ops ---
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a: Vec3) => Math.sqrt(dot(a, a));
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export function normalize(a: Vec3): Vec3 {
  const l = len(a);
  return l < 1e-9 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
}
export const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

// --- curve constructors ---
export function line(a: Vec3, b: Vec3, samples = 2): Curve {
  const n = Math.max(2, Math.floor(samples));
  const points: Vec3[] = [];
  for (let i = 0; i < n; i++) points.push(lerp(a, b, i / (n - 1)));
  return { points };
}

export function arc(
  center: Vec3,
  radius: number,
  startDeg: number,
  endDeg: number,
  plane: "xy" | "xz" | "yz",
  samples = 24,
): Curve {
  const n = Math.max(2, Math.floor(samples));
  const a0 = (startDeg * Math.PI) / 180;
  const a1 = (endDeg * Math.PI) / 180;
  const points: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i / (n - 1));
    const c = Math.cos(a) * radius;
    const s = Math.sin(a) * radius;
    let p: Vec3;
    if (plane === "xy") p = [c, s, 0];
    else if (plane === "xz") p = [c, 0, s];
    else p = [0, c, s];
    points.push(add(center, p));
  }
  return { points };
}

/** Closed circle as a polyline. */
export function circle(radius: number, plane: "xy" | "xz" | "yz", seg = 32): Curve {
  const c = arc([0, 0, 0], radius, 0, 360, plane, seg + 1);
  return c;
}

/** Closed rectangle (w along first axis, d along second) as a polyline. */
export function rectangle(w: number, d: number, plane: "xy" | "xz" | "yz"): Curve {
  const hw = w / 2, hd = d / 2;
  const uv: [number, number][] = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd], [-hw, -hd]];
  const points: Vec3[] = uv.map(([a, b]) =>
    plane === "xy" ? [a, b, 0] : plane === "xz" ? [a, 0, b] : [0, a, b],
  );
  return { points };
}

/** Parse a hand-typed point list — one `x, y, z` per line; commas or whitespace separate,
 *  blank lines and `#` comments are ignored. Lines without three finite numbers are skipped. */
export function parsePoints(text: string): Vec3[] {
  const out: Vec3[] = [];
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const n = line.split(/[,\s]+/).filter(Boolean).map(Number);
    if (n.length >= 3 && n.slice(0, 3).every((v) => Number.isFinite(v))) out.push([n[0], n[1], n[2]]);
  }
  return out;
}

/** One point on a uniform Catmull-Rom spline segment p1→p2 (p0,p3 are the neighbours). */
function catmull(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t, t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [
    f(p0[0], p1[0], p2[0], p3[0]),
    f(p0[1], p1[1], p2[1], p3[1]),
    f(p0[2], p1[2], p2[2], p3[2]),
  ];
}

/** A freeform curve through an ordered point list — the whitepaper's Layer-1 "curve"
 *  primitive (§7), the thing that lets a user model forms that have no name (§4). Optionally
 *  closed (the last control point joins the first) and optionally smoothed with a Catmull-Rom
 *  spline so real culm/arch curvature survives rather than a faceted polygon. `smooth` is the
 *  number of samples inserted between each pair of control points (0 = straight segments).
 *  The spline passes through every control point. */
export function polyline(pts: Vec3[], closed = false, smooth = 0): Curve {
  const ctrl = pts.slice();
  if (ctrl.length < 2) return { points: ctrl };
  const between = Math.max(0, Math.floor(smooth));
  if (between < 1) return { points: closed ? [...ctrl, ctrl[0]] : ctrl };

  const n = ctrl.length;
  const div = between + 1;
  const P = (i: number): Vec3 =>
    closed ? ctrl[((i % n) + n) % n] : ctrl[Math.min(n - 1, Math.max(0, i))];
  const points: Vec3[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let s = 0; s < div; s++) points.push(catmull(p0, p1, p2, p3, s / div));
  }
  points.push(closed ? P(0) : P(n - 1));
  return { points };
}

/** Extrude points into straight lines (columns/posts) of a given height along an axis. */
export function extrudePoints(points: Vec3[], height: number, axis: "x" | "y" | "z"): Curve[] {
  const dir: Vec3 = axis === "x" ? [height, 0, 0] : axis === "z" ? [0, 0, height] : [0, height, 0];
  return points.map((p) => ({ points: [p, add(p, dir)] }));
}

/** Ruled loft between two rail curves: N straight generators connecting matching
 *  divisions of each rail. Strip/culm-swept, this makes lofted shells and gridshells. */
export function loftCurves(a: Curve, b: Curve, count: number): Curve[] {
  const pa = divide(a, count);
  const pb = divide(b, count);
  const n = Math.min(pa.length, pb.length);
  const out: Curve[] = [];
  for (let i = 0; i < n; i++) out.push({ points: [pa[i], pb[i]] });
  return out;
}

/** A parallel copy of a curve, offset a perpendicular distance within a plane — the inner
 *  layer of a double-layer gridshell, or a run of cladding lines. Each point moves along
 *  the in-plane normal to the local tangent (cross of tangent and the plane normal); where
 *  the tangent runs along the plane normal there is no in-plane offset, so that point holds. */
export function offsetCurve(curve: Curve, distance: number, plane: "xy" | "xz" | "yz"): Curve {
  const pts = curve.points;
  if (pts.length < 2) return { points: pts.slice() };
  const nrm: Vec3 = plane === "xy" ? [0, 0, 1] : plane === "xz" ? [0, 1, 0] : [1, 0, 0];
  const out: Vec3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const tan = normalize(sub(next, prev));
    const dir = cross(tan, nrm);
    const d = len(dir) < 1e-9 ? ([0, 0, 0] as Vec3) : normalize(dir);
    out.push(add(pts[i], scale(d, distance)));
  }
  return { points: out };
}

/** A woven lattice: `u` warp lines crossing `v` weft lines over a w×h panel, the two
 *  layers offset by `gap` along the plane normal so strips visually interleave. */
export function weaveLattice(
  width: number,
  height: number,
  u: number,
  v: number,
  plane: "xy" | "xz" | "yz",
  gap = 0.03,
): Curve[] {
  const map = (a: number, b: number, c: number): Vec3 =>
    plane === "xy" ? [a, b, c] : plane === "xz" ? [a, c, b] : [c, a, b];
  const hw = width / 2, hh = height / 2;
  const out: Curve[] = [];
  for (let i = 0; i < u; i++) {
    const a = u > 1 ? -hw + width * (i / (u - 1)) : 0;
    out.push({ points: [map(a, -hh, gap), map(a, hh, gap)] });
  }
  for (let j = 0; j < v; j++) {
    const b = v > 1 ? -hh + height * (j / (v - 1)) : 0;
    out.push({ points: [map(-hw, b, -gap), map(hw, b, -gap)] });
  }
  return out;
}

export function mirrorAcross(p: Vec3, plane: "xy" | "xz" | "yz"): Vec3 {
  if (plane === "yz") return [-p[0], p[1], p[2]];
  if (plane === "xz") return [p[0], -p[1], p[2]];
  return [p[0], p[1], -p[2]];
}

export function grid(
  cols: number,
  rows: number,
  spacingX: number,
  spacingY: number,
): Vec3[] {
  const pts: Vec3[] = [];
  const ox = ((cols - 1) * spacingX) / 2;
  const oy = ((rows - 1) * spacingY) / 2;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) pts.push([c * spacingX - ox, 0, r * spacingY - oy]);
  return pts;
}

// --- operations ---
export function curveLength(curve: Curve): number {
  let l = 0;
  for (let i = 1; i < curve.points.length; i++) l += len(sub(curve.points[i], curve.points[i - 1]));
  return l;
}

/** Evenly spaced points along a curve by arc length. */
export function divide(curve: Curve, count: number): Vec3[] {
  const pts = curve.points;
  if (pts.length < 2 || count < 1) return pts.slice();
  const total = curveLength(curve);
  if (total < 1e-9) return Array.from({ length: count }, () => pts[0]);
  const step = total / (count - 1 || 1);
  const out: Vec3[] = [];
  let seg = 0;
  let acc = 0;
  let segLen = len(sub(pts[1], pts[0]));
  for (let i = 0; i < count; i++) {
    const target = i * step;
    while (acc + segLen < target && seg < pts.length - 2) {
      acc += segLen;
      seg++;
      segLen = len(sub(pts[seg + 1], pts[seg]));
    }
    const t = segLen < 1e-9 ? 0 : (target - acc) / segLen;
    out.push(lerp(pts[seg], pts[seg + 1], Math.min(1, Math.max(0, t))));
  }
  return out;
}

/** Angle between two directions, in degrees. */
export function angleBetween(a: Vec3, b: Vec3): number {
  const la = len(a);
  const lb = len(b);
  if (la < 1e-9 || lb < 1e-9) return 0;
  const c = Math.min(1, Math.max(-1, dot(a, b) / (la * lb)));
  return (Math.acos(c) * 180) / Math.PI;
}

/** Point at a given arc length along a curve. */
export function pointAtLength(curve: Curve, target: number): Vec3 {
  const pts = curve.points;
  if (pts.length === 0) return [0, 0, 0];
  if (pts.length < 2) return pts[0];
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const segLen = len(sub(pts[i + 1], pts[i]));
    if (acc + segLen >= target) {
      const t = segLen < 1e-9 ? 0 : (target - acc) / segLen;
      return lerp(pts[i], pts[i + 1], Math.min(1, Math.max(0, t)));
    }
    acc += segLen;
  }
  return pts[pts.length - 1];
}

/** The portion of a curve between two arc-length stations, keeping interior vertices
 *  so curvature survives the cut. */
export function subCurve(curve: Curve, from: number, to: number): Curve {
  const pts = curve.points;
  const out: Vec3[] = [pointAtLength(curve, from)];
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    acc += len(sub(pts[i + 1], pts[i]));
    if (acc > from + 1e-9 && acc < to - 1e-9) out.push(pts[i + 1]);
  }
  out.push(pointAtLength(curve, to));
  return { points: out };
}

/** Diaphragm (node) stations along a culm centreline at a fixed spacing, in metres.
 *  Real culms carry nodes at intervals; §8 keeps that data in the model rather than
 *  treating a culm as a clean tube. */
export function nodeStations(curve: Curve, spacing: number): number[] {
  if (spacing <= 1e-6) return [];
  const total = curveLength(curve);
  const out: number[] = [];
  for (let s = spacing; s < total - 1e-6; s += spacing) out.push(s);
  return out;
}

/** Split a curve at the given arc-length stations — the internode segments between nodes. */
export function splitCurveAtLengths(curve: Curve, stations: number[]): Curve[] {
  const total = curveLength(curve);
  if (total < 1e-9) return [];
  const cuts = [0, ...stations.filter((s) => s > 1e-6 && s < total - 1e-6), total];
  const out: Curve[] = [];
  for (let k = 0; k < cuts.length - 1; k++) out.push(subCurve(curve, cuts[k], cuts[k + 1]));
  return out;
}

/** Closest approach between two 3D segments. Returns the midpoint of that approach when
 *  the two pass within `tol` of each other, else null. Curves in space rarely meet
 *  exactly, so a tolerance is the honest test. */
function segmentApproach(p0: Vec3, p1: Vec3, q0: Vec3, q1: Vec3, tol: number): Vec3 | null {
  const u = sub(p1, p0);
  const v = sub(q1, q0);
  const w = sub(p0, q0);
  const a = dot(u, u), b = dot(u, v), c = dot(v, v), d = dot(u, w), e = dot(v, w);
  const den = a * c - b * b;
  let s: number, t: number;
  if (Math.abs(den) < 1e-12) {
    // Parallel (or degenerate): fall back to projecting one start point onto the other.
    s = 0;
    t = c < 1e-12 ? 0 : e / c;
  } else {
    s = (b * e - c * d) / den;
    t = (a * e - b * d) / den;
  }
  s = Math.min(1, Math.max(0, s));
  t = Math.min(1, Math.max(0, t));
  const pa = add(p0, scale(u, s));
  const qa = add(q0, scale(v, t));
  if (len(sub(pa, qa)) > tol) return null;
  return scale(add(pa, qa), 0.5);
}

/** Intersection points between two sets of curves (whitepaper §7 Layer 1 `intersect`).
 *  Coincident hits within `tol` collapse to one point. */
export function intersectCurves(a: Curve[], b: Curve[], tol: number): Vec3[] {
  const out: Vec3[] = [];
  for (const ca of a) {
    for (let i = 0; i < ca.points.length - 1; i++) {
      for (const cb of b) {
        for (let j = 0; j < cb.points.length - 1; j++) {
          const hit = segmentApproach(ca.points[i], ca.points[i + 1], cb.points[j], cb.points[j + 1], tol);
          if (hit && !out.some((o) => len(sub(o, hit)) < tol)) out.push(hit);
        }
      }
    }
  }
  return out;
}

export function rotatePoint(p: Vec3, rxDeg: number, ryDeg: number, rzDeg: number): Vec3 {
  const rx = (rxDeg * Math.PI) / 180;
  const ry = (ryDeg * Math.PI) / 180;
  const rz = (rzDeg * Math.PI) / 180;
  let [x, y, z] = p;
  // X
  let cy = Math.cos(rx), sy = Math.sin(rx);
  [y, z] = [y * cy - z * sy, y * sy + z * cy];
  // Y
  cy = Math.cos(ry); sy = Math.sin(ry);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];
  // Z
  cy = Math.cos(rz); sy = Math.sin(rz);
  [x, y] = [x * cy - y * sy, x * sy + y * cy];
  return [x, y, z];
}

export function transformPoint(
  p: Vec3,
  t: Vec3,
  rot: Vec3,
  s: Vec3,
): Vec3 {
  const scaled: Vec3 = [p[0] * s[0], p[1] * s[1], p[2] * s[2]];
  const rotated = rotatePoint(scaled, rot[0], rot[1], rot[2]);
  return add(rotated, t);
}

export const transformCurve = (c: Curve, t: Vec3, rot: Vec3, s: Vec3): Curve => ({
  points: c.points.map((p) => transformPoint(p, t, rot, s)),
});

// --- loft / sweep: parallel-transport frames along a curve ---
function frames(pts: Vec3[]): { tangents: Vec3[]; normals: Vec3[]; binormals: Vec3[] } {
  const n = pts.length;
  const tangents: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    if (i < n - 1) tangents.push(normalize(sub(pts[i + 1], pts[i])));
    else tangents.push(tangents[i - 1] ?? [0, 0, 1]);
  }
  // initial normal perpendicular to first tangent
  const t0 = tangents[0];
  let up: Vec3 = Math.abs(t0[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  let normal = normalize(cross(up, t0));
  const normals: Vec3[] = [];
  const binormals: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    // parallel transport: re-orthogonalize previous normal against current tangent
    const t = tangents[i];
    normal = normalize(sub(normal, scale(t, dot(normal, t))));
    if (len(normal) < 1e-6) normal = normalize(cross(up, t));
    const binormal = normalize(cross(t, normal));
    normals.push(normal);
    binormals.push(binormal);
    up = normal;
  }
  return { tangents, normals, binormals };
}

/** Tapered hollow-looking tube along a curve (culm). Radii in metres. */
export function tubeGeometry(
  curve: Curve,
  startRadius: number,
  endRadius: number,
  radialSegments = 10,
): THREE.BufferGeometry {
  const pts = curve.points;
  const n = pts.length;
  const { normals, binormals } = frames(pts);
  const positions: number[] = [];
  const normalsArr: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = startRadius + (endRadius - startRadius) * (i / (n - 1 || 1));
    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2;
      const dir = add(scale(normals[i], Math.cos(a)), scale(binormals[i], Math.sin(a)));
      const v = add(pts[i], scale(dir, r));
      positions.push(v[0], v[1], v[2]);
      normalsArr.push(dir[0], dir[1], dir[2]);
    }
  }
  const ring = radialSegments + 1;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ring + j;
      const b = (i + 1) * ring + j;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normalsArr, 3));
  geo.setIndex(indices);
  return geo;
}

/** Flat ribbon (strip) swept along a curve — width along the frame normal, thickness along binormal. */
export function stripGeometry(
  curve: Curve,
  width: number,
  thickness: number,
): THREE.BufferGeometry {
  const pts = curve.points;
  const n = pts.length;
  const { normals, binormals } = frames(pts);
  const hw = width / 2;
  const ht = thickness / 2;
  const corners: [number, number][] = [
    [-hw, -ht],
    [hw, -ht],
    [hw, ht],
    [-hw, ht],
  ];
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    for (const [w, t] of corners) {
      const v = add(pts[i], add(scale(normals[i], w), scale(binormals[i], t)));
      positions.push(v[0], v[1], v[2]);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k;
      const b = i * 4 + ((k + 1) % 4);
      const c = (i + 1) * 4 + k;
      const d = (i + 1) * 4 + ((k + 1) % 4);
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
