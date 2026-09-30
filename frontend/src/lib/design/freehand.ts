// Freehand drawing → spline control points (the Design Lab's Draw tool). A stroke is
// captured in pad pixels, thinned to its shape-defining points, and mapped onto a plane in
// metres, ready to become the `pts` of a spline (`polyline`) node.
import type { Vec3 } from "./types";

export type Plane = "xy" | "xz" | "yz";
export type Pt2 = [number, number];

export interface PadMapping {
  width: number; // pad size in px
  height: number;
  size: number; // metres spanned by the pad's width
  plane: Plane;
}

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

const mm = (v: number) => Math.round(v * 1000) / 1000 + 0; // round to mm; "+ 0" drops -0

/** Map a pad pixel (origin top-left, y down) to metres on a plane. The pad's width spans
 *  `size` metres, centred on the origin. On the upright planes (xy elevation, yz side) the
 *  pad's bottom edge is the ground (y = 0), so a drawn arch stands on it; the plan plane
 *  (xz) is centred both ways, with screen-down running toward +z. */
export function padToWorld([sx, sy]: Pt2, m: PadMapping): Vec3 {
  const k = m.size / m.width;
  const u = mm((sx - m.width / 2) * k);
  if (m.plane === "xz") return [u, 0, mm((sy - m.height / 2) * k)];
  const up = mm((m.height - sy) * k);
  return m.plane === "xy" ? [u, up, 0] : [0, up, u];
}

/** A stroke → the control points of a spline on the chosen plane. */
export function strokeToPoints(stroke: Pt2[], m: PadMapping, epsilonPx: number): Vec3[] {
  return simplify(stroke, epsilonPx).map((p) => padToWorld(p, m));
}

/** Points in the spline node's `pts` text format (one `x, y, z` per line). */
export function formatPoints(pts: Vec3[]): string {
  return ["# x, y, z per line — drawn freehand", ...pts.map((p) => p.join(", "))].join("\n");
}
