import { describe, it, expect } from "vitest";
import type { Curve, Vec3 } from "./types";
import * as G from "./geometry";

const line2 = (a: Vec3, b: Vec3): Curve => ({ points: [a, b] });

describe("vector ops", () => {
  it("add / sub / scale", () => {
    expect(G.add([1, 2, 3], [4, 5, 6])).toEqual([5, 7, 9]);
    expect(G.sub([4, 5, 6], [1, 2, 3])).toEqual([3, 3, 3]);
    expect(G.scale([1, -2, 3], 2)).toEqual([2, -4, 6]);
  });

  it("dot / len", () => {
    expect(G.dot([1, 2, 3], [4, 5, 6])).toBe(32);
    expect(G.len([3, 4, 0])).toBe(5);
  });

  it("cross is right-handed", () => {
    expect(G.cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
  });

  it("normalize returns a unit vector, and zero for a zero vector", () => {
    const n = G.normalize([0, 3, 4]);
    expect(G.len(n)).toBeCloseTo(1, 9);
    expect(G.normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("lerp interpolates endpoints and midpoint", () => {
    expect(G.lerp([0, 0, 0], [10, 0, 0], 0)).toEqual([0, 0, 0]);
    expect(G.lerp([0, 0, 0], [10, 0, 0], 1)).toEqual([10, 0, 0]);
    expect(G.lerp([0, 0, 0], [10, 20, 0], 0.5)).toEqual([5, 10, 0]);
  });
});

describe("curve constructors", () => {
  it("line samples endpoints and honours a sample count", () => {
    const c = G.line([0, 0, 0], [1, 0, 0], 2);
    expect(c.points).toEqual([
      [0, 0, 0],
      [1, 0, 0],
    ]);
    expect(G.line([0, 0, 0], [1, 0, 0], 5).points).toHaveLength(5);
  });

  it("arc lands on its endpoints at the given radius", () => {
    const c = G.arc([0, 0, 0], 2, 0, 180, "xy", 5);
    expect(c.points[0][0]).toBeCloseTo(2, 9); // 0deg -> (r,0)
    expect(c.points[0][1]).toBeCloseTo(0, 9);
    const last = c.points[c.points.length - 1];
    expect(last[0]).toBeCloseTo(-2, 9); // 180deg -> (-r,0)
    expect(last[1]).toBeCloseTo(0, 9);
  });

  it("circle is closed (first point == last point)", () => {
    const c = G.circle(3, "xy", 16);
    expect(c.points[0][0]).toBeCloseTo(c.points[c.points.length - 1][0], 9);
    expect(c.points[0][1]).toBeCloseTo(c.points[c.points.length - 1][1], 9);
  });

  it("rectangle is a closed 5-point loop of the right size", () => {
    const c = G.rectangle(4, 2, "xy");
    expect(c.points).toHaveLength(5);
    expect(c.points[0]).toEqual(c.points[4]);
    // width 4 along x -> spans -2..2
    const xs = c.points.map((p) => p[0]);
    expect(Math.min(...xs)).toBe(-2);
    expect(Math.max(...xs)).toBe(2);
  });

  it("grid is centred and has cols*rows points", () => {
    const pts = G.grid(2, 2, 1, 1);
    expect(pts).toHaveLength(4);
    expect(pts).toContainEqual([-0.5, 0, -0.5]);
    expect(pts).toContainEqual([0.5, 0, 0.5]);
  });

  it("extrudePoints lifts each point into a 2-point post", () => {
    const posts = G.extrudePoints([[0, 0, 0]], 2.5, "y");
    expect(posts).toHaveLength(1);
    expect(posts[0].points).toEqual([
      [0, 0, 0],
      [0, 2.5, 0],
    ]);
  });
});

describe("parsePoints", () => {
  it("parses `x, y, z` per line and ignores comments/blanks", () => {
    expect(G.parsePoints("# head\n0,0,0\n\n1, 2, 3\n# note")).toEqual([
      [0, 0, 0],
      [1, 2, 3],
    ]);
  });
  it("accepts whitespace separators and skips short/invalid lines", () => {
    expect(G.parsePoints("1 2 3\n4 5\nfoo bar baz")).toEqual([[1, 2, 3]]);
  });
});

describe("polyline (freeform curve)", () => {
  const pts: Vec3[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0]];

  it("returns the control points unchanged when not smoothed", () => {
    expect(G.polyline(pts, false, 0).points).toEqual(pts);
  });

  it("closes the loop by repeating the first point", () => {
    const c = G.polyline(pts, true, 0);
    expect(c.points[c.points.length - 1]).toEqual([0, 0, 0]);
    expect(c.points).toHaveLength(4);
  });

  it("returns a copy for fewer than 2 points", () => {
    expect(G.polyline([[5, 5, 5]], false, 10).points).toEqual([[5, 5, 5]]);
  });

  it("smoothing passes through every control point", () => {
    const c = G.polyline(pts, false, 4);
    // first and last control points are hit exactly
    expect(c.points[0]).toEqual([0, 0, 0]);
    expect(c.points[c.points.length - 1]).toEqual([2, 0, 0]);
    // the middle control point appears among the samples
    expect(c.points.some((p) => p[0] === 1 && p[1] === 0 && p[2] === 0)).toBe(true);
    // segs(2) * div(5) + 1
    expect(c.points).toHaveLength(2 * 5 + 1);
  });

  it("smoothing a straight control polygon stays straight and monotonic", () => {
    const c = G.polyline(pts, false, 6);
    expect(c.points.every((p) => p[1] === 0 && p[2] === 0)).toBe(true);
    for (let i = 1; i < c.points.length; i++) {
      expect(c.points[i][0]).toBeGreaterThanOrEqual(c.points[i - 1][0]);
    }
  });

  it("a smoothed closed curve returns to its start", () => {
    const square: Vec3[] = [[0, 0, 0], [2, 0, 0], [2, 0, 2], [0, 0, 2]];
    const c = G.polyline(square, true, 5);
    expect(c.points[0]).toEqual(c.points[c.points.length - 1]);
  });
});

describe("curveLength", () => {
  it("measures a straight segment", () => {
    expect(G.curveLength(line2([0, 0, 0], [3, 4, 0]))).toBe(5);
  });
  it("sums a polyline", () => {
    expect(
      G.curveLength({ points: [[0, 0, 0], [1, 0, 0], [1, 1, 0]] }),
    ).toBe(2);
  });
});

describe("divide", () => {
  it("spaces points evenly along a straight line", () => {
    const pts = G.divide(line2([0, 0, 0], [10, 0, 0]), 6);
    expect(pts).toHaveLength(6);
    expect(pts.map((p) => p[0])).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it("returns endpoints for count 2", () => {
    const pts = G.divide(line2([0, 0, 0], [4, 0, 0]), 2);
    expect(pts).toEqual([
      [0, 0, 0],
      [4, 0, 0],
    ]);
  });

  it("degenerate: count < 1 returns a copy of the points", () => {
    const pts = G.divide(line2([0, 0, 0], [1, 0, 0]), 0);
    expect(pts).toEqual([
      [0, 0, 0],
      [1, 0, 0],
    ]);
  });

  it("degenerate: a zero-length curve returns count copies of the point", () => {
    const pts = G.divide({ points: [[2, 2, 2], [2, 2, 2]] }, 3);
    expect(pts).toEqual([
      [2, 2, 2],
      [2, 2, 2],
      [2, 2, 2],
    ]);
  });
});

describe("pointAtLength", () => {
  const c = line2([0, 0, 0], [10, 0, 0]);
  it("finds the midpoint", () => {
    expect(G.pointAtLength(c, 5)).toEqual([5, 0, 0]);
  });
  it("clamps past the end to the last point", () => {
    expect(G.pointAtLength(c, 999)).toEqual([10, 0, 0]);
  });
  it("returns the sole point of a single-point curve", () => {
    expect(G.pointAtLength({ points: [[7, 8, 9]] }, 3)).toEqual([7, 8, 9]);
  });
});

describe("angleBetween", () => {
  it("perpendicular is 90", () => {
    expect(G.angleBetween([1, 0, 0], [0, 1, 0])).toBeCloseTo(90, 9);
  });
  it("parallel is 0, opposite is 180", () => {
    expect(G.angleBetween([1, 0, 0], [2, 0, 0])).toBeCloseTo(0, 9);
    expect(G.angleBetween([1, 0, 0], [-1, 0, 0])).toBeCloseTo(180, 9);
  });
  it("guards a zero-length vector", () => {
    expect(G.angleBetween([0, 0, 0], [1, 0, 0])).toBe(0);
  });
});

describe("nodeStations / splitCurveAtLengths / subCurve", () => {
  const c = line2([0, 0, 0], [1, 0, 0]); // length 1

  it("places diaphragm stations at the spacing interval", () => {
    const stations = G.nodeStations(c, 0.3);
    expect(stations).toHaveLength(3);
    [0.3, 0.6, 0.9].forEach((expected, i) => expect(stations[i]).toBeCloseTo(expected, 9));
    expect(G.nodeStations(c, 0)).toEqual([]);
  });

  it("splits into internode segments whose lengths sum to the whole", () => {
    const segs = G.splitCurveAtLengths(c, [0.3, 0.6, 0.9]);
    expect(segs).toHaveLength(4);
    const total = segs.reduce((s, seg) => s + G.curveLength(seg), 0);
    expect(total).toBeCloseTo(1, 9);
  });

  it("subCurve keeps interior vertices so curvature survives the cut", () => {
    const poly: Curve = { points: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]] };
    const sub = G.subCurve(poly, 0.5, 2.5);
    // endpoints at the requested stations, with the interior vertices between them kept
    expect(sub.points[0]).toEqual([0.5, 0, 0]);
    expect(sub.points[sub.points.length - 1]).toEqual([2.5, 0, 0]);
    expect(sub.points).toContainEqual([1, 0, 0]);
    expect(sub.points).toContainEqual([2, 0, 0]);
  });
});

describe("intersectCurves", () => {
  it("finds a crossing point within tolerance", () => {
    const a = [line2([-1, 0, 0], [1, 0, 0])];
    const b = [line2([0, -1, 0], [0, 1, 0])];
    const hits = G.intersectCurves(a, b, 0.05);
    expect(hits).toHaveLength(1);
    expect(hits[0][0]).toBeCloseTo(0, 6);
    expect(hits[0][1]).toBeCloseTo(0, 6);
  });

  it("returns nothing for segments that do not approach", () => {
    const a = [line2([-1, 0, 0], [1, 0, 0])];
    const b = [line2([0, -1, 5], [0, 1, 5])]; // offset far in z
    expect(G.intersectCurves(a, b, 0.05)).toHaveLength(0);
  });

  it("collapses coincident hits to one point", () => {
    const a = [line2([-1, 0, 0], [1, 0, 0]), line2([-1, 0, 0], [1, 0, 0])];
    const b = [line2([0, -1, 0], [0, 1, 0])];
    expect(G.intersectCurves(a, b, 0.05)).toHaveLength(1);
  });
});

describe("transforms", () => {
  it("rotatePoint about Z by 90 maps +x to +y", () => {
    const r = G.rotatePoint([1, 0, 0], 0, 0, 90);
    expect(r[0]).toBeCloseTo(0, 9);
    expect(r[1]).toBeCloseTo(1, 9);
    expect(r[2]).toBeCloseTo(0, 9);
  });

  it("rotatePoint about X by 90 maps +y to +z", () => {
    const r = G.rotatePoint([0, 1, 0], 90, 0, 0);
    expect(r[0]).toBeCloseTo(0, 9);
    expect(r[1]).toBeCloseTo(0, 9);
    expect(r[2]).toBeCloseTo(1, 9);
  });

  it("transformPoint scales, then rotates, then translates", () => {
    const r = G.transformPoint([1, 0, 0], [10, 0, 0], [0, 0, 90], [2, 2, 2]);
    // scale -> (2,0,0); rotate Z90 -> (0,2,0); translate -> (10,2,0)
    expect(r[0]).toBeCloseTo(10, 9);
    expect(r[1]).toBeCloseTo(2, 9);
    expect(r[2]).toBeCloseTo(0, 9);
  });

  it("transformCurve maps every point", () => {
    const c = G.transformCurve(line2([0, 0, 0], [1, 0, 0]), [5, 0, 0], [0, 0, 0], [1, 1, 1]);
    expect(c.points).toEqual([
      [5, 0, 0],
      [6, 0, 0],
    ]);
  });

  it("mirrorAcross flips the correct axis per plane", () => {
    expect(G.mirrorAcross([1, 2, 3], "yz")).toEqual([-1, 2, 3]);
    expect(G.mirrorAcross([1, 2, 3], "xz")).toEqual([1, -2, 3]);
    expect(G.mirrorAcross([1, 2, 3], "xy")).toEqual([1, 2, -3]);
  });
});

describe("loft / weave", () => {
  it("loftCurves returns `count` generators bridging the two rails", () => {
    const a = line2([0, 0, 0], [2, 0, 0]);
    const b = line2([0, 2, 0], [2, 2, 0]);
    const gens = G.loftCurves(a, b, 3);
    expect(gens).toHaveLength(3);
    // first generator connects the two rails' starts
    expect(gens[0].points[0]).toEqual([0, 0, 0]);
    expect(gens[0].points[1]).toEqual([0, 2, 0]);
  });

  it("weaveLattice yields u warp + v weft lines", () => {
    expect(G.weaveLattice(3, 2.4, 8, 7, "xy")).toHaveLength(15);
  });
});

describe("mesh builders (smoke)", () => {
  const c: Curve = { points: [[0, 0, 0], [0, 1, 0], [0, 2, 0]] };

  it("tubeGeometry produces a non-empty indexed buffer", () => {
    const geo = G.tubeGeometry(c, 0.05, 0.04, 8);
    const pos = geo.getAttribute("position");
    expect(pos.count).toBeGreaterThan(0);
    expect(geo.getIndex()).not.toBeNull();
    // 3 rings x (8+1) verts
    expect(pos.count).toBe(3 * 9);
  });

  it("stripGeometry produces 4 verts per station", () => {
    const geo = G.stripGeometry(c, 0.03, 0.006);
    expect(geo.getAttribute("position").count).toBe(3 * 4);
    expect(geo.getIndex()).not.toBeNull();
  });
});
