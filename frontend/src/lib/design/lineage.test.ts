import { describe, it, expect } from "vitest";
import { ancestorsOf, descendantsOf, lineage } from "./lineage";
import { evaluateGraph, type GEdge, type GNode } from "./evaluate";
import { NODE_DEFS } from "./nodeDefs";

const e = (source: string, target: string, targetHandle = "in"): GEdge => ({
  source,
  target,
  sourceHandle: "out",
  targetHandle,
});

// Freeform arch: spline → divide → culm → array → schedule
const chain = [e("poly", "div"), e("div", "culm"), e("culm", "arr"), e("arr", "sch")];

// Post & beam: two branches merged by a bundle.
const merge = [
  e("grid", "ext"), e("ext", "culmP"), e("culmP", "bundle", "a"),
  e("rect", "trans"), e("trans", "culmB"), e("culmB", "bundle", "b"),
  e("bundle", "sch"),
];
const mergeOrder = ["grid", "rect", "ext", "trans", "culmP", "culmB", "bundle", "sch"];

describe("ancestors / descendants", () => {
  it("walk a chain both ways", () => {
    expect([...ancestorsOf("arr", chain)].sort()).toEqual(["culm", "div", "poly"]);
    expect([...descendantsOf("div", chain)].sort()).toEqual(["arr", "culm", "sch"]);
    expect(ancestorsOf("poly", chain).size).toBe(0);
  });

  it("survive a cycle without looping", () => {
    const loop = [e("a", "b"), e("b", "c"), e("c", "a")];
    expect([...ancestorsOf("a", loop)].sort()).toEqual(["b", "c"]);
  });
});

describe("lineage", () => {
  it("lists everything behind a drawn member, source first", () => {
    const order = ["poly", "div", "culm", "arr", "sch"];
    expect(lineage("arr", "culm", chain, order)).toEqual(["poly", "div", "culm", "arr"]);
  });

  it("follows only the branch a member came through at a merge", () => {
    expect(lineage("bundle", "culmB", merge, mergeOrder)).toEqual(["rect", "trans", "culmB", "bundle"]);
    expect(lineage("bundle", "culmP", merge, mergeOrder)).toEqual(["grid", "ext", "culmP", "bundle"]);
  });

  it("without a maker (a plain curve), takes every path to the producer", () => {
    expect(lineage("bundle", null, merge, mergeOrder)).toHaveLength(7);
  });
});

describe("evaluation reports where scene geometry came from", () => {
  const node = (id: string, type: string, params: Record<string, number | string> = {}): GNode => ({
    id,
    type,
    data: { params: { ...Object.fromEntries(NODE_DEFS[type].params.map((p) => [p.key, p.default])), ...params } },
  });

  it("members remember the node that made them, through copies", () => {
    const r = evaluateGraph(
      [node("poly", "polyline"), node("div", "divide", { count: 4 }), node("culm", "culm"), node("arr", "arrayLinear", { count: 2 })],
      [e("poly", "div"), e("div", "culm"), e("culm", "arr")],
    );
    expect(r.scene.elements).toHaveLength(6); // 3 segments × 2 copies, drawn from the array
    for (const el of r.scene.elements) {
      expect(el.madeBy).toBe("culm");
      expect(r.scene.origin.elements[el.id]).toBe("arr");
    }
    expect(r.order).toEqual(["poly", "div", "culm", "arr"]);
  });

  it("curves and points are credited to the node that output them", () => {
    const r = evaluateGraph([node("poly", "polyline"), node("pt", "point", { x: 1 })], []);
    expect(r.scene.origin.curves).toEqual(["poly"]);
    expect(r.scene.origin.points).toEqual(["pt"]);
  });
});
