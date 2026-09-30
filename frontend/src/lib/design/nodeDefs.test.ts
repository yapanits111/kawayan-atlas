import { describe, it, expect } from "vitest";
import { NODE_DEFS } from "./nodeDefs";
import { EXAMPLES } from "./examples";

// Every numeric param renders as a slider, so it needs a usable range.
const numericParams = Object.values(NODE_DEFS).flatMap((def) =>
  def.params.filter((p) => typeof p.default === "number").map((p) => ({ def, p })),
);

describe("node params are slider-ready", () => {
  it.each(numericParams.map(({ def, p }) => [`${def.type}.${p.key}`, p] as const))(
    "%s has a finite range containing its default, on the step grid",
    (_name, p) => {
      expect(Number.isFinite(p.min)).toBe(true);
      expect(Number.isFinite(p.max)).toBe(true);
      expect(p.min!).toBeLessThan(p.max!);
      const d = p.default as number;
      expect(d).toBeGreaterThanOrEqual(p.min!);
      expect(d).toBeLessThanOrEqual(p.max!);
      const steps = (d - p.min!) / (p.step ?? 1);
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
    },
  );

  it("the spline node exposes smoothing and tension", () => {
    const keys = NODE_DEFS.polyline.params.map((p) => p.key);
    expect(keys).toEqual(expect.arrayContaining(["pts", "closed", "smooth", "tension"]));
  });
});

describe("worked examples stay inside the slider ranges", () => {
  for (const ex of EXAMPLES) {
    it(ex.label, () => {
      for (const node of ex.graph.nodes) {
        const def = NODE_DEFS[node.data.type];
        for (const p of def.params) {
          const v = node.data.params[p.key];
          if (typeof p.default !== "number" || typeof v !== "number") continue;
          expect(v, `${node.id}.${p.key}`).toBeGreaterThanOrEqual(p.min!);
          expect(v, `${node.id}.${p.key}`).toBeLessThanOrEqual(p.max!);
        }
      }
    });
  }
});
