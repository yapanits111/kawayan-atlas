// Dragging a spline's control points in the 3D view: which plane a point slides in, and
// where a pointer ray puts it. Plain vector maths (no three.js), so it is unit-testable.
import type { Vec3 } from "./types";
import * as G from "./geometry";

export interface DragPlane {
  normal: Vec3;
  point: Vec3;
}

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
