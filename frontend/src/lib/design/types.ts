// Shared types for the node-graph design platform (whitepaper §6).

export type Vec3 = [number, number, number];

/** A curve is represented as an ordered, sampled polyline. Arcs/lines all reduce to this,
 *  so every downstream operation (divide, sweep) works uniformly. */
export interface Curve {
  points: Vec3[];
}

/** Which validation regime an element falls under (whitepaper §9).
 *  ISO 22156:2021 covers round culms and *explicitly excludes* engineered bamboo
 *  (glue-laminated, cross-laminated, oriented-strand, densified). Processed material can
 *  therefore be modelled freely but has no settled international code path — the platform
 *  labels that difference rather than quietly blurring it. */
export type Verification = "iso22156-round" | "outside-iso22156";

export const VERIFICATION_LABEL: Record<Verification, string> = {
  "iso22156-round": "Round culm — ISO 22156:2021 applies",
  "outside-iso22156": "Processed/engineered — outside ISO 22156, no international code path",
};

/** A buildable bamboo element — the output of the bamboo layer, consumed by the schedule. */
export interface Element {
  id: string;
  kind: "culm" | "strip" | "laminate";
  curve: Curve;
  length: number; // arc length (m)
  verification?: Verification;
  // culm
  startDiameter?: number; // mm
  endDiameter?: number; // mm
  wallThickness?: number; // mm
  nodeSpacing?: number; // m — diaphragm interval (0 = nodes not modelled)
  nodeCount?: number; // diaphragms falling within this element
  // strip / laminate
  width?: number; // mm
  thickness?: number; // mm
  // laminate
  layers?: number; // plies in the layup
  layup?: string; // e.g. "5 × 6 mm parallel" (glulam) / "alternating" (cross-lam)
  // connection geometry
  cutAngleStart?: number; // deg
  cutAngleEnd?: number; // deg
}

export interface Joint {
  id: string;
  position: Vec3;
  count: number; // how many element ends meet here
  type?: string; // joint-library id, e.g. "fish-mouth" (whitepaper §3)
  typeLabel?: string; // human label carried from the joint library
  angle?: number; // included angle between the meeting members (deg)
  memberIds?: string[]; // which elements meet here
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
  | "checks"
  | "inventory";


/** One real, measured pole in a yard inventory (whitepaper §8). */
export interface Pole {
  id: string;
  length: number; // m
  baseDiameter: number; // mm
  tipDiameter: number; // mm
}

/** A piece cut from a pole, at a station measured from the pole's base. */
export interface PoleCut {
  elementId: string;
  at: number; // m
  length: number; // m
}

export interface PoleAssignment {
  poleId: string;
  length: number;
  baseDiameter: number;
  tipDiameter: number;
  cuts: PoleCut[];
  used: number; // m broached, kerf included
  offcut: number; // m left
}

export interface UnmatchedPiece {
  elementId: string;
  length: number;
  diameter: number;
  reason: string;
}

/** Reconciliation of a design against measured stock — Phase 4. */
export interface InventoryReport {
  poles: PoleAssignment[];
  unmatched: UnmatchedPiece[];
  processed: string[]; // strips/laminates: not cut from whole poles
  totals: {
    piecesPlaced: number;
    piecesTotal: number;
    polesUsed: number;
    polesAvailable: number;
    stockLength: number; // m of pole available in the yard
    broachedLength: number; // m committed once a pole is cut into
    cutLength: number; // m actually ending up in members
    wastePct: number; // offcut as a share of the broached poles
  };
  note: string;
}

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
  nodes?: number; // diaphragms in this piece — affects where it may be cut and bolted
  layup?: string; // laminated members only (§8)
  verification?: Verification;
  cut_start_deg?: number;
  cut_end_deg?: number;
}

/** A joint enumerated with its type and location — the other half of the buildable
 *  document the whitepaper asks for (§6d, §8). */
export interface JointRow {
  id: string;
  type: string;
  members: number;
  memberIds: string;
  angle_deg?: number;
  x: number;
  y: number;
  z: number;
}

/** Identical pieces collapsed into one line — the buildable bill of materials a fabricator
 *  actually orders and cuts from (§8: a "fabrication-ready" cut-list, not a row per stick). */
export interface ScheduleGroup {
  kind: string;
  detail: string; // the section / taper shared by every piece in the group
  length_m: number; // each piece's length
  count: number; // how many identical pieces
  totalLength_m: number; // count × length
  layup?: string;
  verification?: Verification;
}

export interface Schedule {
  rows: ScheduleRow[];
  groups: ScheduleGroup[];
  joints: JointRow[];
  totals: { count: number; totalLength_m: number; estCulms: number; jointCount: number };
}
