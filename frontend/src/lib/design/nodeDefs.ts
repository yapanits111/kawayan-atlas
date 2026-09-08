// Node registry — every node's inputs, outputs, params, and compute (whitepaper §7).
import type { Vec3, Curve, Element, Joint, JointRow, PortKind, Schedule, ScheduleRow, CheckFlag, CheckResult } from "./types";
import * as G from "./geometry";
import { parsePoles, reconcile } from "./inventory";

export interface ParamDef {
  key: string;
  label: string;
  default: number | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[]; // present => static select
  multiline?: boolean; // present => free-text area (e.g. a pasted pole list)
  dynamic?: "species" | "joints"; // present => select populated at runtime from the API
}
export interface PortDef {
  id: string;
  label: string;
  kind: PortKind;
}
/** Per-evaluation context handed to every node's compute. */
export interface NodeCtx {
  nodeId: string;
  /** Allocates a piece mark unique across the whole graph (C1, C2, … ). Two culm nodes
   *  must not both number from C1 — colliding marks are dropped downstream and pieces
   *  vanish from the cut-list. */
  nextId: (prefix: string) => string;
}

export interface NodeDef {
  type: string;
  label: string;
  category: "Geometry" | "Bamboo" | "Output" | "Analysis";
  inputs: PortDef[];
  outputs: PortDef[];
  params: ParamDef[];
  compute: (
    inputs: Record<string, unknown>,
    p: Record<string, number | string>,
    ctx: NodeCtx,
  ) => Record<string, unknown>;
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
function curvesOf(v: unknown): Curve[] {
  const els = asElements(v);
  if (els.length) return els.map((e) => e.curve);
  return asCurves(v);
}
const num = (p: Record<string, number | string>, k: string) => Number(p[k]);

/** Joint-library ids whose geometry actually cuts the member (a saddle over the mating
 *  culm) rather than butting square against it. */
const MITRE_JOINTS = new Set(["fish-mouth"]);

/** A small worked yard so the node reconciles something the moment it is dropped in.
 *  Format per line: id, length_m, Ø base_mm, Ø tip_mm. */
const DEFAULT_POLES = [
  "# id, length_m, base_mm, tip_mm",
  "P1, 6.0, 105, 82",
  "P2, 6.0, 100, 78",
  "P3, 6.0, 98, 76",
  "P4, 5.5, 95, 74",
  "P5, 5.5, 92, 72",
  "P6, 5.0, 90, 70",
  "P7, 5.0, 88, 68",
  "P8, 4.5, 85, 66",
].join("\n");

// --- node definitions ---
export const NODE_DEFS: Record<string, NodeDef> = {
  point: {
    type: "point", label: "Point", category: "Geometry",
    inputs: [], outputs: [{ id: "out", label: "points", kind: "points" }],
    params: [
      { key: "x", label: "x", default: 0, step: 0.1 },
      { key: "y", label: "y", default: 0, step: 0.1 },
      { key: "z", label: "z", default: 0, step: 0.1 },
    ],
    compute: (_i, p) => ({ out: [[num(p, "x"), num(p, "y"), num(p, "z")] as Vec3] }),
  },
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
  loft: {
    type: "loft", label: "Loft", category: "Geometry",
    inputs: [
      { id: "a", label: "curve A", kind: "curve" },
      { id: "b", label: "curve B", kind: "curve" },
    ],
    outputs: [{ id: "out", label: "curves", kind: "curves" }],
    params: [{ key: "count", label: "count", default: 8, min: 2, max: 100, step: 1 }],
    compute: (i, p) => {
      const a = asCurves(i.a)[0];
      const b = asCurves(i.b)[0];
      if (!a || !b) return { out: [] };
      return { out: G.loftCurves(a, b, num(p, "count")) };
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
  weave: {
    type: "weave", label: "Weave", category: "Geometry",
    inputs: [], outputs: [{ id: "out", label: "curves", kind: "curves" }],
    params: [
      { key: "w", label: "width", default: 3, min: 0.2, step: 0.1 },
      { key: "h", label: "height", default: 2.4, min: 0.2, step: 0.1 },
      { key: "u", label: "warp", default: 8, min: 1, max: 60, step: 1 },
      { key: "v", label: "weft", default: 7, min: 1, max: 60, step: 1 },
      { key: "plane", label: "plane", default: "xy", options: ["xy", "xz", "yz"] },
    ],
    compute: (_i, p) => ({
      out: G.weaveLattice(num(p, "w"), num(p, "h"), num(p, "u"), num(p, "v"), p.plane as "xy" | "xz" | "yz"),
    }),
  },
  intersect: {
    type: "intersect", label: "Intersect", category: "Geometry",
    inputs: [
      { id: "a", label: "curves A", kind: "curves" },
      { id: "b", label: "curves B", kind: "curves" },
    ],
    outputs: [{ id: "out", label: "points", kind: "points" }],
    params: [{ key: "tol", label: "tolerance (m)", default: 0.02, min: 0.001, step: 0.005 }],
    compute: (i, p) => ({ out: G.intersectCurves(curvesOf(i.a), curvesOf(i.b), num(p, "tol")) }),
  },
  culm: {
    type: "culm", label: "Culm", category: "Bamboo",
    inputs: [{ id: "in", label: "curve/points", kind: "curves" }],
    outputs: [{ id: "out", label: "elements", kind: "elements" }],
    params: [
      { key: "species", label: "species", default: "", dynamic: "species" },
      { key: "d0", label: "Ø start (mm)", default: 90, min: 5, step: 1 },
      { key: "d1", label: "Ø end (mm)", default: 75, min: 5, step: 1 },
      { key: "wall", label: "wall (mm)", default: 12, min: 1, step: 1 },
      { key: "nodes", label: "node spacing (m)", default: 0.3, min: 0, step: 0.05 },
    ],
    compute: (i, p, ctx) => {
      const curves = asCurves(i.in);
      const spacing = num(p, "nodes");
      const out: Element[] = curves.map((c) => ({
        id: ctx.nextId("C"), kind: "culm", curve: c, length: G.curveLength(c),
        startDiameter: num(p, "d0"), endDiameter: num(p, "d1"), wallThickness: num(p, "wall"),
        // Taper and node data ride along from the start, so the cut-list reflects real
        // material rather than an idealised cylinder (§8).
        nodeSpacing: spacing,
        nodeCount: spacing > 0 ? G.nodeStations(c, spacing).length : 0,
        verification: "iso22156-round",
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
    compute: (i, p, ctx) => {
      const curves = asCurves(i.in);
      const out: Element[] = curves.map((c) => ({
        id: ctx.nextId("S"), kind: "strip", curve: c, length: G.curveLength(c),
        width: num(p, "w"), thickness: num(p, "t"),
        // A split strip is not a round culm, so ISO 22156 does not reach it (§9).
        verification: "outside-iso22156",
      }));
      return { out };
    },
  },
  internode: {
    type: "internode", label: "Node / internode", category: "Bamboo",
    inputs: [{ id: "in", label: "elements", kind: "elements" }],
    outputs: [
      { id: "out", label: "elements", kind: "elements" },
      { id: "nodes", label: "node points", kind: "points" },
    ],
    params: [
      { key: "spacing", label: "node spacing (m)", default: 0.3, min: 0.02, step: 0.01 },
      { key: "mode", label: "mode", default: "mark", options: ["mark", "split"] },
    ],
    compute: (i, p) => {
      const els = asElements(i.in);
      const spacing = num(p, "spacing");
      const split = p.mode === "split";
      const out: Element[] = [];
      const nodes: Vec3[] = [];
      for (const e of els) {
        // Nodes are a property of round culms; processed stock has none to mark.
        if (e.kind !== "culm") {
          out.push(e);
          continue;
        }
        const stations = G.nodeStations(e.curve, spacing);
        for (const s of stations) nodes.push(G.pointAtLength(e.curve, s));
        if (!split) {
          out.push({ ...e, nodeSpacing: spacing, nodeCount: stations.length });
          continue;
        }
        // Cut the culm at its diaphragms; each internode carries its own share of the taper.
        const segs = G.splitCurveAtLengths(e.curve, stations);
        const total = e.length || 1;
        const d0 = e.startDiameter ?? 0;
        const d1 = e.endDiameter ?? d0;
        let acc = 0;
        segs.forEach((c, k) => {
          const l = G.curveLength(c);
          out.push({
            ...e,
            id: `${e.id}.i${k + 1}`,
            curve: c,
            length: l,
            startDiameter: d0 + (d1 - d0) * (acc / total),
            endDiameter: d0 + (d1 - d0) * ((acc + l) / total),
            nodeSpacing: spacing,
            nodeCount: 0,
          });
          acc += l;
        });
      }
      return { out, nodes };
    },
  },
  laminate: {
    type: "laminate", label: "Laminate (glulam)", category: "Bamboo",
    inputs: [{ id: "in", label: "curve/points", kind: "curves" }],
    outputs: [{ id: "out", label: "elements", kind: "elements" }],
    params: [
      { key: "w", label: "width (mm)", default: 60, min: 5, step: 1 },
      { key: "ply", label: "ply thick (mm)", default: 6, min: 0.5, step: 0.5 },
      { key: "layers", label: "layers", default: 5, min: 2, max: 40, step: 1 },
      { key: "layup", label: "layup", default: "parallel", options: ["parallel", "alternating"] },
    ],
    compute: (i, p, ctx) => {
      const curves = curvesOf(i.in);
      const layers = Math.round(num(p, "layers"));
      const ply = num(p, "ply");
      const dir = String(p.layup);
      const family = dir === "alternating" ? "cross-laminated" : "glue-laminated";
      const out: Element[] = curves.map((c) => ({
        id: ctx.nextId("L"),
        kind: "laminate",
        curve: c,
        length: G.curveLength(c),
        width: num(p, "w"),
        thickness: ply * layers,
        layers,
        layup: `${layers} plies × ${ply} mm, ${dir} (${family})`,
        // ISO 22156:2021 explicitly excludes engineered bamboo — say so (§9).
        verification: "outside-iso22156",
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
    params: [
      { key: "type", label: "type", default: "", dynamic: "joints" },
      { key: "tol", label: "tolerance (m)", default: 0.05, min: 0.001, step: 0.01 },
    ],
    compute: (i, p) => {
      const els = asElements(i.in);
      const tol = num(p, "tol");
      const typeId = String(p.type ?? "");
      // Only saddle (fish-mouth) joints cut the member to the mating culm; the rest are
      // square butts held by a tie, dowel, bolt or strap (§3).
      const mitred = MITRE_JOINTS.has(typeId);

      type End = { el: number; at: "start" | "end"; pos: Vec3; dir: Vec3 };
      const ends: End[] = [];
      els.forEach((e, el) => {
        const pts = e.curve.points;
        if (pts.length < 2) return;
        // Directions point away from the end, so the angle between them is the angle
        // the two members actually make at the joint.
        ends.push({ el, at: "start", pos: pts[0], dir: G.normalize(G.sub(pts[1], pts[0])) });
        ends.push({
          el, at: "end", pos: pts[pts.length - 1],
          dir: G.normalize(G.sub(pts[pts.length - 2], pts[pts.length - 1])),
        });
      });

      const joints: Joint[] = [];
      const cutAt = new Map<string, number>();
      const used = new Array(ends.length).fill(false);
      for (let a = 0; a < ends.length; a++) {
        if (used[a]) continue;
        const cluster = [a];
        used[a] = true;
        for (let b = a + 1; b < ends.length; b++) {
          if (!used[b] && G.len(G.sub(ends[a].pos, ends[b].pos)) < tol) {
            cluster.push(b);
            used[b] = true;
          }
        }
        if (cluster.length < 2) continue;

        const centre = G.scale(
          cluster.reduce((s, k) => G.add(s, ends[k].pos), [0, 0, 0] as Vec3),
          1 / cluster.length,
        );
        // The included angle between the first genuinely divergent pair of members.
        let angle: number | undefined;
        outer: for (let x = 0; x < cluster.length; x++) {
          for (let y = x + 1; y < cluster.length; y++) {
            const ang = G.angleBetween(ends[cluster[x]].dir, ends[cluster[y]].dir);
            if (ang > 1) {
              angle = ang;
              break outer;
            }
          }
        }
        const memberIds = Array.from(new Set(cluster.map((k) => els[ends[k].el].id)));
        joints.push({
          id: `J${joints.length + 1}`,
          position: centre,
          count: cluster.length,
          type: typeId || undefined,
          typeLabel: typeId ? String(p.typeLabel ?? typeId) : undefined,
          angle: angle === undefined ? undefined : Math.round(angle),
          memberIds,
        });
        if (mitred && angle !== undefined) {
          for (const k of cluster) cutAt.set(`${ends[k].el}:${ends[k].at}`, Math.round(angle));
        }
      }

      // Carry the real cut angles back onto the members (§8).
      const out = els.map((e, idx) => {
        const s = cutAt.get(`${idx}:start`);
        const en = cutAt.get(`${idx}:end`);
        return s === undefined && en === undefined
          ? e
          : { ...e, cutAngleStart: s ?? e.cutAngleStart, cutAngleEnd: en ?? e.cutAngleEnd };
      });
      return { out, joints };
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
  load: {
    type: "load", label: "Load", category: "Analysis",
    inputs: [], outputs: [{ id: "out", label: "load", kind: "number" }],
    params: [
      { key: "kind", label: "type", default: "distributed", options: ["distributed", "point"] },
      { key: "value", label: "value (kN)", default: 1, min: 0, step: 0.5 },
    ],
    compute: (_i, p) => ({ out: num(p, "value") }),
  },
  support: {
    type: "support", label: "Support", category: "Analysis",
    inputs: [{ id: "in", label: "elements", kind: "elements" }],
    outputs: [{ id: "out", label: "elements", kind: "elements" }],
    params: [{ key: "kind", label: "fixity", default: "pinned", options: ["pinned", "fixed"] }],
    compute: (i) => ({ out: asElements(i.in) }),
  },
  check: {
    type: "check", label: "Check (advisory)", category: "Analysis",
    inputs: [
      { id: "in", label: "elements", kind: "elements" },
      { id: "load", label: "load", kind: "number" },
    ],
    outputs: [
      { id: "out", label: "elements", kind: "elements" },
      { id: "checks", label: "checks", kind: "checks" },
    ],
    params: [{ key: "slenderness", label: "L/Ø limit", default: 30, min: 5, step: 1 }],
    compute: (i, p) => {
      const els = asElements(i.in);
      const limit = num(p, "slenderness");
      const hasLoad = typeof i.load === "number" && (i.load as number) > 0;
      const flags: CheckFlag[] = [];
      for (const e of els) {
        const isRound = e.kind === "culm";
        // Slenderness is a purely geometric sanity check (no material assumptions).
        const dia = isRound ? (e.startDiameter ?? 0) / 1000 : (e.width ?? 0) / 1000;
        if (dia > 0) {
          const ratio = e.length / dia;
          if (ratio > limit) {
            flags.push({
              elementId: e.id,
              severity: "warning",
              message: isRound
                ? `Slender: L/Ø = ${ratio.toFixed(0)} (> ${limit}); check buckling per ISO 22156.`
                : `Slender: L/w = ${ratio.toFixed(0)} (> ${limit}); geometric flag only — the ISO 22156 rule of thumb is for round culms.`,
            });
          }
        }
        if (!isRound) {
          // Never let a round-culm code anchor imply coverage it does not have (§9).
          flags.push({
            elementId: e.id,
            severity: "info",
            message:
              e.kind === "laminate"
                ? `Engineered bamboo (${e.layup ?? "laminated"}) — ISO 22156:2021 explicitly excludes laminated products; validation rests on manufacturer data and project-specific engineering.`
                : `Processed (split) bamboo — outside ISO 22156:2021, which covers round culms; no settled international code path.`,
          });
        }
        if (hasLoad) {
          flags.push({
            elementId: e.id,
            severity: "info",
            message: `Load applied — capacity is NOT computed here; verify with a licensed engineer (ISO 22156).`,
          });
        }
      }
      const checks: CheckResult = {
        flags,
        summary: { checked: els.length, flagged: new Set(flags.filter((f) => f.severity === "warning").map((f) => f.elementId)).size },
        disclaimer:
          "Advisory sanity checks only — NOT a verified structural analysis. Geometric slenderness is flagged against a coarse ISO 22156 rule of thumb; member capacity, connections, and stability require a licensed structural engineer. ISO 22156:2021 covers round culms only and excludes engineered bamboo (glue-laminated, cross-laminated, oriented-strand, densified) — those elements are labelled, not checked.",
      };
      return { out: els, checks };
    },
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
        nodes: e.kind === "culm" ? e.nodeCount : undefined,
        layup: e.layup,
        verification: e.verification,
        cut_start_deg: e.cutAngleStart,
        cut_end_deg: e.cutAngleEnd,
      }));
      // The joint schedule — the other half of the buildable document (§6d, §8).
      const jointsIn = Array.isArray(i.joints) ? (i.joints as Joint[]) : [];
      const jointRows: JointRow[] = jointsIn.map((j) => ({
        id: j.id,
        type: j.typeLabel ?? j.type ?? "unspecified",
        members: j.count,
        memberIds: (j.memberIds ?? []).join(" + "),
        angle_deg: j.angle,
        x: round(j.position[0]),
        y: round(j.position[1]),
        z: round(j.position[2]),
      }));

      const totalLength = els.reduce((s, e) => s + e.length, 0);
      // Only round-culm elements are cut from whole poles; processed stock has its own
      // yield question, so counting it here would overstate the pole order.
      const culmLength = els.reduce((s, e) => (e.kind === "culm" ? s + e.length : s), 0);
      const schedule: Schedule = {
        rows,
        joints: jointRows,
        totals: {
          count: els.length,
          totalLength_m: round(totalLength),
          estCulms: Math.ceil(culmLength / (num(p, "usable") || 6)),
          jointCount: jointRows.length,
        },
      };
      return { out: schedule };
    },
  },
  inventory: {
    type: "inventory", label: "Pole inventory", category: "Output",
    inputs: [{ id: "in", label: "elements", kind: "elements" }],
    outputs: [
      { id: "out", label: "elements", kind: "elements" },
      { id: "report", label: "reconciliation", kind: "inventory" },
    ],
    params: [
      {
        key: "poles",
        label: "measured poles",
        multiline: true,
        default: DEFAULT_POLES,
      },
      { key: "kerf", label: "saw kerf (m)", default: 0.01, min: 0, step: 0.005 },
      { key: "tol", label: "Ø tolerance (mm)", default: 5, min: 0, step: 1 },
    ],
    compute: (i, p) => {
      const els = asElements(i.in);
      const poles = parsePoles(String(p.poles ?? ""));
      return { out: els, report: reconcile(els, poles, num(p, "kerf"), num(p, "tol")) };
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

export const CATEGORIES: NodeDef["category"][] = ["Geometry", "Bamboo", "Analysis", "Output"];
