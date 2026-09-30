import { describe, it, expect } from "vitest";
import {
  simplify,
  padToWorld,
  strokeToPoints,
  formatPoints,
  planeFrame,
  planeToWorld,
  worldToPlane,
  padToPlane,
  planeToPad,
  presetPlane,
  matchPreset,
  orientationFromNormal,
  fitPlane,
  fitToPad,
  insertionIndex,
  setPointInText,
  axisLabel,
  type DrawPlane,
  type Pt2,
  type PadMapping,
} from "./freehand";
import { parsePoints, cross, dot, len, sub } from "./geometry";
import type { Vec3 } from "./types";

// 600 × 300 px pad spanning 6 m → 0.01 m per px.
const pad = (plane: PadMapping["plane"]): PadMapping => ({ width: 600, height: 300, size: 6, plane });

const close = (a: Vec3, b: Vec3, tol = 1e-9) => expect(len(sub(a, b))).toBeLessThan(tol);

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

describe("padToWorld on the axis presets", () => {
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

describe("drawing planes", () => {
  it("the presets are the axis frames", () => {
    expect(planeFrame(presetPlane("xy"))).toMatchObject({ u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] });
    expect(planeFrame(presetPlane("xz"))).toMatchObject({ u: [1, 0, 0], v: [0, 0, -1], n: [0, 1, 0] });
    expect(planeFrame(presetPlane("yz"))).toMatchObject({ u: [0, 0, 1], v: [0, 1, 0], n: [-1, 0, 0] });
  });

  it("any turn/pitch gives an orthonormal frame with a horizontal right axis", () => {
    for (const [turn, pitch] of [[37, 23], [-120, 65], [180, 90], [15, 0]]) {
      const f = planeFrame({ origin: [0, 0, 0], turn, pitch });
      expect(f.u[1]).toBe(0);
      for (const a of [f.u, f.v, f.n]) expect(len(a)).toBeCloseTo(1, 12);
      expect(dot(f.u, f.v)).toBeCloseTo(0, 12);
      close(cross(f.u, f.v), f.n, 1e-12);
    }
  });

  it("an offset, turned elevation stands on the ground at its origin", () => {
    const plane: DrawPlane = { origin: [2, 0, -3], turn: 45, pitch: 90 };
    expect(padToWorld([300, 300], pad(plane))).toEqual([2, 0, -3]); // bottom-centre = origin
    const r = padToWorld([400, 300], pad(plane)); // 1 m to the right, along the turn
    expect(r[0]).toBeCloseTo(2 + Math.SQRT1_2, 3);
    expect(r[1]).toBe(0);
    expect(r[2]).toBeCloseTo(-3 + Math.SQRT1_2, 3);
    expect(padToWorld([300, 100], pad(plane))).toEqual([2, 2, -3]); // 2 m straight up
  });

  it("a pitched plane rises away from the viewer like a roof slope", () => {
    const roof: DrawPlane = { origin: [0, 2.4, 0], turn: 0, pitch: 30 };
    // 2 m up the pad → 1 m higher and 1.732 m further back (−z).
    expect(padToWorld([300, 100], pad(roof))).toEqual([0, 3.4, -1.732]);
  });

  it("a flat plane is centred on its origin, at the origin's height", () => {
    expect(padToWorld([300, 150], pad(presetPlane("xz", [1, 3, 2])))).toEqual([1, 3, 2]);
  });

  it("world ↔ plane and pad ↔ plane conversions invert each other", () => {
    const f = planeFrame({ origin: [1.5, -2, 4], turn: -33, pitch: 71 });
    const q: Vec3 = [0.7, 2.2, -0.3];
    close(worldToPlane(planeToWorld(q, f), f), q, 1e-12);
    for (const flat of [true, false]) {
      const v = { width: 560, height: 340, size: 8, flat };
      const s: Pt2 = [123.4, 56.7];
      const back = planeToPad(padToPlane(s, v), v);
      expect(back[0]).toBeCloseTo(s[0], 9);
      expect(back[1]).toBeCloseTo(s[1], 9);
    }
  });

  it("recognises a preset orientation wherever its origin is", () => {
    expect(matchPreset(presetPlane("xy", [5, 1, -2]))).toBe("xy");
    expect(matchPreset({ origin: [0, 0, 0], turn: 360, pitch: 0 })).toBe("xz");
    expect(matchPreset({ origin: [0, 0, 0], turn: -270, pitch: 90 })).toBe("yz");
    expect(matchPreset({ origin: [0, 0, 0], turn: 30, pitch: 90 })).toBeNull();
  });
});

describe("orientationFromNormal", () => {
  it("faces the axis planes the un-mirrored way", () => {
    expect(orientationFromNormal([0, 0, 1])).toEqual({ turn: 0, pitch: 90 });
    expect(orientationFromNormal([0, 0, -1])).toEqual({ turn: 0, pitch: 90 });
    expect(orientationFromNormal([1, 0, 0])).toEqual({ turn: 90, pitch: 90 });
    expect(orientationFromNormal([0, -1, 0])).toEqual({ turn: 0, pitch: 0 });
  });

  it("shrugs off fitting noise instead of flipping the plane", () => {
    expect(orientationFromNormal([1e-5, -1e-5, 1])).toEqual({ turn: 0, pitch: 90 });
    expect(orientationFromNormal([-1, 1e-6, -2e-5])).toEqual({ turn: 90, pitch: 90 });
  });

  it("recovers the turn and pitch of any plane", () => {
    for (const [turn, pitch] of [[0, 60], [37, 23], [-120, 65], [150, 45], [45, 90], [-60, 90]]) {
      const n = planeFrame({ origin: [0, 0, 0], turn, pitch }).n;
      expect(orientationFromNormal(n)).toEqual({ turn, pitch });
    }
  });
});

describe("fitPlane", () => {
  const arch: Vec3[] = [[-3, 0, 0], [-1.5, 1.4, 0], [0, 1.9, 0], [1.5, 1.4, 0], [3, 0, 0]];

  it("finds the plane a flat curve lies in", () => {
    const f = fitPlane(arch);
    expect(Math.abs(f.normal[2])).toBeCloseTo(1, 9);
    expect(f.planar).toBe(true);
    expect(f.deviation).toBeLessThan(1e-9);
  });

  it("finds a turned, tilted plane", () => {
    const frame = planeFrame({ origin: [1, 2, 3], turn: 30, pitch: 50 });
    const pts = arch.map(([a, b]) => planeToWorld([a, b, 0], frame));
    const f = fitPlane(pts);
    expect(Math.abs(dot(f.normal, frame.n))).toBeCloseTo(1, 9);
    expect(f.planar).toBe(true);
  });

  it("flags a curve that is not flat", () => {
    const helix: Vec3[] = Array.from({ length: 12 }, (_, i) => [Math.cos(i / 2), i * 0.2, Math.sin(i / 2)]);
    expect(fitPlane(helix).planar).toBe(false);
  });

  it("puts a straight run in the upright plane that contains it", () => {
    const f = fitPlane([[0, 0, 0], [3, 1, 4]]);
    expect(f.normal[1]).toBeCloseTo(0, 12); // upright
    expect(dot(f.normal, [3, 1, 4])).toBeCloseTo(0, 12); // contains the line
    expect(fitPlane([[1, 0, 1], [1, 5, 1]]).normal).toEqual([0, 0, 1]); // vertical → elevation
    expect(fitPlane([[2, 2, 2], [2, 2, 2]]).normal).toEqual([0, 0, 1]);
  });
});

describe("fitToPad (loading a spline onto the pad)", () => {
  const aspect = 340 / 560;
  const arch: Vec3[] = [[-3, 0, 0], [-1.5, 1.4, 0], [0, 1.9, 0], [1.5, 1.4, 0], [3, 0, 0]];
  const back = (fit: ReturnType<typeof fitToPad>) => fit.pts.map((q) => planeToWorld(q, planeFrame(fit.plane)));

  it("an arch on the ground loads onto the elevation plane, standing on the pad's base", () => {
    const fit = fitToPad(arch, aspect);
    expect(fit.plane).toEqual({ origin: [0, 0, 0], turn: 0, pitch: 90 });
    expect(fit.pts[0][0]).toBeCloseTo(-3, 12);
    expect(fit.pts[0][1]).toBeCloseTo(0, 12);
    expect(fit.size).toBeGreaterThanOrEqual(6 / 0.85);
    expect(fit.planar).toBe(true);
  });

  it("keeps the ground in view under a curve a little above it, not one far above", () => {
    const lifted = (dy: number) => arch.map(([x, y, z]) => [x + 10, y + dy, z - 4] as Vec3);
    expect(fitToPad(lifted(2), aspect).plane.origin).toEqual([10, 0, -4]);
    expect(fitToPad(lifted(12), aspect).plane.origin).toEqual([10, 12, -4]);
  });

  it("a plan curve loads centred on a flat plane at its height", () => {
    const ring: Vec3[] = Array.from({ length: 8 }, (_, i) => [2 + Math.cos(i), 3, Math.sin(i)]);
    const fit = fitToPad(ring, aspect);
    expect(fit.plane.pitch).toBe(0);
    expect(fit.plane.origin[1]).toBe(3);
  });

  it("recovers the plane of a curve drawn on a turned plane", () => {
    const frame = planeFrame({ origin: [4, 0, 1], turn: 30, pitch: 90 });
    const fit = fitToPad(arch.map(([a, b]) => planeToWorld([a, b, 0], frame)), aspect);
    expect(fit.plane).toMatchObject({ turn: 30, pitch: 90 });
  });

  it("round-trips every point exactly, even off a flat plane", () => {
    const wavy: Vec3[] = [[0, 0, 0], [1, 1, 0.3], [2, 1.5, -0.2], [3, 0.8, 0.1]];
    const fit = fitToPad(wavy, aspect);
    expect(fit.planar).toBe(false);
    back(fit).forEach((p, i) => close(p, wavy[i], 1e-9));
    back(fitToPad(arch, aspect)).forEach((p, i) => close(p, arch[i], 1e-9));
  });
});

describe("insertionIndex", () => {
  const zig: Vec3[] = [[0, 0, 0], [2, 0, 0], [2, 2, 0], [4, 2, 0]];

  it("inserts into the straight span that was clicked", () => {
    expect(insertionIndex(zig, false, 0, 0, [1, 0.1])).toEqual({ index: 1, distance: expect.closeTo(0.1, 9) });
    expect(insertionIndex(zig, false, 0, 0, [2.1, 1]).index).toBe(2);
    expect(insertionIndex(zig, false, 0, 0, [3, 2]).index).toBe(3);
  });

  it("uses the closing span of a closed curve", () => {
    const square: Vec3[] = [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]];
    expect(insertionIndex(square, true, 0, 0, [0, 1]).index).toBe(4);
  });

  it("follows the smoothed spline, not just the control polygon", () => {
    const arch: Vec3[] = [[-3, 0, 0], [-1.5, 1.4, 0], [0, 1.9, 0], [1.5, 1.4, 0], [3, 0, 0]];
    expect(insertionIndex(arch, false, 12, 0, [0.8, 1.75]).index).toBe(3);
    expect(insertionIndex(arch, false, 12, 0, [-2.4, 0.8]).index).toBe(1);
  });

  it("reports the distance, so a far click can extend the curve instead", () => {
    expect(insertionIndex(zig, false, 0, 0, [9, 9]).distance).toBeGreaterThan(5);
  });
});

