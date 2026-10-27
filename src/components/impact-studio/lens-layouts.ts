// Lens projections: the same canonical graph laid out five ways.
// Positions are deterministic, so a refresh never rearranges the scene.

import type { AnalysisResult, ChangeStatus, ImpactEdge, ImpactNode } from "@/features/impact-analysis/types";
import type { FixtureCommit } from "@/features/impact-analysis/fixture";
import { blastRadius, type Radius } from "@/features/impact-analysis/blast-radius";
import { isSource } from "@/features/impact-analysis/source-analysis";

export type LensId = 1 | 2 | 3 | 4 | 5;
export const LENSES: { id: LensId; key: string; label: string; short: string; tiny: string; color: string; purpose: string }[] = [
  { id: 1, key: "dependencies", label: "Dependency Constellation", short: "Dependencies", tiny: "Deps", color: "#00F0FF", purpose: "Structure and relationships" },
  { id: 2, key: "blast-radius", label: "Blast-Radius Radar", short: "Blast radius", tiny: "Radius", color: "#FF007A", purpose: "Potential downstream impact" },
  { id: 3, key: "architecture", label: "Architecture Strata", short: "Architecture", tiny: "Layers", color: "#00D995", purpose: "Layer rules and cycles" },
  { id: 4, key: "context", label: "Review Context Prism", short: "Review context", tiny: "Context", color: "#7C3AED", purpose: "What to read and test" },
  { id: 5, key: "chronos", label: "Chronos", short: "History", tiny: "History", color: "#FFB800", purpose: "Base to head, commit by commit" },
];

export type Emphasis = "selected" | "focus" | "normal" | "dim";
export type Placed = { pos: [number, number, number]; emphasis: Emphasis; status: ChangeStatus; label: boolean; ring?: number; pulse?: boolean; scale?: number };
export type SceneEdge = { id: string; source: string; target: string; kind: ImpactEdge["kind"]; tone: "import" | "call" | "test" | "violation" | "allowed" | "uncertain"; strong: boolean };
export type Projection = {
  nodes: Map<string, Placed>;
  edges: SceneEdge[];
  rings?: { radius: number; label: string }[];
  planes?: { y: number; label: string; id: string }[];
  prism?: { height: number };
  radius?: Radius;
};

const GOLD = Math.PI * (3 - Math.sqrt(5));

/** Folder that groups a file into a cluster. */
export const clusterOf = (path: string) => {
  const parts = path.split("/");
  return parts.length > 2 ? parts.slice(0, -1).join("/") : parts[0];
};

function constellationPositions(r: AnalysisResult) {
  const pos = new Map<string, [number, number, number]>();
  const files = r.nodes.filter((n) => n.kind === "file");
  const clusters = [...new Set(files.map((f) => clusterOf(f.path)))].sort();
  clusters.forEach((c, ci) => {
    const a = (ci / clusters.length) * Math.PI * 2;
    const center: [number, number, number] = [Math.cos(a) * 8.5, (ci % 2 ? 1.2 : -1.2), Math.sin(a) * 8.5];
    const members = files.filter((f) => clusterOf(f.path) === c).sort((x, y) => x.path.localeCompare(y.path));
    members.forEach((f, i) => {
      const rr = members.length === 1 ? 0 : 1.4 + Math.sqrt(i) * 1.1;
      const t = i * GOLD;
      const p: [number, number, number] = [center[0] + Math.cos(t) * rr, center[1] + (i % 3) * 0.5 - 0.5, center[2] + Math.sin(t) * rr];
      pos.set(f.id, p);
      const kids = r.nodes.filter((n) => n.fileId === f.id);
      kids.forEach((k, j) => {
        const ka = (j / Math.max(1, kids.length)) * Math.PI * 2 + i;
        pos.set(k.id, [p[0] + Math.cos(ka) * 1.05, p[1] + Math.sin(ka * 2) * 0.35 + 0.15, p[2] + Math.sin(ka) * 1.05]);
      });
    });
  });
  return pos;
}

const toneOf = (e: ImpactEdge): SceneEdge["tone"] => (e.kind === "imports" ? "import" : e.kind === "calls" ? "call" : "test");

export type ProjectionInput = {
  result: AnalysisResult;
  lens: LensId;
  selected: string | null;
  depth: number;
  layers: { imports: boolean; calls: boolean; tests: boolean };
  context: Set<string>;
  chronos: { step: number; commits: FixtureCommit[]; base: FixtureCommit };
  highlight: Set<string> | null;
};

