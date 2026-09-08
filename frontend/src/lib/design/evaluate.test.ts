import { describe, it, expect } from "vitest";
import { evaluateGraph, type GNode, type GEdge } from "./evaluate";
import { NODE_DEFS } from "./nodeDefs";

// Build a node with its registry defaults, overridden by `params`.
function node(id: string, type: string, params: Record<string, number | string> = {}): GNode {
  const defaults = Object.fromEntries(NODE_DEFS[type].params.map((p) => [p.key, p.default]));
  return { id, type, data: { params: { ...defaults, ...params } } };
}
function edge(source: string, target: string, sourceHandle = "out", targetHandle = "in"): GEdge {
  return { source, target, sourceHandle, targetHandle };
}

describe("evaluateGraph — the proof chain", () => {
  // curve -> divide -> culm -> array -> schedule (whitepaper §7)
  const nodes = [
    node("ln", "line", { ax: 0, ay: 0, az: 0, bx: 4, by: 0, bz: 0 }),
    node("dv", "divide", { count: 3 }), // 3 points -> 2 segments
    node("cu", "culm"),
    node("ar", "arrayLinear", { count: 2, dx: 0, dy: 0, dz: 1 }),
    node("sc", "schedule"),
  ];
  const edges = [
    edge("ln", "dv"),
    edge("dv", "cu"),
    edge("cu", "ar"),
    edge("ar", "sc"),
  ];

  it("produces a schedule with no errors", () => {
    const r = evaluateGraph(nodes, edges);
    expect(r.errors).toEqual({});
    expect(r.schedule).not.toBeNull();
  });

  it("row count == rendered elements == 2 segments x 2 copies", () => {
    const r = evaluateGraph(nodes, edges);
    expect(r.schedule!.rows).toHaveLength(4);
    expect(r.scene.elements).toHaveLength(4);
    expect(r.schedule!.totals.count).toBe(4);
  });

  it("culm rows carry taper detail", () => {
    const r = evaluateGraph(nodes, edges);
    const row = r.schedule!.rows[0];
    expect(row.kind).toBe("culm");
    expect(row.detail).toMatch(/Ø/);
    expect(row.length_m).toBeCloseTo(2, 6); // 4m line / 2 segments
  });
});

describe("evaluateGraph — dependency ordering", () => {
  it("evaluates producers before consumers regardless of array order", () => {
    // Deliberately scrambled: consumer listed before its producers.
    const nodes = [
      node("cu", "culm"),
      node("dv", "divide", { count: 4 }),
      node("ln", "line", { ax: 0, ay: 0, az: 0, bx: 3, by: 0, bz: 0 }),
    ];
    const edges = [edge("ln", "dv"), edge("dv", "cu")];
    const r = evaluateGraph(nodes, edges);
    expect(r.errors).toEqual({});
    // culm only yields elements if it saw divide's points, which needed line first.
    expect(r.scene.elements.length).toBeGreaterThan(0);
    expect(r.scene.elements.every((e) => e.kind === "culm")).toBe(true);
  });
});

describe("evaluateGraph — piece marks are unique across the whole graph", () => {
  it("two independent culm nodes do not both number from C1", () => {
    const nodes = [
      node("lnA", "line", { ax: 0, ay: 0, az: 0, bx: 3, by: 0, bz: 0 }),
      node("dvA", "divide", { count: 3 }),
      node("cuA", "culm"),
      node("lnB", "line", { ax: 0, ay: 1, az: 0, bx: 3, by: 1, bz: 0 }),
      node("dvB", "divide", { count: 3 }),
      node("cuB", "culm"),
      node("bn", "bundle"),
      node("sc", "schedule"),
    ];
    const edges = [
      edge("lnA", "dvA"),
      edge("dvA", "cuA"),
      edge("lnB", "dvB"),
      edge("dvB", "cuB"),
      edge("cuA", "bn", "out", "a"),
      edge("cuB", "bn", "out", "b"),
      edge("bn", "sc"),
    ];
    const r = evaluateGraph(nodes, edges);
    const ids = r.scene.elements.map((e) => e.id);
    expect(ids).toHaveLength(4); // 2 segments each
    expect(new Set(ids).size).toBe(4); // all distinct — no C1 collision
    expect(r.schedule!.rows).toHaveLength(4);
  });
});

describe("evaluateGraph — joints", () => {
  it("clusters coincident element ends and reports them in the joint schedule", () => {
    // Two lines meeting at the origin at 90 degrees -> one joint of 2 members.
    const nodes = [
      node("lnA", "line", { ax: 0, ay: 0, az: 0, bx: 2, by: 0, bz: 0 }),
      node("cuA", "culm"),
      node("lnB", "line", { ax: 0, ay: 0, az: 0, bx: 0, by: 2, bz: 0 }),
      node("cuB", "culm"),
      node("bn", "bundle"),
      node("jt", "joint", { tol: 0.05, type: "fish-mouth", typeLabel: "Fish-Mouth" }),
      node("sc", "schedule"),
    ];
    const edges = [
      edge("lnA", "cuA"),
      edge("lnB", "cuB"),
      edge("cuA", "bn", "out", "a"),
      edge("cuB", "bn", "out", "b"),
      edge("bn", "jt"),
      edge("jt", "sc", "out", "in"),
      edge("jt", "sc", "joints", "joints"),
    ];
    const r = evaluateGraph(nodes, edges);
    expect(r.scene.joints).toHaveLength(1);
    expect(r.scene.joints[0].count).toBe(2);
    expect(r.scene.joints[0].angle).toBe(90);
    expect(r.schedule!.joints).toHaveLength(1);
    expect(r.schedule!.joints[0].type).toBe("Fish-Mouth");
    expect(r.schedule!.totals.jointCount).toBe(1);
  });
});

describe("evaluateGraph — robustness", () => {
  it("flags an unknown node type without throwing", () => {
    const r = evaluateGraph([{ id: "x", type: "bogus", data: { params: {} } }], []);
    expect(r.errors.x).toMatch(/Unknown node/);
  });

  it("ignores edges that reference missing nodes", () => {
    const nodes = [
      node("ln", "line", { ax: 0, ay: 0, az: 0, bx: 2, by: 0, bz: 0 }),
      node("cu", "culm"),
    ];
    const edges = [
      edge("ln", "cu"),
      edge("ghost", "cu"), // dangling source
      edge("cu", "phantom"), // dangling target
    ];
    const r = evaluateGraph(nodes, edges);
    expect(r.errors).toEqual({});
    // The valid node still evaluates. (We assert on `outputs` rather than `scene.elements`
    // because the dangling `cu -> phantom` edge marks cu's output as "consumed", so the
    // renderer treats it as non-terminal — the node's computation itself is unaffected.)
    expect(Array.isArray(r.outputs.cu?.out)).toBe(true);
    expect((r.outputs.cu!.out as unknown[]).length).toBeGreaterThan(0);
  });

  it("documents current cycle behaviour: cyclic nodes are silently dropped, no error", () => {
    // A <-> B mutual dependency. Kahn's algorithm never enqueues either (indegree stays > 0),
    // so neither is evaluated and neither raises an error. This encodes today's behaviour;
    // if cycle *detection* is added later, this test should be updated to expect an error.
    const nodes = [node("a", "transform"), node("b", "transform")];
    const edges = [edge("a", "b"), edge("b", "a")];
    const r = evaluateGraph(nodes, edges);
    expect(Object.keys(r.outputs)).toHaveLength(0); // nothing evaluated
    expect(r.errors).toEqual({}); // and nothing flagged
    expect(r.schedule).toBeNull();
  });
});