describe("setPointInText", () => {
  const text = ["# x, y, z per line", "0, 0, 0", "", "1 2 3   # apex", "not a point", "4, 5, 6"].join("\n");

  it("rewrites just that point, keeping comments and blank lines", () => {
    expect(setPointInText(text, 1, [1.5, 2.25, 3])).toBe(
      ["# x, y, z per line", "0, 0, 0", "", "1.5, 2.25, 3   # apex", "not a point", "4, 5, 6"].join("\n"),
    );
    expect(setPointInText(text, 2, [-0.0001, 7.12345, 8])).toContain("\n0, 7.123, 8");
  });

  it("counts points exactly as the node's parser does", () => {
    for (let i = 0; i < 3; i++) {
      const edited = parsePoints(setPointInText(text, i, [9, 9, 9]));
      expect(edited[i]).toEqual([9, 9, 9]);
      expect(edited).toHaveLength(3);
    }
  });

  it("leaves the text alone for an index past the end, and keeps Windows line endings", () => {
    expect(setPointInText(text, 3, [1, 1, 1])).toBe(text);
    expect(setPointInText("0,0,0\r\n1,1,1\r\n", 1, [2, 2, 2])).toBe("0,0,0\r\n2, 2, 2\r\n");
  });
});

describe("strokeToPoints / formatPoints / axisLabel", () => {
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

  it("round-trips through the spline node's point parser, to the mm", () => {
    const pts: Vec3[] = [[-3, 0, 0], [0, 2.5, 0], [3, 0.00049, -1e-9]];
    expect(parsePoints(formatPoints(pts))).toEqual([[-3, 0, 0], [0, 2.5, 0], [3, 0, 0]]);
    expect(formatPoints(pts, "edited")).toMatch(/^# x, y, z per line — edited\n/);
  });

  it("names axis directions, and spells out the rest", () => {
    expect(axisLabel([0, 0, -1])).toBe("−z");
    expect(axisLabel([Math.SQRT1_2, 0, Math.SQRT1_2])).toBe("(0.71, 0.00, 0.71)");
  });
});
