// Node registry — every node's inputs, outputs, params, and compute (whitepaper §7).
import type { Vec3, Curve, Element, Joint, PortKind, Schedule, ScheduleRow } from "./types";
import * as G from "./geometry";

export interface ParamDef {
  key: string;
  label: string;
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[]; // present => select
}
export interface PortDef {
  id: string;
  label: string;
  kind: PortKind;
}
export interface NodeDef {
  type: string;
  label: string;
  category: "Geometry" | "Bamboo" | "Output";
  inputs: PortDef[];
  outputs: PortDef[];
  params: ParamDef[];
  compute: (inputs: Record<string, unknown>, p: Record<string, number | string>) => Record<string, unknown>;
}

// --- coercion helpers ---
function isVec3(v: unknown): v is Vec3 {
  return Array.isArray(v) && v.length === 3 && typeof v[0] === "number";
}
function pointsToSegments(pts: Vec3[]): Curve[] {
  const out: Curve[] = [];
  for (let i = 0; i < pts.length - 1; i++) out.push({ points: [pts[i], pts[i + 1]] });
  return out;
}
function asCurves(v: unknown): Curve[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    if (v.length === 0) return [];
    if (isVec3(v[0])) return pointsToSegments(v as Vec3[]);
    if ((v[0] as Curve)?.points) return v as Curve[];
    return [];
  }
  if ((v as Curve).points) return [v as Curve];
  return [];
}
function asElements(v: unknown): Element[] {
  if (Array.isArray(v) && v.length && (v[0] as Element)?.kind) return v as Element[];
  return [];
}
const num = (p: Record<string, number | string>, k: string) => Number(p[k]);

