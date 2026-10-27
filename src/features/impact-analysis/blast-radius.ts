// Breadth-first impact traversal. "Dependents" are things that call or import
// the selected node; distance is the number of hops along those reverse edges.

import type { AnalysisResult, ImpactEdge } from "./types";

export type Radius = {
  center: string;
  /** node id → hop distance from the center (center = 0). */
  distance: Map<string, number>;
  /** node id → the edge that reached it first (for "show path"). */
  via: Map<string, ImpactEdge>;
  /** Test cases that call the center or anything within the radius. */
  tests: { id: string; reaches: string; distance: number }[];
};

export function blastRadius(result: AnalysisResult, center: string, maxDepth: number): Radius {
  const node = result.nodes.find((n) => n.id === center);
  const reverse = new Map<string, ImpactEdge[]>();
  for (const e of result.edges) {
    if (e.kind === "tests") continue;
    // Files propagate through imports; symbols through calls.
    if (node?.kind === "file" ? e.kind !== "imports" : e.kind !== "calls") continue;
    (reverse.get(e.target) ?? reverse.set(e.target, []).get(e.target)!).push(e);
  }
  const distance = new Map<string, number>([[center, 0]]);
  const via = new Map<string, ImpactEdge>();
  let frontier = [center];
  for (let d = 1; d <= maxDepth && frontier.length; d++) {
    const next: string[] = [];
    for (const id of frontier)
      for (const e of reverse.get(id) ?? []) {
        if (distance.has(e.source)) continue;
        distance.set(e.source, d);
        via.set(e.source, e);
        next.push(e.source);
      }
    frontier = next;
  }

  // Tests attach to symbols; for a file center, use the file's symbols.
  const reachable = new Set(distance.keys());
  if (node?.kind === "file") result.nodes.filter((n) => n.fileId === center).forEach((n) => reachable.add(n.id));
  const tests: Radius["tests"] = [];
  for (const e of result.edges)
    if (e.kind === "tests" && reachable.has(e.target) && !tests.some((t) => t.id === e.source))
      tests.push({ id: e.source, reaches: e.target, distance: distance.get(e.target) ?? 0 });
  return { center, distance, via, tests };
}

/** The chain of edges from a node back to the center. */
export function pathToCenter(radius: Radius, id: string) {
  const path: ImpactEdge[] = [];
  let cur = id;
  while (radius.via.has(cur)) {
    const e = radius.via.get(cur)!;
    path.push(e);
    cur = e.target;
  }
  return path;
}

export const directCallers = (r: AnalysisResult, id: string) => r.edges.filter((e) => e.target === id && (e.kind === "calls" || e.kind === "imports"));
export const callees = (r: AnalysisResult, id: string) => r.edges.filter((e) => e.source === id && e.kind === "calls");
export const linkedTests = (r: AnalysisResult, id: string) => r.edges.filter((e) => e.target === id && e.kind === "tests");
