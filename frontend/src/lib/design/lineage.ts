// Tracing geometry in the 3D view back to the graph: which nodes lie behind a member or a
// curve, so clicking it in 3D can select its node, and selecting a node can light up what it
// produces.
import type { GEdge } from "./evaluate";

function walk(start: string, edges: GEdge[], dir: "up" | "down"): Set<string> {
  const next = new Map<string, string[]>();
  for (const e of edges) {
    const [from, to] = dir === "up" ? [e.target, e.source] : [e.source, e.target];
    next.set(from, [...(next.get(from) ?? []), to]);
  }
  const seen = new Set<string>();
  const stack = [...(next.get(start) ?? [])];
  while (stack.length) {
    const n = stack.pop()!;
    if (seen.has(n) || n === start) continue;
    seen.add(n);
    stack.push(...(next.get(n) ?? []));
  }
  return seen;
}

/** Every node upstream of `id` (not including it). */
export const ancestorsOf = (id: string, edges: GEdge[]) => walk(id, edges, "up");

/** Every node downstream of `id` (not including it). */
export const descendantsOf = (id: string, edges: GEdge[]) => walk(id, edges, "down");

/** The nodes behind something drawn in 3D: every node on a path from the graph's sources to
 *  `producer` (the node whose output is drawn). Given `via` — the node that made a member —
 *  only the paths through it count, so a member that reached the view through a merge (a
 *  bundle of posts and beams, say) isn't credited to the other branch. In evaluation order. */
export function lineage(producer: string, via: string | null, edges: GEdge[], order: string[]): string[] {
  const behind = ancestorsOf(producer, edges);
  behind.add(producer);
  let keep = behind;
  if (via && behind.has(via)) {
    const through = new Set([via, ...ancestorsOf(via, edges), ...descendantsOf(via, edges)]);
    keep = new Set([...behind].filter((n) => through.has(n)));
  }
  return order.filter((n) => keep.has(n));
}