// --- node definitions ---
export const NODE_DEFS: Record<string, NodeDef> = {
  line: {
    type: "line", label: "Line", category: "Geometry",
    inputs: [], outputs: [{ id: "out", label: "curve", kind: "curve" }],
    params: [
      { key: "ax", label: "A.x", default: -2, step: 0.1 }, { key: "ay", label: "A.y", default: 0, step: 0.1 }, { key: "az", label: "A.z", default: 0, step: 0.1 },
      { key: "bx", label: "B.x", default: 2, step: 0.1 }, { key: "by", label: "B.y", default: 0, step: 0.1 }, { key: "bz", label: "B.z", default: 0, step: 0.1 },
    ],
    compute: (_i, p) => ({ out: G.line([num(p, "ax"), num(p, "ay"), num(p, "az")], [num(p, "bx"), num(p, "by"), num(p, "bz")], 2) }),
  },
  arc: {
    type: "arc", label: "Arc", category: "Geometry",
    inputs: [], outputs: [{ id: "out", label: "curve", kind: "curve" }],
    params: [
      { key: "radius", label: "radius", default: 3, min: 0.1, step: 0.1 },
      { key: "start", label: "start°", default: 0, step: 5 },
      { key: "end", label: "end°", default: 180, step: 5 },
      { key: "plane", label: "plane", default: "xz", options: ["xy", "xz", "yz"] },
      { key: "samples", label: "samples", default: 24, min: 2, max: 128, step: 1 },
    ],
    compute: (_i, p) => ({ out: G.arc([0, 0, 0], num(p, "radius"), num(p, "start"), num(p, "end"), p.plane as "xy" | "xz" | "yz", num(p, "samples")) }),
  },
  grid: {
    type: "grid", label: "Grid", category: "Geometry",
    inputs: [], outputs: [{ id: "out", label: "points", kind: "points" }],
    params: [
      { key: "cols", label: "cols", default: 4, min: 1, max: 40, step: 1 },
      { key: "rows", label: "rows", default: 4, min: 1, max: 40, step: 1 },
      { key: "sx", label: "spacing X", default: 1, min: 0.1, step: 0.1 },
      { key: "sy", label: "spacing Y", default: 1, min: 0.1, step: 0.1 },
    ],
    compute: (_i, p) => ({ out: G.grid(num(p, "cols"), num(p, "rows"), num(p, "sx"), num(p, "sy")) }),
  },
  circle: {
    type: "circle", label: "Circle", category: "Geometry",
    inputs: [], outputs: [{ id: "out", label: "curve", kind: "curve" }],
    params: [
      { key: "radius", label: "radius", default: 2, min: 0.1, step: 0.1 },
      { key: "plane", label: "plane", default: "xz", options: ["xy", "xz", "yz"] },
      { key: "seg", label: "segments", default: 32, min: 3, max: 128, step: 1 },
    ],
    compute: (_i, p) => ({ out: G.circle(num(p, "radius"), p.plane as "xy" | "xz" | "yz", num(p, "seg")) }),
  },
  rectangle: {
    type: "rectangle", label: "Rectangle", category: "Geometry",
    inputs: [], outputs: [{ id: "out", label: "curve", kind: "curve" }],
    params: [
      { key: "w", label: "width", default: 3, min: 0.1, step: 0.1 },
      { key: "d", label: "depth", default: 3, min: 0.1, step: 0.1 },
      { key: "plane", label: "plane", default: "xz", options: ["xy", "xz", "yz"] },
    ],
    compute: (_i, p) => ({ out: G.rectangle(num(p, "w"), num(p, "d"), p.plane as "xy" | "xz" | "yz") }),
  },
  extrude: {
    type: "extrude", label: "Extrude (posts)", category: "Geometry",
    inputs: [{ id: "in", label: "points", kind: "points" }],
    outputs: [{ id: "out", label: "curves", kind: "curves" }],
    params: [
      { key: "height", label: "height", default: 2.5, step: 0.1 },
      { key: "axis", label: "axis", default: "y", options: ["x", "y", "z"] },
    ],
    compute: (i, p) => {
      const v = i.in;
      const pts = Array.isArray(v) && v.length && isVec3(v[0]) ? (v as Vec3[]) : [];
      return { out: G.extrudePoints(pts, num(p, "height"), p.axis as "x" | "y" | "z") };
    },
  },
  mirror: {
    type: "mirror", label: "Mirror", category: "Geometry",
    inputs: [{ id: "in", label: "geometry", kind: "curves" }],
    outputs: [{ id: "out", label: "geometry", kind: "curves" }],
    params: [{ key: "plane", label: "plane", default: "yz", options: ["xy", "xz", "yz"] }],
    compute: (i, p) => {
      const plane = p.plane as "xy" | "xz" | "yz";
      const els = asElements(i.in);
      if (els.length)
        return { out: els.map((e) => ({ ...e, id: `${e.id}m`, curve: { points: e.curve.points.map((pt) => G.mirrorAcross(pt, plane)) } })) };
      const curves = asCurves(i.in);
      return { out: curves.map((c) => ({ points: c.points.map((pt) => G.mirrorAcross(pt, plane)) })) };
    },
  },
  divide: {
    type: "divide", label: "Divide", category: "Geometry",
    inputs: [{ id: "in", label: "curve", kind: "curve" }],
    outputs: [{ id: "out", label: "points", kind: "points" }],
    params: [{ key: "count", label: "count", default: 6, min: 1, max: 200, step: 1 }],
    compute: (i, p) => {
      const c = asCurves(i.in)[0];
      return { out: c ? G.divide(c, num(p, "count")) : [] };
    },
  },
  transform: {
    type: "transform", label: "Transform", category: "Geometry",
    inputs: [{ id: "in", label: "geometry", kind: "curves" }],
    outputs: [{ id: "out", label: "geometry", kind: "curves" }],
    params: [
      { key: "tx", label: "move X", default: 0, step: 0.1 }, { key: "ty", label: "move Y", default: 0, step: 0.1 }, { key: "tz", label: "move Z", default: 0, step: 0.1 },
      { key: "rx", label: "rot X°", default: 0, step: 5 }, { key: "ry", label: "rot Y°", default: 0, step: 5 }, { key: "rz", label: "rot Z°", default: 0, step: 5 },
      { key: "s", label: "scale", default: 1, min: 0.01, step: 0.05 },
    ],
    compute: (i, p) => {
      const t: Vec3 = [num(p, "tx"), num(p, "ty"), num(p, "tz")];
      const r: Vec3 = [num(p, "rx"), num(p, "ry"), num(p, "rz")];
      const s: Vec3 = [num(p, "s"), num(p, "s"), num(p, "s")];
      const els = asElements(i.in);
      if (els.length) return { out: els.map((e) => transformElement(e, t, r, s)) };
      const curves = asCurves(i.in);
      return { out: curves.map((c) => G.transformCurve(c, t, r, s)) };
    },
  },
  arrayLinear: {
    type: "arrayLinear", label: "Array (linear)", category: "Geometry",
    inputs: [{ id: "in", label: "item", kind: "curves" }],
    outputs: [{ id: "out", label: "items", kind: "curves" }],
    params: [
      { key: "count", label: "count", default: 3, min: 1, max: 100, step: 1 },
      { key: "dx", label: "step X", default: 0, step: 0.1 }, { key: "dy", label: "step Y", default: 0, step: 0.1 }, { key: "dz", label: "step Z", default: 1, step: 0.1 },
    ],
    compute: (i, p) => replicate(i.in, num(p, "count"), (k) => ({ t: [num(p, "dx") * k, num(p, "dy") * k, num(p, "dz") * k] as Vec3, r: [0, 0, 0] })),
  },
  arrayPolar: {
    type: "arrayPolar", label: "Array (polar)", category: "Geometry",
    inputs: [{ id: "in", label: "item", kind: "curves" }],
    outputs: [{ id: "out", label: "items", kind: "curves" }],
    params: [
      { key: "count", label: "count", default: 6, min: 1, max: 100, step: 1 },
      { key: "total", label: "sweep°", default: 360, step: 15 },
      { key: "axis", label: "axis", default: "y", options: ["x", "y", "z"] },
    ],
    compute: (i, p) => {
      const count = num(p, "count");
      const total = num(p, "total");
      const axis = p.axis as string;
      return replicate(i.in, count, (k) => {
        const ang = (total / (count > 1 ? count : 1)) * k;
        const r: Vec3 = axis === "x" ? [ang, 0, 0] : axis === "z" ? [0, 0, ang] : [0, ang, 0];
        return { t: [0, 0, 0], r };
      });
    },
  },
  culm: {
    type: "culm", label: "Culm", category: "Bamboo",
    inputs: [{ id: "in", label: "curve/points", kind: "curves" }],
    outputs: [{ id: "out", label: "elements", kind: "elements" }],
    params: [
      { key: "d0", label: "Ø start (mm)", default: 90, min: 5, step: 1 },
      { key: "d1", label: "Ø end (mm)", default: 75, min: 5, step: 1 },
      { key: "wall", label: "wall (mm)", default: 12, min: 1, step: 1 },
    ],
    compute: (i, p) => {
      const curves = asCurves(i.in);
      const out: Element[] = curves.map((c, idx) => ({
        id: `C${idx + 1}`, kind: "culm", curve: c, length: G.curveLength(c),
        startDiameter: num(p, "d0"), endDiameter: num(p, "d1"), wallThickness: num(p, "wall"),
        cutAngleStart: 90, cutAngleEnd: 90,
      }));
      return { out };
    },
  },
  strip: {
    type: "strip", label: "Strip", category: "Bamboo",
    inputs: [{ id: "in", label: "curve/points", kind: "curves" }],
    outputs: [{ id: "out", label: "elements", kind: "elements" }],
    params: [
      { key: "w", label: "width (mm)", default: 25, min: 2, step: 1 },
      { key: "t", label: "thick (mm)", default: 6, min: 1, step: 1 },
    ],
    compute: (i, p) => {
      const curves = asCurves(i.in);
      const out: Element[] = curves.map((c, idx) => ({
        id: `S${idx + 1}`, kind: "strip", curve: c, length: G.curveLength(c),
        width: num(p, "w"), thickness: num(p, "t"),
      }));
      return { out };
    },
  },
  joint: {
    type: "joint", label: "Joint", category: "Bamboo",
    inputs: [{ id: "in", label: "elements", kind: "elements" }],
    outputs: [
      { id: "out", label: "elements", kind: "elements" },
      { id: "joints", label: "joints", kind: "joints" },
    ],
    params: [{ key: "tol", label: "tolerance (m)", default: 0.05, min: 0.001, step: 0.01 }],
    compute: (i, p) => {
      const els = asElements(i.in);
      const tol = num(p, "tol");
      const ends: Vec3[] = [];
      for (const e of els) {
        ends.push(e.curve.points[0]);
        ends.push(e.curve.points[e.curve.points.length - 1]);
      }
      const joints: Joint[] = [];
      const used = new Array(ends.length).fill(false);
      for (let a = 0; a < ends.length; a++) {
        if (used[a]) continue;
        const cluster = [ends[a]];
        used[a] = true;
        for (let b = a + 1; b < ends.length; b++) {
          if (!used[b] && G.len(G.sub(ends[a], ends[b])) < tol) {
            cluster.push(ends[b]);
            used[b] = true;
          }
        }
        if (cluster.length > 1) {
          const c = cluster.reduce((s, v) => G.add(s, v), [0, 0, 0] as Vec3);
          joints.push({ id: `J${joints.length + 1}`, position: G.scale(c, 1 / cluster.length), count: cluster.length });
        }
      }
      return { out: els, joints };
    },
  },
  bundle: {
    type: "bundle", label: "Bundle", category: "Bamboo",
    inputs: [
      { id: "a", label: "elements A", kind: "elements" },
      { id: "b", label: "elements B", kind: "elements" },
    ],
    outputs: [{ id: "out", label: "elements", kind: "elements" }],
    params: [],
    compute: (i) => ({ out: [...asElements(i.a), ...asElements(i.b)] }),
  },
  schedule: {
    type: "schedule", label: "Schedule", category: "Output",
    inputs: [
      { id: "in", label: "elements", kind: "elements" },
      { id: "joints", label: "joints", kind: "joints" },
    ],
    outputs: [{ id: "out", label: "schedule", kind: "schedule" }],
    params: [{ key: "usable", label: "usable culm (m)", default: 6, min: 1, step: 0.5 }],
    compute: (i, p) => {
      const els = asElements(i.in);
      const rows: ScheduleRow[] = els.map((e, idx) => ({
        id: e.id || `E${idx + 1}`,
        kind: e.kind,
        length_m: round(e.length),
        detail:
          e.kind === "culm"
            ? `Ø ${Math.round(e.startDiameter ?? 0)}→${Math.round(e.endDiameter ?? 0)} mm, wall ${Math.round(e.wallThickness ?? 0)} mm`
            : `${Math.round(e.width ?? 0)}×${Math.round(e.thickness ?? 0)} mm`,
        cut_start_deg: e.cutAngleStart,
        cut_end_deg: e.cutAngleEnd,
      }));
      const totalLength = els.reduce((s, e) => s + e.length, 0);
      const schedule: Schedule = {
        rows,
        totals: {
          count: els.length,
          totalLength_m: round(totalLength),
          estCulms: Math.ceil(totalLength / (num(p, "usable") || 6)),
        },
      };
      return { out: schedule };
    },
  },
};

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function transformElement(e: Element, t: Vec3, r: Vec3, s: Vec3): Element {
  const curve = G.transformCurve(e.curve, t, r, s);
  return { ...e, curve, length: G.curveLength(curve) };
}

