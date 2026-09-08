// Starter graphs for the Design Lab — showcase the palette's range using only the
// existing nodes (arches, posts, beams, joints, woven strips, circular).
import { NODE_DEFS } from "./nodeDefs";

type P = Record<string, number | string>;
type GNode = { id: string; type: "graphNode"; position: { x: number; y: number }; data: { type: string; params: P } };
type GEdge = { id: string; source: string; target: string; sourceHandle: string; targetHandle: string };
export interface ExampleGraph {
  nodes: GNode[];
  edges: GEdge[];
}

function n(id: string, type: string, x: number, y: number, params: P = {}): GNode {
  const defaults = Object.fromEntries(NODE_DEFS[type].params.map((pd) => [pd.key, pd.default]));
  return { id, type: "graphNode", position: { x, y }, data: { type, params: { ...defaults, ...params } } };
}
function e(id: string, source: string, target: string, sourceHandle = "out", targetHandle = "in"): GEdge {
  return { id, source, target, sourceHandle, targetHandle };
}

const vault: ExampleGraph = {
  nodes: [
    n("arc", "arc", 0, 40, { plane: "xy", radius: 3, start: 0, end: 180, samples: 24 }),
    n("div", "divide", 240, 40, { count: 9 }),
    n("culm", "culm", 480, 40),
    n("arr", "arrayLinear", 720, 40, { count: 4, dx: 0, dy: 0, dz: 1.5 }),
    n("sch", "schedule", 960, 40),
  ],
  edges: [e("e1", "arc", "div"), e("e2", "div", "culm"), e("e3", "culm", "arr"), e("e4", "arr", "sch")],
};

const postBeam: ExampleGraph = {
  nodes: [
    n("grid", "grid", 0, 20, { cols: 3, rows: 2, sx: 2, sy: 3 }),
    n("ext", "extrude", 220, 20, { height: 2.5, axis: "y" }),
    n("culmP", "culm", 440, 20),
    n("rect", "rectangle", 0, 240, { w: 4, d: 3, plane: "xz" }),
    n("trans", "transform", 220, 240, { ty: 2.5 }),
    n("culmB", "culm", 440, 240, { d0: 100, d1: 100 }),
    n("bundle", "bundle", 660, 130),
    n("joint", "joint", 860, 130, { tol: 0.2, type: "fish-mouth", typeLabel: "Fish-Mouth (Saddle) Joint" }),
    n("sch", "schedule", 1060, 130),
  ],
  edges: [
    e("e1", "grid", "ext"),
    e("e2", "ext", "culmP"),
    e("e3", "rect", "trans"),
    e("e4", "trans", "culmB"),
    e("e5", "culmP", "bundle", "out", "a"),
    e("e6", "culmB", "bundle", "out", "b"),
    e("e7", "bundle", "joint"),
    e("e8", "joint", "sch"),
    e("e9", "joint", "sch", "joints", "joints"),
  ],
};

const wovenScreen: ExampleGraph = {
  nodes: [
    n("weave", "weave", 0, 40, { w: 3, h: 2.4, u: 8, v: 7, plane: "xy" }),
    n("strip", "strip", 260, 40, { w: 30, t: 5 }),
    n("sch", "schedule", 500, 40),
  ],
  edges: [e("e1", "weave", "strip"), e("e2", "strip", "sch")],
};

const columnRing: ExampleGraph = {
  nodes: [
    n("circle", "circle", 0, 40, { radius: 2.2, plane: "xz", seg: 10 }),
    n("div", "divide", 240, 40, { count: 10 }),
    n("ext", "extrude", 480, 40, { height: 2.6, axis: "y" }),
    n("culm", "culm", 720, 40, { d0: 90, d1: 78 }),
    n("sch", "schedule", 960, 40),
  ],
  edges: [e("e1", "circle", "div"), e("e2", "div", "ext"), e("e3", "ext", "culm"), e("e4", "culm", "sch")],
};

const checkedPosts: ExampleGraph = {
  nodes: [
    n("grid", "grid", 0, 40, { cols: 2, rows: 2, sx: 2, sy: 2 }),
    n("ext", "extrude", 220, 40, { height: 3.2, axis: "y" }),
    n("culm", "culm", 440, 40, { d0: 90, d1: 85 }),
    n("load", "load", 440, 240, { value: 2 }),
    n("check", "check", 660, 130, { slenderness: 30 }),
    n("sch", "schedule", 880, 130),
  ],
  edges: [
    e("e1", "grid", "ext"),
    e("e2", "ext", "culm"),
    e("e3", "culm", "check"),
    e("e4", "load", "check", "out", "load"),
    e("e5", "check", "sch"),
  ],
};

const loftedShell: ExampleGraph = {
  nodes: [
    n("arcA", "arc", 0, 20, { plane: "xy", radius: 3, start: 0, end: 180, samples: 24 }),
    n("arcB", "arc", 0, 240, { plane: "xy", radius: 2.2, start: 0, end: 180, samples: 24 }),
    n("transB", "transform", 220, 240, { tz: 2.6 }),
    n("loft", "loft", 460, 120, { count: 11 }),
    n("strip", "strip", 700, 120, { w: 45, t: 6 }),
    n("sch", "schedule", 920, 120),
  ],
  edges: [
    e("e1", "arcA", "loft", "out", "a"),
    e("e2", "arcB", "transB"),
    e("e3", "transB", "loft", "out", "b"),
    e("e4", "loft", "strip"),
    e("e5", "strip", "sch"),
  ],
};

