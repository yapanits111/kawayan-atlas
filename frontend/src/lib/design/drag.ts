// Dragging a spline's control points in the 3D view: which plane a point slides in, and
// where a pointer ray puts it. Plain vector maths (no three.js), so it is unit-testable.
import type { Vec3 } from "./types";
import * as G from "./geometry";

export interface DragPlane {
  normal: Vec3;
  point: Vec3;
}

/** How dragged points snap — shared by the 3D handles and the draw pad. */
export interface SnapSettings {
  grid: boolean;
  step: number; // m
  points: boolean; // to member ends, joints, other control points (3D only)
}

export const DEFAULT_SNAP: SnapSettings = { grid: false, step: 0.1, points: true };
export const SNAP_STEPS = [0.05, 0.1, 0.25, 0.5, 1];

/** The plane a grabbed control point slides in. A flat curve keeps its points in its own
 *  plane; any other curve slides them horizontally. `vertical` (Shift) switches to a
 *  vertical plane facing the camera, from which only the height is read. */
export function dragPlane(point: Vec3, curveNormal: Vec3 | null, vertical: boolean, viewDir: Vec3): DragPlane {
  if (vertical) {
    const facing: Vec3 = [viewDir[0], 0, viewDir[2]];
    return { normal: G.len(facing) < 1e-6 ? [0, 0, 1] : G.normalize(facing), point };
  }
  return { normal: curveNormal ? G.normalize(curveNormal) : [0, 1, 0], point };
}

/** Where a ray meets the plane — or null when it points away, or runs so nearly parallel
 *  to the plane that the hit would fling the point towards the horizon. */
export function rayPlane(origin: Vec3, dir: Vec3, pl: DragPlane): Vec3 | null {
  const d = G.normalize(dir);
  const denom = G.dot(d, pl.normal);
  if (Math.abs(denom) < 0.02) return null;
  const t = G.dot(G.sub(pl.point, origin), pl.normal) / denom;
  return t < 0 ? null : G.add(origin, G.scale(d, t));
}

/** Snap a point on a plane to a grid laid out in that plane: its right axis runs horizontal
 *  (along x on the elevation and plan planes, along z on the side plane), and the grid is
 *  anchored where the plane passes closest to the world origin. On the axis planes that is
 *  simply the world grid; on a turned or tilted plane the snapped point stays on the plane. */
export function snapInPlane(p: Vec3, normal: Vec3, step: number): Vec3 {
  const n = G.normalize(normal);
  let u = G.cross([0, 1, 0], n);
  u = G.len(u) < 1e-6 ? [1, 0, 0] : G.normalize(u);
  const v = G.cross(n, u);
  const o = G.scale(n, G.dot(n, p)); // the plane's point nearest the origin
  const d = G.sub(p, o);
  const r = (x: number) => Math.round(x / step) * step;
  return G.add(o, G.add(G.scale(u, r(G.dot(d, u))), G.scale(v, r(G.dot(d, v)))));
}

/** Snap only a point's height — for straight up/down drags. */
export const snapHeight = (p: Vec3, step: number): Vec3 => [p[0], Math.round(p[1] / step) * step, p[2]];

export interface SnapTarget {
  p: Vec3;
  label: string; // what it is, for the on-screen tag: "C3 end", "joint J2", "point 4"
}

/** The target nearest `at` on screen, if one is within `radius` px. `toScreen` projects a world
 *  point to pixels (null when it is behind the camera). */
export function nearestTarget(
  at: Vec3,
  targets: SnapTarget[],
  toScreen: (p: Vec3) => [number, number] | null,
  radius: number,
): SnapTarget | null {
  const s = toScreen(at);
  if (!s) return null;
  let best: SnapTarget | null = null;
  let bestD = Infinity;
  for (const t of targets) {
    const q = toScreen(t.p);
    if (!q) continue;
    const d = Math.hypot(q[0] - s[0], q[1] - s[1]);
    if (d <= radius && d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

/** Where a dragged point lands for a pointer ray: the ray's hit on the drag plane, shifted by
 *  where on the handle it was grabbed. A vertical drag keeps the point's x and z. Returns null
 *  when there is no usable hit (or it would move the point absurdly far). */
export function dragTo(
  origin: Vec3,
  dir: Vec3,
  pl: DragPlane,
  grab: Vec3,
  start: Vec3,
  vertical: boolean,
): Vec3 | null {
  const hit = rayPlane(origin, dir, pl);
  if (!hit) return null;
  const p = G.add(hit, grab);
  const out: Vec3 = vertical ? [start[0], p[1], start[2]] : p;
  return G.len(G.sub(out, start)) > 500 ? null : out;
}
