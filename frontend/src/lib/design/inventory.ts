// Reconciling a design against a specific inventory of real, measured poles
// (whitepaper §8, Phase 4). Natural bamboo varies pole to pole, so the bridge from an
// idealised model to buildable output is matching each piece to stock that can actually
// yield it — by length *and* by the diameter available at that point along the taper.
import type { Element, InventoryReport, Pole, PoleAssignment, UnmatchedPiece } from "./types";

/** Parse a measured-pole list. One pole per line:
 *    `id, length_m, base_mm, tip_mm`  —  id and tip are optional.
 *  Blank lines and `#` comments are ignored; commas or whitespace both separate. */
export function parsePoles(text: string): Pole[] {
  const poles: Pole[] = [];
  for (const raw of String(text ?? "").split("\n")) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const parts = line.split(/[,\s]+/).filter(Boolean);
    if (!parts.length) continue;

    // A leading non-numeric field is the pole's id.
    let id: string;
    let nums: number[];
    if (Number.isNaN(Number(parts[0]))) {
      id = parts[0];
      nums = parts.slice(1).map(Number);
    } else {
      id = `P${poles.length + 1}`;
      nums = parts.map(Number);
    }
    const [length, base, tip] = nums;
    if (!Number.isFinite(length) || length <= 0) continue;
    if (!Number.isFinite(base) || base <= 0) continue;
    poles.push({
      id,
      length,
      baseDiameter: base,
      tipDiameter: Number.isFinite(tip) && tip > 0 ? tip : base,
    });
  }
  return poles;
}

/** Diameter of a pole at a station measured from its base, in mm. */
function diameterAt(pole: Pole, station: number): number {
  const t = pole.length > 0 ? Math.min(1, Math.max(0, station / pole.length)) : 0;
  return pole.baseDiameter + (pole.tipDiameter - pole.baseDiameter) * t;
}

/**
 * First-fit-decreasing assignment of cut pieces to measured poles.
 *
 * Only round culms are cut from whole poles — strips and laminates come from processed
 * stock whose yield is a different question, so they are reported as not applicable
 * rather than silently packed.
 */
export function reconcile(elements: Element[], poles: Pole[], kerf: number, tolMm: number): InventoryReport {
  const stock: PoleAssignment[] = poles.map((p) => ({
    poleId: p.id,
    length: p.length,
    baseDiameter: p.baseDiameter,
    tipDiameter: p.tipDiameter,
    cuts: [],
    used: 0,
    offcut: p.length,
  }));
  const byId = new Map(poles.map((p) => [p.id, p]));

  const round = elements.filter((e) => e.kind === "culm");
  const processed = elements.filter((e) => e.kind !== "culm");

  // Longest first: the hardest pieces to place go while the most stock is still whole.
  const queue = [...round].sort((a, b) => b.length - a.length);

  const unmatched: UnmatchedPiece[] = [];
  for (const el of queue) {
    const needD0 = el.startDiameter ?? 0;
    const needD1 = el.endDiameter ?? needD0;
    let placed = false;
    let sawLongEnough = false;

    for (const bin of stock) {
      const pole = byId.get(bin.poleId)!;
      const start = bin.used === 0 ? 0 : bin.used + kerf;
      if (start + el.length > pole.length + 1e-9) continue;
      sawLongEnough = true;
      // The pole must still be thick enough over the span this piece would occupy.
      if (
        diameterAt(pole, start) + tolMm < needD0 ||
        diameterAt(pole, start + el.length) + tolMm < needD1
      ) {
        continue;
      }
      bin.cuts.push({ elementId: el.id, at: round2(start), length: round2(el.length) });
      bin.used = start + el.length;
      bin.offcut = round2(pole.length - bin.used);
      placed = true;
      break;
    }

    if (!placed) {
      unmatched.push({
        elementId: el.id,
        length: round2(el.length),
        diameter: Math.round(needD0),
        reason: sawLongEnough
          ? `no remaining pole is Ø${Math.round(needD0)} mm at the needed point`
          : `no pole has ${round2(el.length)} m of usable length left`,
      });
    }
  }

  const used = stock.filter((b) => b.cuts.length > 0);
  const stockLength = poles.reduce((s, p) => s + p.length, 0);
  // Once a pole is broached its whole length is committed to the job, so waste is
  // measured against the poles actually cut into — not against the metres of saw travel.
  const broachedLength = used.reduce((s, b) => s + b.length, 0);
  const cutLength = round.reduce((s, e) => s + e.length, 0) - unmatched.reduce((s, u) => s + u.length, 0);

  return {
    poles: stock,
    unmatched,
    processed: processed.map((e) => e.id),
    totals: {
      piecesPlaced: round.length - unmatched.length,
      piecesTotal: round.length,
      polesUsed: used.length,
      polesAvailable: poles.length,
      stockLength: round2(stockLength),
      broachedLength: round2(broachedLength),
      cutLength: round2(cutLength),
      wastePct: broachedLength > 0 ? Math.round((1 - cutLength / broachedLength) * 1000) / 10 : 0,
    },
    note:
      "Assignment is first-fit by length and by the diameter available along each pole's taper; it takes no account of curvature, node position, grading, defects, or where a culm may safely be bolted. Verify against the poles in hand.",
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
