import type { ArchitectureViolation, ImpactEdge, ImpactNode, Layer, LayerRule } from "./types";

/** Layer for a path from explicit configuration. No match means "unclassified", never a guess. */
export function layerFor(path: string, layers: Layer[]) {
  return layers.find((l) => l.patterns.some((p) => path.includes(p)))?.id ?? "unclassified";
}

/** Tarjan's strongly connected components; returns only components with a cycle. */
export function stronglyConnected(nodes: string[], edges: [string, string][]) {
  const adj = new Map<string, string[]>(nodes.map((n) => [n, []]));
  edges.forEach(([a, b]) => adj.get(a)?.push(b));
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const on = new Set<string>();
  const out: string[][] = [];
  const strong = (v: string) => {
    idx.set(v, index);
    low.set(v, index++);
    stack.push(v);
    on.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (on.has(w)) low.set(v, Math.min(low.get(v)!, idx.get(w)!));
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        on.delete(w);
        comp.push(w);
      } while (w !== v);
      const selfLoop = edges.some(([a, b]) => a === v && b === v);
      if (comp.length > 1 || selfLoop) out.push(comp.reverse());
    }
  };
  nodes.forEach((n) => idx.has(n) || strong(n));
  return out;
}

export function architecture(nodes: ImpactNode[], edges: ImpactEdge[], layers: Layer[], rules: LayerRule[]) {
  const layerOf: Record<string, string> = {};
  nodes.forEach((n) => (layerOf[n.id] = layerFor(n.path, layers)));
  const order = new Map(layers.map((l, i) => [l.id, i]));
  const ruleIds = new Set(rules.map((r) => r.id));

  const violations: ArchitectureViolation[] = [];
  for (const e of edges.filter((e) => e.kind === "imports")) {
    const from = layerOf[e.source];
    const to = layerOf[e.target];
    if (from === "unclassified" || to === "unclassified") continue;
    if (ruleIds.has("pure-domain") && from === "domain" && to === "infrastructure")
      violations.push({ edgeId: e.id, ruleId: "pure-domain", from: e.source, to: e.target, fromLayer: from, toLayer: to });
    else if (ruleIds.has("no-upward") && order.get(to)! < order.get(from)!)
      violations.push({ edgeId: e.id, ruleId: "no-upward", from: e.source, to: e.target, fromLayer: from, toLayer: to });
  }

  const fileNodes = nodes.filter((n) => n.kind === "file" && n.changeStatus !== "deleted").map((n) => n.id);
  const importPairs = edges.filter((e) => e.kind === "imports").map((e) => [e.source, e.target] as [string, string]);
  const cycles = stronglyConnected(fileNodes, importPairs);
  return { layerOf, violations, cycles };
}
