import { describe, it, expect } from "vitest";
import { dragPlane, rayPlane, dragTo, snapInPlane, snapHeight, nearestTarget, type SnapTarget } from "./drag";
import { dot, sub } from "./geometry";
import type { Vec3 } from "./types";

const near = (a: Vec3, b: Vec3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 9));

describe("snapInPlane", () => {
  it("is the world grid on the axis planes", () => {
    near(snapInPlane([1.23, 2.07, 0], [0, 0, 1], 0.1), [1.2, 2.1, 0]); // elevation
    near(snapInPlane([1.23, 3, -0.77], [0, 1, 0], 0.25), [1.25, 3, -0.75]); // plan at y = 3
    near(snapInPlane([2, 0.49, 1.31], [-1, 0, 0], 0.5), [2, 0.5, 1.5]); // side plane at x = 2
  });

  it("keeps a point on a turned plane on that plane", () => {
    const n: Vec3 = [-Math.SQRT1_2, 0, Math.SQRT1_2]; // upright, turned 45°
    const p: Vec3 = [1.07, 1.33, 1.07 + 0.5 * Math.SQRT2]; // on the plane through (0,0,0.707…)
    const q = snapInPlane(p, n, 0.25);
    expect(dot(sub(q, p), n)).toBeCloseTo(0, 9); // didn't leave the plane
    expect(q[1]).toBeCloseTo(1.25, 9); // heights snap to the grid
  });

  it("snapHeight moves only y", () => {
    expect(snapHeight([0.33, 1.26, -2.01], 0.5)).toEqual([0.33, 1.5, -2.01]);
  });
});

describe("nearestTarget", () => {
  // A flat "camera": 100 px per metre in x/y, ignoring depth; nothing is behind it but z > 50.
  const toScreen = (p: Vec3): [number, number] | null => (p[2] > 50 ? null : [p[0] * 100, -p[1] * 100]);
  const targets: SnapTarget[] = [
    { p: [1, 1, 0], label: "C1 end" },
    { p: [1.06, 1, 3], label: "joint J1" }, // same spot on screen but deeper
    { p: [4, 4, 0], label: "far" },
    { p: [1.02, 1.02, 99], label: "behind" },
  ];

  it("takes the closest target within the radius, by screen distance", () => {
    expect(nearestTarget([1.02, 1.0, 0], targets, toScreen, 10)?.label).toBe("C1 end"); // 2 px vs 4 px
    expect(nearestTarget([1.05, 1.0, 0], targets, toScreen, 10)?.label).toBe("joint J1"); // 5 px vs 1 px
  });

  it("finds nothing outside the radius, or behind the camera", () => {
    expect(nearestTarget([2, 2, 0], targets, toScreen, 10)).toBeNull();
    expect(nearestTarget([1, 1, 99], targets, toScreen, 10)).toBeNull();
  });
});

describe("dragPlane", () => {
  it("keeps a flat curve's point in the curve's plane", () => {
    expect(dragPlane([1, 2, 0], [0, 0, 2], false, [0, 0, -1])).toEqual({ normal: [0, 0, 1], point: [1, 2, 0] });
  });

  it("slides a point of a non-flat curve horizontally", () => {
    expect(dragPlane([1, 2, 3], null, false, [0, 0, -1]).normal).toEqual([0, 1, 0]);
  });

  it("with Shift, uses a vertical plane facing the camera", () => {
    const n = dragPlane([0, 0, 0], [0, 1, 0], true, [0.6, -0.8, 0]).normal;
    expect(n).toEqual([1, 0, 0]);
    // Looking straight down there is no facing direction; fall back to the elevation plane.
    expect(dragPlane([0, 0, 0], null, true, [0, -1, 0]).normal).toEqual([0, 0, 1]);
  });
});

describe("rayPlane", () => {
  const ground = { normal: [0, 1, 0] as Vec3, point: [0, 0, 0] as Vec3 };

  it("hits the plane in front of the ray", () => {
    const hit = rayPlane([0, 5, 0], [1, -1, 0], ground)!;
    [5, 0, 0].forEach((v, i) => expect(hit[i]).toBeCloseTo(v, 9));
  });

  it("returns null for a plane behind the ray, or one it barely grazes", () => {
    expect(rayPlane([0, 5, 0], [0, 1, 0], ground)).toBeNull();
    expect(rayPlane([0, 5, 0], [1, -0.001, 0], ground)).toBeNull();
  });
});

describe("dragTo", () => {
  const xy = { normal: [0, 0, 1] as Vec3, point: [0, 0, 0] as Vec3 };

  it("moves the point to the ray's hit, keeping the grab offset", () => {
    // Grabbed 0.1 m to the left of the handle's centre.
    expect(dragTo([2, 3, 10], [0, 0, -1], xy, [0.1, 0, 0], [0, 0, 0], false)).toEqual([2.1, 3, 0]);
  });

  it("a vertical drag changes only the height", () => {
    const facing = { normal: [0, 0, 1] as Vec3, point: [1, 1, 4] as Vec3 };
    expect(dragTo([3, 2.5, 10], [0, 0, -1], facing, [0, 0, 0], [1, 1, 4], true)).toEqual([1, 2.5, 4]);
  });

  it("refuses a hit that would throw the point far away", () => {
    // Shallow enough to count as a hit, but ~975 m out.
    expect(dragTo([0, 20, 0], [1, -0.0205, 0], { normal: [0, 1, 0], point: [0, 0, 0] }, [0, 0, 0], [0, 0, 0], false)).toBeNull();
  });
});
