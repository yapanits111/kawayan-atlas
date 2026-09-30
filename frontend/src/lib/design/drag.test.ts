import { describe, it, expect } from "vitest";
import { dragPlane, rayPlane, dragTo } from "./drag";
import type { Vec3 } from "./types";

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
