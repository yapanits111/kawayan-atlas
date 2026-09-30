// Graph evaluation engine (whitepaper §6b): topological, dependency-ordered, live.
import { NODE_DEFS, type NodeCtx } from "./nodeDefs";
import type { CheckResult, Curve, Element, InventoryReport, Joint, Schedule, Vec3 } from "./types";

export interface GNode {
  id: string;
  type: string;
  data: { params: Record<string, number | string> };
}
export interface GEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** Which node's output put each thing in the 3D scene — so a click on it can find its node. */
export interface SceneOrigin {
  elements: Record<string, string>; // element id → node
  curves: string[]; // parallel to scene.curves
  points: string[]; // parallel to scene.points
  joints: Record<string, string>; // joint id → node
}

export interface EvalResult {
  outputs: Record<string, Record<string, unknown>>;
  scene: { elements: Element[]; curves: Curve[]; points: Vec3[]; joints: Joint[]; origin: SceneOrigin };
  order: string[]; // node ids in evaluation (dependency) order
  schedule: Schedule | null;
  checks: CheckResult | null;
  inventory: InventoryReport | null;
  errors: Record<string, string>;
}

export function evaluateGraph(nodes: GNode[], edges: GEdge[]): EvalResult {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outputs: Record<string, Record<string, unknown>> = {};
  const errors: Record<string, string> = {};

  // Incoming edges per node.
  const incoming = new Map<string, GEdge[]>();
  const indeg = new Map<string, number>();
  for (const n of nodes) {
    incoming.set(n.id, []);
    indeg.set(n.id, 0);
  }
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    incoming.get(e.target)!.push(e);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }

  // Kahn topological sort.
  const queue = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const order: string[] = [];
  const deg = new Map(indeg);
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of edges) {
      if (e.source !== id) continue;
      const d = (deg.get(e.target) ?? 0) - 1;
      deg.set(e.target, d);
      if (d === 0) queue.push(e.target);
    }
  }

  // Piece marks are allocated from one counter shared by the whole evaluation, so two
  // culm nodes cannot both emit C1 (colliding marks get dropped by the collectors below).
  const marks: Record<string, number> = {};
  const ctxFor = (nodeId: string): NodeCtx => ({
    nodeId,
    nextId: (prefix) => `${prefix}${(marks[prefix] = (marks[prefix] ?? 0) + 1)}`,
  });

  // Evaluate in order.
  for (const id of order) {
    const node = byId.get(id)!;
    const def = NODE_DEFS[node.type];
    if (!def) {
      errors[id] = `Unknown node: ${node.type}`;
      outputs[id] = {};
      continue;
    }
    const resolved: Record<string, unknown> = {};
    for (const e of incoming.get(id)!) {
      const src = outputs[e.source];
      if (src && e.sourceHandle != null && e.targetHandle != null) {
        resolved[e.targetHandle] = src[e.sourceHandle];
      }
    }
    try {
      outputs[id] = def.compute(resolved, node.data.params ?? {}, ctxFor(id));
    } catch (err) {
      errors[id] = err instanceof Error ? err.message : "error";
      outputs[id] = {};
    }
  }

  // Which outputs are consumed downstream (used as an edge source)?
  const usedOutput = new Set<string>();
  for (const e of edges) usedOutput.add(`${e.source}::${e.sourceHandle}`);

  const elements: Element[] = [];
  const seen = new Set<string>();
  const curves: Curve[] = [];
  const points: Vec3[] = [];
  const joints: Joint[] = [];
  const jointsSeen = new Set<string>();
  const origin: SceneOrigin = { elements: {}, curves: [], points: [], joints: {} };
  let schedule: Schedule | null = null;
  let checks: CheckResult | null = null;
  let inventory: InventoryReport | null = null;

  const pushElements = (v: unknown, from: string) => {
    if (Array.isArray(v)) {
      for (const el of v as Element[]) {
        if (el?.kind && !seen.has(el.id)) {
          seen.add(el.id);
          elements.push(el);
          origin.elements[el.id] = from;
        }
      }
    }
  };

  for (const node of nodes) {
    const def = NODE_DEFS[node.type];
    const out = outputs[node.id];
    if (!def || !out) continue;
    for (const port of def.outputs) {
      const key = `${node.id}::${port.id}`;
      const terminal = !usedOutput.has(key);
      const val = out[port.id];
      if (port.kind === "schedule") {
        const s = val as Schedule | undefined;
        if (s && (!schedule || s.rows.length > schedule.rows.length)) schedule = s;
      } else if (port.kind === "checks") {
        const c = val as CheckResult | undefined;
        if (c && (!checks || c.flags.length > checks.flags.length)) checks = c;
      } else if (port.kind === "inventory") {
        const r = val as InventoryReport | undefined;
        if (r && (!inventory || r.poles.length > inventory.poles.length)) inventory = r;
      } else if (port.kind === "joints") {
        if (Array.isArray(val))
          for (const j of val as Joint[])
            if (j?.id && !jointsSeen.has(j.id)) {
              jointsSeen.add(j.id);
              joints.push(j);
              origin.joints[j.id] = node.id;
            }
      } else if (terminal) {
        if (port.kind === "elements") pushElements(val, node.id);
        else if (port.kind === "curve" || port.kind === "curves") {
          // Geometry ports (array, transform, mirror) carry members as well as bare curves;
          // members are drawn as members, never handed to the curve renderer.
          for (const item of Array.isArray(val) ? val : val ? [val] : []) {
            if ((item as Element)?.kind) pushElements([item], node.id);
            else if (Array.isArray((item as Curve)?.points)) {
              curves.push(item as Curve);
              origin.curves.push(node.id);
            }
          }
        } else if (port.kind === "points" && Array.isArray(val)) {
          points.push(...(val as Vec3[]));
          for (let k = 0; k < val.length; k++) origin.points.push(node.id);
        }
      }
    }
    // Always render elements that a schedule documents.
    if (node.type === "schedule") {
      for (const e of incoming.get(node.id)!) {
        if (e.targetHandle === "in") pushElements(outputs[e.source]?.[e.sourceHandle ?? ""], e.source);
      }
    }
  }

  return { outputs, scene: { elements, curves, points, joints, origin }, order, schedule, checks, inventory, errors };
}
