import { describe, it, expect } from "vitest";
import { simplify, padToWorld, strokeToPoints, formatPoints, type Pt2, type PadMapping } from "./freehand";
import { parsePoints } from "./geometry";

// 600 × 300 px pad spanning 6 m → 0.01 m per px.
const pad = (plane: PadMapping["plane"]): PadMapping => ({ width: 600, height: 300, size: 6, plane });

describe("simplify (Ramer–Douglas–Peucker)", () => {
  it("collapses a straight, jittery-free run to its endpoints", () => {
    const line: Pt2[] = Array.from({ length: 20 }, (_, i) => [i * 10, i * 5]);
    expect(simplify(line, 1)).toEqual([[0, 0], [190, 95]]);
  });

  it("keeps the corner of an L", () => {
    const l: Pt2[] = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10]];
    expect(simplify(l, 0.5)).toEqual([[0, 0], [10, 0], [10, 10]]);
  });

  it("drops small wobbles below epsilon but keeps real bends", () => {
    const wobbly: Pt2[] = [[0, 0], [10, 0.4], [20, -0.3], [30, 0], [40, 20]];
    const out = simplify(wobbly, 1);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([40, 20]);
    expect(out).toContainEqual([30, 0]); // the bend
    expect(out).not.toContainEqual([10, 0.4]); // the wobble
  });

  it("returns short strokes unchanged", () => {
    expect(simplify([[1, 2], [3, 4]], 5)).toEqual([[1, 2], [3, 4]]);
  });
});

describe("padToWorld", () => {
  it("elevation (xy): pad bottom is the ground, centred left-right", () => {
    expect(padToWorld([0, 300], pad("xy"))).toEqual([-3, 0, 0]);
    expect(padToWorld([300, 0], pad("xy"))).toEqual([0, 3, 0]);
  });

  it("plan (xz): centred both ways, screen-down is +z", () => {
    expect(padToWorld([300, 150], pad("xz"))).toEqual([0, 0, 0]);
    expect(padToWorld([600, 300], pad("xz"))).toEqual([3, 0, 1.5]);
  });

  it("side (yz): horizontal maps to z, vertical to y", () => {
    expect(padToWorld([600, 300], pad("yz"))).toEqual([0, 0, 3]);
    expect(padToWorld([300, 0], pad("yz"))).toEqual([0, 3, 0]);
  });
});

describe("strokeToPoints / formatPoints", () => {
  it("turns an arch stroke into a few control points standing on the ground", () => {
    const arch: Pt2[] = [];
    for (let i = 0; i <= 60; i++) {
      const x = i * 10; // 0..600
      arch.push([x, 300 - Math.sin((i / 60) * Math.PI) * 200]);
    }
    const pts = strokeToPoints(arch, pad("xy"), 2);
    expect(pts.length).toBeGreaterThan(3);
    expect(pts.length).toBeLessThan(arch.length); // actually simplified
    expect(pts[0]).toEqual([-3, 0, 0]); // starts on the ground at the left edge
    expect(pts[pts.length - 1]).toEqual([3, 0, 0]);
    expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(2, 1); // 200 px tall = 2 m
  });

  it("round-trips through the spline node's point parser", () => {
    const pts: [number, number, number][] = [[-3, 0, 0], [0, 2.5, 0], [3, 0, 0]];
    expect(parsePoints(formatPoints(pts))).toEqual(pts);
  });
});
