// Shared types for the node-graph design platform (whitepaper §6).

export type Vec3 = [number, number, number];

/** A curve is represented as an ordered, sampled polyline. Arcs/lines all reduce to this,
 *  so every downstream operation (divide, sweep) works uniformly. */
export interface Curve {
  points: Vec3[];
}

/** A buildable bamboo element — the output of the bamboo layer, consumed by the schedule. */
export interface Element {
  id: string;
  kind: "culm" | "strip";
  curve: Curve;
  length: number; // arc length (m)
  // culm
  startDiameter?: number; // mm
  endDiameter?: number; // mm
  wallThickness?: number; // mm
  // strip
  width?: number; // mm
  thickness?: number; // mm
  // connection geometry
  cutAngleStart?: number; // deg
  cutAngleEnd?: number; // deg
}

export interface Joint {
  id: string;
  position: Vec3;
  count: number; // how many element ends meet here
}

/** Kinds of value that flow along wires. */
export type PortKind =
  | "number"
  | "points"
  | "curve"
  | "curves"
  | "elements"
  | "joints"
  | "schedule"
  | "checks";

export interface CheckFlag {
  elementId: string;
  severity: "info" | "warning";
  message: string;
}

export interface CheckResult {
  flags: CheckFlag[];
  summary: { checked: number; flagged: number };
  disclaimer: string;
}

export interface ScheduleRow {
  id: string;
  kind: string;
  length_m: number;
  detail: string; // Ø start→end / w×t etc.
  cut_start_deg?: number;
  cut_end_deg?: number;
}

export interface Schedule {
  rows: ScheduleRow[];
  totals: { count: number; totalLength_m: number; estCulms: number };
}
