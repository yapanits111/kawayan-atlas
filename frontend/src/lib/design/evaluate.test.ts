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

describe("evaluateGraph — freeform polyline curve", () => {
  it("threads a curve through the hand-typed point list and sweeps culms along it", () => {
    const nodes = [
      node("poly", "polyline", { smooth: 8 }),
      node("dv", "divide", { count: 10 }),
      node("cu", "culm"),
      node("sc", "schedule"),
    ];
    const edges = [edge("poly", "dv"), edge("dv", "cu"), edge("cu", "sc")];
    const r = evaluateGraph(nodes, edges);
    expect(r.errors).toEqual({});
    expect(r.schedule!.rows.length).toBeGreaterThan(0);
    expect(r.schedule!.rows.every((row) => row.kind === "culm")).toBe(true);
  });

  it("prefers wired-in points (grid) over the typed list", () => {
    const nodes = [
      node("gr", "grid", { cols: 4, rows: 1, sx: 1, sy: 1 }),
      node("poly", "polyline", { smooth: 0 }),
      node("cu", "culm"),
      node("sc", "schedule"),
    ];
    const edges = [edge("gr", "poly"), edge("poly", "cu"), edge("cu", "sc")];
    const r = evaluateGraph(nodes, edges);
    expect(r.errors).toEqual({});
    // 4 gridded points -> one polyline -> one culm along it
    expect(r.schedule!.rows).toHaveLength(1);
    expect(r.schedule!.rows[0].kind).toBe("culm");
  });
});

describe("evaluateGraph — bill of materials grouping", () => {
  it("collapses identical arrayed pieces into one quantity line", () => {
    const nodes = [
      node("ln", "line", { ax: 0, ay: 0, az: 0, bx: 4, by: 0, bz: 0 }),
      node("cu", "culm"),
      node("ar", "arrayLinear", { count: 4, dx: 0, dy: 0, dz: 1 }),
      node("sc", "schedule"),
    ];
    const edges = [edge("ln", "cu"), edge("cu", "ar"), edge("ar", "sc")];
    const r = evaluateGraph(nodes, edges);
    expect(r.schedule!.rows).toHaveLength(4); // four individual pieces
    expect(r.schedule!.groups).toHaveLength(1); // one orderable line
    expect(r.schedule!.groups[0].count).toBe(4);
    expect(r.schedule!.groups[0].length_m).toBeCloseTo(4, 6);
    expect(r.schedule!.groups[0].totalLength_m).toBeCloseTo(16, 6);
  });

  it("keeps differently-sized pieces in separate groups", () => {
    // Two culm chains of different lengths -> two groups.
    const nodes = [
      node("lnA", "line", { ax: 0, ay: 0, az: 0, bx: 3, by: 0, bz: 0 }),
      node("cuA", "culm"),
      node("lnB", "line", { ax: 0, ay: 1, az: 0, bx: 5, by: 1, bz: 0 }),
      node("cuB", "culm"),
      node("bn", "bundle"),
      node("sc", "schedule"),
    ];
    const edges = [
      edge("lnA", "cuA"),
      edge("lnB", "cuB"),
      edge("cuA", "bn", "out", "a"),
      edge("cuB", "bn", "out", "b"),
      edge("bn", "sc"),
    ];
    const r = evaluateGraph(nodes, edges);
    expect(r.schedule!.groups).toHaveLength(2);
    expect(r.schedule!.groups.every((g) => g.count === 1)).toBe(true);
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
  // Two members meeting at the origin, wired through a joint into a schedule.
  function twoMemberJoint(
    dirB: { bx: number; by: number; bz: number },
    aEnd: { bx: number; by: number; bz: number },
    jointParams: Record<string, number | string> = {},
  ) {
    const nodes = [
      node("lnA", "line", { ax: 0, ay: 0, az: 0, ...aEnd }),
      node("cuA", "culm"),
      node("lnB", "line", { ax: 0, ay: 0, az: 0, ...dirB }),
      node("cuB", "culm"),
      node("bn", "bundle"),
      node("jt", "joint", jointParams),
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
    return evaluateGraph(nodes, edges);
  }

  it("clusters coincident ends and reports the joint in the schedule", () => {
    const r = twoMemberJoint({ bx: 0, by: 2, bz: 0 }, { bx: 2, by: 0, bz: 0 });
    expect(r.scene.joints).toHaveLength(1);
    expect(r.scene.joints[0].count).toBe(2);
    expect(r.scene.joints[0].angle).toBe(90);
    expect(r.schedule!.joints).toHaveLength(1);
    expect(r.schedule!.totals.jointCount).toBe(1);
  });

  it("auto-types an angled 2-member meeting as a fish-mouth saddle (and mitres it)", () => {
    // Members at 90 degrees -> below the splice threshold -> saddle.
    const r = twoMemberJoint({ bx: 0, by: 2, bz: 0 }, { bx: 2, by: 0, bz: 0 });
    const j = r.scene.joints[0];
    expect(j.type).toBe("fish-mouth");
    expect(j.typeLabel).toBe("Fish-Mouth (Saddle) Joint");
    // a mitred joint carries its angle onto the meeting member ends
    const mitredRows = r.schedule!.rows.filter((row) => row.cut_start_deg === 90 || row.cut_end_deg === 90);
    expect(mitredRows.length).toBeGreaterThan(0);
  });

  it("auto-types a near-collinear 2-member meeting as a bolted splice (no mitre)", () => {
    // A goes -x from the joint, B goes +x -> ~180 degrees -> inline splice.
    const r = twoMemberJoint({ bx: 2, by: 0, bz: 0 }, { bx: -2, by: 0, bz: 0 });
    const j = r.scene.joints[0];
    expect(j.angle).toBe(180);
    expect(j.type).toBe("bolted");
    expect(j.typeLabel).toBe("Bolted Joint");
  });

  it("auto-types a 3+ member hub as a bolted + mortar-plug node", () => {
    // A line fanned into three by a polar array all share the origin end.
    const nodes = [
      node("ln", "line", { ax: 0, ay: 0, az: 0, bx: 1, by: 0, bz: 0 }),
      node("ar", "arrayPolar", { count: 3, total: 360, axis: "y" }),
      node("cu", "culm"),
      node("jt", "joint", { tol: 0.05 }),
      node("sc", "schedule"),
    ];
    const edges = [
      edge("ln", "ar"),
      edge("ar", "cu"),
      edge("cu", "jt"),
      edge("jt", "sc", "out", "in"),
      edge("jt", "sc", "joints", "joints"),
    ];
    const r = evaluateGraph(nodes, edges);
    expect(r.scene.joints).toHaveLength(1);
    expect(r.scene.joints[0].count).toBe(3);
    expect(r.scene.joints[0].type).toBe("bolted-mortar-plug");
  });

  it("manual mode applies the hand-picked library type to every joint", () => {
    const r = twoMemberJoint(
      { bx: 0, by: 2, bz: 0 },
      { bx: 2, by: 0, bz: 0 },
      { mode: "manual", type: "lashing-tie" },
    );
    const j = r.scene.joints[0];
    expect(j.type).toBe("lashing-tie");
    expect(j.typeLabel).toBe("Traditional Lashing (Rattan / Palm-fiber Tie)");
    expect(r.schedule!.joints[0].type).toBe("Traditional Lashing (Rattan / Palm-fiber Tie)");
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
