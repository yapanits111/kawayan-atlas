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
    n("joint", "joint", 860, 130, { tol: 0.2 }),
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
  ],
};

const wovenScreen: ExampleGraph = {
  nodes: [
    n("lineV", "line", 0, 20, { ax: -1.5, ay: 0, az: 0, bx: -1.5, by: 2.4, bz: 0 }),
    n("arrV", "arrayLinear", 220, 20, { count: 8, dx: 0.4, dy: 0, dz: 0 }),
    n("stripV", "strip", 440, 20, { w: 30, t: 5 }),
    n("lineH", "line", 0, 240, { ax: -1.5, ay: 0.3, az: 0.03, bx: 1.5, by: 0.3, bz: 0.03 }),
    n("arrH", "arrayLinear", 220, 240, { count: 7, dx: 0, dy: 0.3, dz: 0 }),
    n("stripH", "strip", 440, 240, { w: 30, t: 5 }),
    n("bundle", "bundle", 660, 130),
    n("sch", "schedule", 860, 130),
  ],
  edges: [
    e("e1", "lineV", "arrV"),
    e("e2", "arrV", "stripV"),
    e("e3", "lineH", "arrH"),
    e("e4", "arrH", "stripH"),
    e("e5", "stripV", "bundle", "out", "a"),
    e("e6", "stripH", "bundle", "out", "b"),
    e("e7", "bundle", "sch"),
  ],
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

export const EXAMPLES: { key: string; label: string; graph: ExampleGraph }[] = [
  { key: "vault", label: "Barrel vault", graph: vault },
  { key: "postbeam", label: "Post & beam frame", graph: postBeam },
  { key: "woven", label: "Woven screen", graph: wovenScreen },
  { key: "ring", label: "Column ring", graph: columnRing },
];