/** Replicate curves or elements `count` times with a per-copy transform. */
function replicate(
  input: unknown,
  count: number,
  perCopy: (k: number) => { t: Vec3; r: Vec3 },
): Record<string, unknown> {
  const els = asElements(input);
  if (els.length) {
    const out: Element[] = [];
    for (let k = 0; k < count; k++) {
      const { t, r } = perCopy(k);
      for (const e of els) {
        const te = transformElement(e, t, r, [1, 1, 1]);
        out.push({ ...te, id: `${e.id}.${k + 1}` });
      }
    }
    return { out };
  }
  const cs = ((): Curve[] => {
    const v = input;
    if (Array.isArray(v) && v.length && (v[0] as Curve)?.points) return v as Curve[];
    if (v && (v as Curve).points) return [v as Curve];
    if (Array.isArray(v) && v.length && Array.isArray(v[0]) && typeof (v[0] as number[])[0] === "number") {
      // points → segments then replicate
      const segs: Curve[] = [];
      const pts = v as Vec3[];
      for (let idx = 0; idx < pts.length - 1; idx++) segs.push({ points: [pts[idx], pts[idx + 1]] });
      return segs;
    }
    return [];
  })();
  const outC: Curve[] = [];
  for (let k = 0; k < count; k++) {
    const { t, r } = perCopy(k);
    for (const c of cs) outC.push(G.transformCurve(c, t, r, [1, 1, 1]));
  }
  return { out: outC };
}

export const CATEGORIES: NodeDef["category"][] = ["Geometry", "Bamboo", "Output"];
