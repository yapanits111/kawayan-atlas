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