// Diaphragms carried into the cut-list: posts split at their nodes, each internode
// keeping its own share of the taper (§8).
const internodePosts: ExampleGraph = {
  nodes: [
    n("grid", "grid", 0, 40, { cols: 3, rows: 1, sx: 1.2, sy: 1 }),
    n("ext", "extrude", 220, 40, { height: 3, axis: "y" }),
    n("culm", "culm", 440, 40, { d0: 100, d1: 82, nodes: 0.32 }),
    n("inter", "internode", 660, 40, { spacing: 0.32, mode: "split" }),
    n("sch", "schedule", 900, 40),
  ],
  edges: [e("e1", "grid", "ext"), e("e2", "ext", "culm"), e("e3", "culm", "inter"), e("e4", "inter", "sch")],
};

// Phase 3: a glue-laminated bent arch — modellable, but outside ISO 22156 (§9), so the
// schedule labels it rather than implying a code check.
const laminatedArch: ExampleGraph = {
  nodes: [
    n("arc", "arc", 0, 40, { plane: "xy", radius: 3.2, start: 20, end: 160, samples: 32 }),
    n("lam", "laminate", 250, 40, { w: 80, ply: 6, layers: 6, layup: "parallel" }),
    n("arr", "arrayLinear", 500, 40, { count: 4, dx: 0, dy: 0, dz: 1.2 }),
    n("sch", "schedule", 740, 40),
  ],
  edges: [e("e1", "arc", "lam"), e("e2", "lam", "arr"), e("e3", "arr", "sch")],
};

// Two crossing sets of culms; `intersect` marks every crossing — the lashing points.
const lashedScreen: ExampleGraph = {
  nodes: [
    n("lineV", "line", 0, 20, { ax: 0, ay: 0, az: 0, bx: 0, by: 2.4, bz: 0 }),
    n("arrV", "arrayLinear", 220, 20, { count: 6, dx: 0.6, dy: 0, dz: 0 }),
    n("culmV", "culm", 440, 20, { d0: 70, d1: 62, nodes: 0.35 }),
    n("lineH", "line", 0, 300, { ax: 0, ay: 0, az: 0, bx: 3, by: 0, bz: 0 }),
    n("arrH", "arrayLinear", 220, 300, { count: 5, dx: 0, dy: 0.6, dz: 0 }),
    n("culmH", "culm", 440, 300, { d0: 70, d1: 62, nodes: 0.35 }),
    n("cross", "intersect", 660, 440, { tol: 0.03 }),
    n("bundle", "bundle", 660, 160),
    n("sch", "schedule", 880, 160),
  ],
  edges: [
    e("e1", "lineV", "arrV"),
    e("e2", "arrV", "culmV"),
    e("e3", "lineH", "arrH"),
    e("e4", "arrH", "culmH"),
    e("e5", "culmV", "bundle", "out", "a"),
    e("e6", "culmH", "bundle", "out", "b"),
    e("e7", "bundle", "sch"),
    e("e8", "arrV", "cross", "out", "a"),
    e("e9", "arrH", "cross", "out", "b"),
  ],
};

// Phase 4: the same posts reconciled against a yard of real, measured poles — which
// pole each piece is cut from, and what is left over.
const yardCheck: ExampleGraph = {
  nodes: [
    n("grid", "grid", 0, 40, { cols: 4, rows: 2, sx: 2, sy: 2.5 }),
    n("ext", "extrude", 230, 40, { height: 2.8, axis: "y" }),
    n("culm", "culm", 460, 40, { d0: 95, d1: 80, nodes: 0.3 }),
    n("inv", "inventory", 690, 40),
    n("sch", "schedule", 930, 40),
  ],
  edges: [e("e1", "grid", "ext"), e("e2", "ext", "culm"), e("e3", "culm", "inv"), e("e4", "inv", "sch")],
};

export const EXAMPLES: { key: string; label: string; graph: ExampleGraph }[] = [
  { key: "vault", label: "Barrel vault", graph: vault },
  { key: "shell", label: "Lofted shell", graph: loftedShell },
  { key: "postbeam", label: "Post & beam frame", graph: postBeam },
  { key: "woven", label: "Woven screen", graph: wovenScreen },
  { key: "ring", label: "Column ring", graph: columnRing },
  { key: "checked", label: "Checked posts (advisory)", graph: checkedPosts },
  { key: "internode", label: "Nodes & internodes", graph: internodePosts },
  { key: "laminate", label: "Laminated arch (engineered)", graph: laminatedArch },
  { key: "lashed", label: "Lashed screen (intersect)", graph: lashedScreen },
  { key: "yard", label: "Reconcile against a pole yard", graph: yardCheck },
];
