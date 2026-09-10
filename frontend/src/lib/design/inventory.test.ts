import { describe, it, expect } from "vitest";
import { parsePoles, reconcile } from "./inventory";
import type { Element } from "./types";

function culm(id: string, length: number, d0: number, d1 = d0): Element {
  return {
    id,
    kind: "culm",
    curve: { points: [[0, 0, 0], [length, 0, 0]] },
    length,
    startDiameter: d0,
    endDiameter: d1,
  };
}
function strip(id: string, length: number): Element {
  return { id, kind: "strip", curve: { points: [[0, 0, 0], [length, 0, 0]] }, length, width: 25, thickness: 6 };
}

describe("parsePoles", () => {
  it("parses `id, length, base, tip`", () => {
    const poles = parsePoles("P1, 6.0, 105, 82");
    expect(poles).toHaveLength(1);
    expect(poles[0]).toEqual({ id: "P1", length: 6, baseDiameter: 105, tipDiameter: 82 });
  });

  it("ignores blank lines and # comments", () => {
    const poles = parsePoles("# header\n\nP1, 6, 100, 80\n   \n# note\nP2, 5, 90, 70");
    expect(poles.map((p) => p.id)).toEqual(["P1", "P2"]);
  });

  it("defaults the tip diameter to the base when omitted", () => {
    const poles = parsePoles("P1, 6, 100");
    expect(poles[0].tipDiameter).toBe(100);
  });

  it("auto-numbers a pole with no leading id", () => {
    const poles = parsePoles("6, 100, 80\n5, 90, 70");
    expect(poles.map((p) => p.id)).toEqual(["P1", "P2"]);
  });

  it("accepts whitespace separators as well as commas", () => {
    const poles = parsePoles("P1 6 100 80");
    expect(poles[0]).toEqual({ id: "P1", length: 6, baseDiameter: 100, tipDiameter: 80 });
  });

  it("skips lines with a non-positive or missing length/diameter", () => {
    expect(parsePoles("P1, 0, 100")).toHaveLength(0);
    expect(parsePoles("P1, 6")).toHaveLength(0); // no base diameter
  });
});

describe("reconcile — placement", () => {
  it("packs multiple pieces onto one long pole (first-fit decreasing)", () => {
    const els = [culm("C1", 3, 90, 80), culm("C2", 2.5, 90, 80)];
    const poles = parsePoles("P1, 6, 105, 82");
    const r = reconcile(els, poles, 0.01, 5);

    expect(r.totals.piecesPlaced).toBe(2);
    expect(r.totals.piecesTotal).toBe(2);
    expect(r.totals.polesUsed).toBe(1);
    expect(r.unmatched).toHaveLength(0);

    const p1 = r.poles.find((p) => p.poleId === "P1")!;
    expect(p1.cuts).toHaveLength(2);
    // longest goes first, at station 0
    expect(p1.cuts[0].elementId).toBe("C1");
    expect(p1.cuts[0].at).toBe(0);
    // next starts after the first cut plus the kerf
    expect(p1.cuts[1].at).toBeCloseTo(3.01, 6);
  });

  it("reports a piece too long for any pole as unmatched (by length)", () => {
    const els = [culm("C1", 7, 80)];
    const poles = parsePoles("P1, 6, 100, 80");
    const r = reconcile(els, poles, 0.01, 5);
    expect(r.totals.piecesPlaced).toBe(0);
    expect(r.unmatched).toHaveLength(1);
    expect(r.unmatched[0].elementId).toBe("C1");
    expect(r.unmatched[0].reason).toMatch(/usable length/);
  });

  it("reports a piece too thick for the available taper as unmatched (by diameter)", () => {
    const els = [culm("C1", 3, 200)]; // needs Ø200, pole is only 105 at the base
    const poles = parsePoles("P1, 6, 105, 82");
    const r = reconcile(els, poles, 0.01, 5);
    expect(r.unmatched).toHaveLength(1);
    expect(r.unmatched[0].reason).toMatch(/mm at the needed point/);
  });

  it("does not pack strips/laminates — they are processed stock, reported separately", () => {
    const els = [culm("C1", 3, 90, 80), strip("S1", 2)];
    const poles = parsePoles("P1, 6, 105, 82");
    const r = reconcile(els, poles, 0.01, 5);
    expect(r.processed).toEqual(["S1"]);
    expect(r.totals.piecesTotal).toBe(1); // only the round culm counts as a pole piece
    expect(r.poles[0].cuts.map((c) => c.elementId)).toEqual(["C1"]);
  });
});

describe("reconcile — waste accounting", () => {
  it("measures waste against broached poles, not saw travel", () => {
    // One 6 m pole, one 3 m cut -> 3 m offcut on a broached 6 m pole -> 50% waste.
    const els = [culm("C1", 3, 90, 80)];
    const poles = parsePoles("P1, 6, 105, 82");
    const r = reconcile(els, poles, 0.01, 5);
    expect(r.totals.stockLength).toBe(6);
    expect(r.totals.broachedLength).toBe(6);
    expect(r.totals.cutLength).toBe(3);
    expect(r.totals.wastePct).toBe(50);
  });

  it("reports zero waste and no broached poles for an empty design", () => {
    const r = reconcile([], parsePoles("P1, 6, 105, 82"), 0.01, 5);
    expect(r.totals.piecesTotal).toBe(0);
    expect(r.totals.polesUsed).toBe(0);
    expect(r.totals.broachedLength).toBe(0);
    expect(r.totals.wastePct).toBe(0);
  });
});