export function project(input: ProjectionInput): Projection {
  const { result: r, lens, selected } = input;
  const base = constellationPositions(r);
  const nodes = new Map<string, Placed>();
  const byId = new Map(r.nodes.map((n) => [n.id, n]));
  const neighbours = new Set<string>();
  if (selected) r.edges.forEach((e) => (e.source === selected ? neighbours.add(e.target) : e.target === selected ? neighbours.add(e.source) : null));

  const emph = (id: string): Emphasis => {
    if (id === selected) return "selected";
    if (input.highlight) return input.highlight.has(id) ? "focus" : "dim";
    if (selected) return neighbours.has(id) ? "focus" : "normal";
    return "normal";
  };
  const important = (n: ImpactNode) => n.kind === "file" || n.changeStatus !== "unchanged";

  /* 1 — Dependency constellation ----------------------------------- */
  if (lens === 1) {
    for (const n of r.nodes) {
      if (n.changeStatus === "deleted") continue;
      nodes.set(n.id, { pos: base.get(n.id)!, emphasis: emph(n.id), status: n.changeStatus, label: important(n) || n.id === selected || neighbours.has(n.id) });
    }
    const edges = r.edges
      .filter((e) => (e.kind === "imports" ? input.layers.imports : e.kind === "calls" ? input.layers.calls : input.layers.tests))
      .map((e) => ({ id: e.id, source: e.source, target: e.target, kind: e.kind, tone: toneOf(e), strong: !!selected && (e.source === selected || e.target === selected) }));
    return { nodes, edges };
  }

  /* 2 — Blast-radius radar ----------------------------------------- */
  if (lens === 2) {
    const center = selected && byId.get(selected)?.changeStatus !== "deleted" ? selected : defaultCenter(r);
    const rad = blastRadius(r, center, input.depth);
    const rings = Array.from({ length: input.depth }, (_, i) => ({
      radius: (i + 1) * 3.4,
      label: i === 0 ? "Ring 1 · direct dependents" : i === 1 ? "Ring 2 · second-degree" : `Ring ${i + 1}`,
    }));
    const byRing = new Map<number, string[]>();
    rad.distance.forEach((d, id) => (byRing.get(d) ?? byRing.set(d, []).get(d)!).push(id));
    byRing.forEach((ids, d) => {
      ids.sort().forEach((id, i) => {
        const a = (i / ids.length) * Math.PI * 2 + d * 0.6;
        const rr = d * 3.4;
        nodes.set(id, { pos: [Math.cos(a) * rr, d === 0 ? 0.6 : 0, Math.sin(a) * rr], emphasis: id === center ? "selected" : "focus", status: byId.get(id)!.changeStatus, label: true, ring: d, pulse: d === 0 });
      });
    });
    // Tests sit below the plane, under what they call: a separate overlay, not proof of coverage.
    rad.tests.forEach((t, i) => {
      const reach = nodes.get(t.reaches)?.pos ?? [0, 0, 0];
      nodes.set(t.id, { pos: [reach[0] * 1.08 + (i % 2 ? 0.6 : -0.6), -2.4, reach[2] * 1.08], emphasis: "focus", status: byId.get(t.id)!.changeStatus, label: true });
    });
    // Everything else stays visible far out, dimmed, so the radius has context.
    const rest = r.nodes.filter((n) => !nodes.has(n.id) && n.changeStatus !== "deleted" && n.kind !== "test");
    rest.forEach((n, i) => {
      const a = i * GOLD;
      const rr = (input.depth + 1.6) * 3.4 + (i % 4) * 0.8;
      nodes.set(n.id, { pos: [Math.cos(a) * rr, -0.8 + (i % 5) * 0.3, Math.sin(a) * rr], emphasis: "dim", status: n.changeStatus, label: false });
    });
    const edges: SceneEdge[] = [];
    rad.via.forEach((e) => edges.push({ id: e.id, source: e.source, target: e.target, kind: e.kind, tone: toneOf(e), strong: true }));
    if (input.layers.tests)
      rad.tests.forEach((t) => edges.push({ id: `t:${t.id}`, source: t.id, target: t.reaches, kind: "tests", tone: "test", strong: false }));
    return { nodes, edges, rings, radius: rad };
  }

  /* 3 — Architecture strata ---------------------------------------- */
  if (lens === 3) {
    const order = ["presentation", "application", "domain", "infrastructure", "unclassified"];
    const labels: Record<string, string> = {
      presentation: "Presentation",
      application: "Application",
      domain: "Domain",
      infrastructure: "Infrastructure",
      unclassified: "Unclassified (no rule matches)",
    };
    const files = r.nodes.filter((n) => n.kind === "file" && n.changeStatus !== "deleted");
    const planes = order.map((id, i) => ({ id, y: 6 - i * 3.2, label: labels[id] }));
    for (const p of planes) {
      const inLayer = files.filter((f) => (r.layerOf[f.id] ?? "unclassified") === p.id).sort((a, b) => a.path.localeCompare(b.path));
      inLayer.forEach((f, i) => {
        const cols = Math.max(1, Math.ceil(Math.sqrt(inLayer.length)));
        const x = (i % cols) * 3.4 - ((cols - 1) * 3.4) / 2;
        const z = Math.floor(i / cols) * 3 - 1.5;
        nodes.set(f.id, { pos: [x, p.y, z], emphasis: emph(f.id), status: f.changeStatus, label: true });
      });
    }
    const violating = new Set(r.violations.map((v) => v.edgeId));
    const inCycle = new Set(r.cycles.flat());
    const edges: SceneEdge[] = r.edges
      .filter((e) => e.kind === "imports" && nodes.has(e.source) && nodes.has(e.target))
      .map((e) => {
        const unclassified = r.layerOf[e.source] === "unclassified" || r.layerOf[e.target] === "unclassified";
        const cyc = inCycle.has(e.source) && inCycle.has(e.target);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          kind: e.kind,
          tone: violating.has(e.id) || cyc ? "violation" : unclassified ? "uncertain" : "allowed",
          strong: violating.has(e.id) || cyc || (!!selected && (e.source === selected || e.target === selected)),
        };
      });
    return { nodes, edges, planes };
  }

  /* 4 — Review context prism --------------------------------------- */
  if (lens === 4) {
    const items = [...input.context].filter((id) => byId.has(id));
    const groups: Record<string, string[]> = { changed: [], caller: [], test: [] };
    items.forEach((id) => {
      const n = byId.get(id)!;
      if (n.kind === "test") groups.test.push(id);
      else if (n.changeStatus !== "unchanged") groups.changed.push(id);
      else groups.caller.push(id);
    });
    const corners: Record<string, [number, number]> = { changed: [0, -2.6], caller: [2.25, 1.3], test: [-2.25, 1.3] };
    let height = 0;
    Object.entries(groups).forEach(([g, ids]) => {
      ids.sort().forEach((id, i) => {
        const [x, z] = corners[g];
        const y = 4 - i * 1.6;
        height = Math.max(height, i * 1.6 + 2);
        nodes.set(id, { pos: [x, y, z], emphasis: id === selected ? "selected" : "focus", status: byId.get(id)!.changeStatus, label: true });
      });
    });
    r.nodes
      .filter((n) => !nodes.has(n.id) && n.changeStatus !== "deleted")
      .forEach((n, i) => {
        const a = i * GOLD;
        const rr = 9 + (i % 4);
        nodes.set(n.id, { pos: [Math.cos(a) * rr, -1 + (i % 6) * 0.6, Math.sin(a) * rr], emphasis: n.id === selected ? "selected" : "dim", status: n.changeStatus, label: n.id === selected });
      });
    const ctx = new Set(items);
    const edges = r.edges
      .filter((e) => ctx.has(e.source) && ctx.has(e.target))
      .map((e) => ({ id: e.id, source: e.source, target: e.target, kind: e.kind, tone: toneOf(e), strong: true }));
    return { nodes, edges, prism: { height: Math.max(height, 6) } };
  }

  /* 5 — Chronos ---------------------------------------------------- */
  const { step, commits, base: baseCommit } = input.chronos;
  const at = step === 0 ? baseCommit.files : commits[step - 1].files;
  const prev = step <= 1 ? baseCommit.files : commits[step - 2].files;
  for (const n of r.nodes.filter((n) => n.kind === "file")) {
    const present = n.path in at;
    const wasInBase = n.path in baseCommit.files;
    if (!present && !wasInBase) continue; // not yet created at this step
    const status: ChangeStatus = !present ? "deleted" : !wasInBase ? "added" : at[n.path] !== baseCommit.files[n.path] ? "modified" : "unchanged";
    const changedNow = step > 0 && at[n.path] !== prev[n.path];
    nodes.set(n.id, {
      pos: base.get(n.id)!,
      emphasis: n.id === selected ? "selected" : changedNow ? "focus" : status === "unchanged" ? "dim" : "normal",
      status,
      label: status !== "unchanged" || n.id === selected,
      pulse: changedNow,
      scale: 1.8,
    });
  }
  return { nodes, edges: [] };
}

/** The most review-worthy symbol: a changed signature, else any changed symbol. */
export function defaultCenter(r: AnalysisResult) {
  return (
    r.nodes.find((n) => n.kind === "symbol" && n.signatureChanged)?.id ??
    r.nodes.find((n) => n.kind === "symbol" && n.changeStatus === "modified")?.id ??
    r.nodes.find((n) => n.kind === "file")!.id
  );
}

export const chronosFileStatus = (path: string, files: Record<string, string>, base: Record<string, string>) =>
  !(path in files) ? "deleted" : !(path in base) ? "added" : files[path] !== base[path] ? "modified" : "unchanged";

export { isSource };
