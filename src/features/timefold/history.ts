// TimeFold history engine. Every commit gets an immutable snapshot: the analysis of
// that commit against its parent, so each graph and each change belongs to one SHA.
// Symbols are followed across commits by ID; a rename or move is linked only when the
// evidence is exact (identical parameters and body), otherwise the trail stays broken.

import { diffLines } from "@/lib/git";
import { analyze, symbolId } from "@/features/impact-analysis/analysis-service";
import { fixtureHistory, LAYER_CONFIG, type FixtureCommit } from "@/features/impact-analysis/fixture";
import { isSecretFile, isSource, parseFile, type ParsedFunction } from "@/features/impact-analysis/source-analysis";
import type { AnalysisResult, ImpactEdge, ImpactNode } from "@/features/impact-analysis/types";

export type Snapshot = {
  index: number;
  commit: FixtureCommit;
  /** This commit analyzed against its parent (the root against an empty tree). */
  analysis: AnalysisResult;
  /** Symbols and tests that exist at this commit (deleted ones excluded). */
  nodes: ImpactNode[];
  edges: ImpactEdge[];
  /** Parsed functions at this commit, by symbol ID. */
  functions: Map<string, ParsedFunction & { path: string }>;
  /** Symbols renamed or moved in this commit: new ID → old ID, with the evidence. */
  renames: Map<string, Rename>;
};

export type Rename = { from: string; kind: "renamed" | "moved" | "moved and renamed"; evidence: string };

export type History = {
  snapshots: Snapshot[];
  /** Every symbol ID that ever existed, mapped to the ID it started life as. */
  lineageOf: Map<string, string>;
};

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

function parseAll(files: Record<string, string>) {
  const set = new Set(Object.keys(files));
  const out = new Map<string, ParsedFunction & { path: string }>();
  for (const [path, src] of Object.entries(files)) {
    if (!isSource(path) || isSecretFile(path)) continue;
    for (const f of parseFile(path, src, set).functions) out.set(symbolId(path, f.name), { ...f, path });
  }
  return out;
}

export function buildHistory(commits: FixtureCommit[]): History {
  const snapshots: Snapshot[] = [];
  const lineageOf = new Map<string, string>();
  let prevFns = new Map<string, ParsedFunction & { path: string }>();

  commits.forEach((commit, index) => {
    const parent = index > 0 ? commits[index - 1] : null;
    if (parent && commit.parents[0] !== parent.oid) throw new Error(`TimeFold expects a first-parent chain at ${commit.oid}`);
    const analysis = analyze(parent?.files ?? {}, commit.files, { base: parent?.oid ?? "empty", head: commit.oid, ...LAYER_CONFIG });
    const functions = parseAll(commit.files);

    // Exact rename/move evidence: a symbol vanished and one with the same parameters and body appeared.
    const renames = new Map<string, Rename>();
    const gone = [...prevFns.keys()].filter((id) => !functions.has(id));
    const born = [...functions.keys()].filter((id) => !prevFns.has(id));
    for (const id of born) {
      const f = functions.get(id)!;
      const matches = gone.filter((g) => {
        const p = prevFns.get(g)!;
        return p.params === f.params && normalize(p.body) === normalize(f.body);
      });
      // Two equal candidates would be a guess, so only a single match counts.
      if (matches.length === 1) {
        const p = prevFns.get(matches[0])!;
        const kind = p.path === f.path ? "renamed" : p.name === f.name ? "moved" : "moved and renamed";
        renames.set(id, { from: matches[0], kind, evidence: "identical parameters and body" });
      }
    }

    for (const id of functions.keys()) {
      if (lineageOf.has(id)) continue;
      const r = renames.get(id);
      lineageOf.set(id, r ? (lineageOf.get(r.from) ?? r.from) : id);
    }

    snapshots.push({
      index,
      commit,
      analysis,
      nodes: analysis.nodes.filter((n) => n.changeStatus !== "deleted" && (n.kind !== "file" || n.path in commit.files)),
      edges: analysis.edges,
      functions,
      renames,
    });
    prevFns = functions;
  });
  return { snapshots, lineageOf };
}

let cached: History | null = null;
export function fixtureTimeline() {
  return (cached ??= buildHistory(fixtureHistory().all));
}

/* ------------------------------------------------------------------ */
/* Function DNA                                                         */
/* ------------------------------------------------------------------ */

export type DnaEventKind = "created" | "renamed" | "signature" | "body" | "calls" | "callers" | "tests" | "deleted";

export type DnaEvent = { kind: DnaEventKind; text: string };

export type DnaEntry = {
  index: number;
  /** The symbol's ID at this commit, or null when it doesn't exist here. */
  id: string | null;
  fn: (ParsedFunction & { path: string }) | null;
  events: DnaEvent[];
  added: number;
  removed: number;
};

/** The symbol IDs belonging to one lineage at a commit (normally zero or one). */
function idAt(h: History, lineage: string, index: number) {
  for (const id of h.snapshots[index].functions.keys()) if (h.lineageOf.get(id) === lineage) return id;
  return null;
}

const label = (id: string) => {
  const [path, name] = id.replace(/^(sym|test):/, "").split("#");
  return `${name} (${path.split("/").pop()})`;
};

const outgoing = (s: Snapshot, id: string) => new Set(s.edges.filter((e) => e.kind === "calls" && e.source === id).map((e) => e.target));
const incoming = (s: Snapshot, id: string, kind: "calls" | "tests") =>
  new Set(s.edges.filter((e) => e.kind === kind && e.target === id).map((e) => e.source));

/** Lineage IDs make before/after sets comparable even when a symbol was renamed. */
function lineageSet(h: History, ids: Set<string>) {
  return new Set([...ids].map((id) => h.lineageOf.get(id) ?? id));
}

function setDiff(a: Set<string>, b: Set<string>) {
  return { added: [...b].filter((x) => !a.has(x)), removed: [...a].filter((x) => !b.has(x)) };
}

/** Everything that happened to one function, commit by commit, from parse and diff evidence only. */
export function functionDna(h: History, lineage: string): DnaEntry[] {
  return h.snapshots.map((snap, index) => {
    const id = idAt(h, lineage, index);
    const prevId = index > 0 ? idAt(h, lineage, index - 1) : null;
    const prev = index > 0 && prevId ? h.snapshots[index - 1] : null;
    const fn = id ? snap.functions.get(id)! : null;
    const before = prev && prevId ? prev.functions.get(prevId)! : null;
    const events: DnaEvent[] = [];
    let added = 0;
    let removed = 0;

    if (id && fn) {
      if (!before) {
        events.push({ kind: "created", text: `Created in ${fn.path} with (${fn.params})` });
        added = fn.endLine - fn.startLine + 1;
      } else {
        const rename = snap.renames.get(id);
        if (rename) events.push({ kind: "renamed", text: `${rename.kind[0].toUpperCase()}${rename.kind.slice(1)} from ${label(rename.from)}: ${rename.evidence}` });
        if (before.params !== fn.params) events.push({ kind: "signature", text: `Signature (${before.params}) → (${fn.params})` });
        const d = diffLines(before.body, fn.body);
        added = d.filter((l) => l.kind === "add").length;
        removed = d.filter((l) => l.kind === "del").length;
        if (added || removed) events.push({ kind: "body", text: `Body changed: +${added} −${removed} lines` });
      }
      const calls = setDiff(prev && prevId ? lineageSet(h, outgoing(prev, prevId)) : new Set(), lineageSet(h, outgoing(snap, id)));
      if (calls.added.length) events.push({ kind: "calls", text: `Now calls ${calls.added.map(label).join(", ")}` });
      if (calls.removed.length) events.push({ kind: "calls", text: `Stopped calling ${calls.removed.map(label).join(", ")}` });
      const callers = setDiff(prev && prevId ? lineageSet(h, incoming(prev, prevId, "calls")) : new Set(), lineageSet(h, incoming(snap, id, "calls")));
      if (callers.added.length) events.push({ kind: "callers", text: `Gained caller${callers.added.length > 1 ? "s" : ""} ${callers.added.map(label).join(", ")}` });
      if (callers.removed.length) events.push({ kind: "callers", text: `Lost caller${callers.removed.length > 1 ? "s" : ""} ${callers.removed.map(label).join(", ")}` });
      const tests = setDiff(prev && prevId ? incoming(prev, prevId, "tests") : new Set(), incoming(snap, id, "tests"));
      if (tests.added.length) events.push({ kind: "tests", text: `Tested by ${tests.added.map((t) => `“${t.split("#")[1]}”`).join(", ")}` });
      if (tests.removed.length) events.push({ kind: "tests", text: `No longer tested by ${tests.removed.map((t) => `“${t.split("#")[1]}”`).join(", ")}` });
      // A linked test whose own body changed in this commit.
      const editedTests = [...incoming(snap, id, "tests")].filter(
        (t) => !tests.added.includes(t) && snap.analysis.nodes.find((n) => n.id === t)?.changeStatus === "modified",
      );
      if (editedTests.length) events.push({ kind: "tests", text: `Test changed: ${editedTests.map((t) => `“${t.split("#")[1]}”`).join(", ")}` });
    } else if (before) {
      events.push({ kind: "deleted", text: `Deleted from ${before.path}` });
      removed = before.endLine - before.startLine + 1;
    }
    return { index, id, fn, events, added, removed };
  });
}

/** Every lineage that ever existed, with its name at its most recent appearance. */
export function lineages(h: History) {
  const latest = new Map<string, { lineage: string; id: string; path: string; name: string; first: number; last: number }>();
  h.snapshots.forEach((s) => {
    for (const [id, f] of s.functions) {
      const lineage = h.lineageOf.get(id)!;
      const prev = latest.get(lineage);
      latest.set(lineage, { lineage, id, path: f.path, name: f.name, first: prev?.first ?? s.index, last: s.index });
    }
  });
  return [...latest.values()].sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ */
/* Commit story: what changed between a commit and its parent           */
/* ------------------------------------------------------------------ */

export type CommitStory = {
  files: AnalysisResult["changes"];
  symbols: { added: ImpactNode[]; modified: ImpactNode[]; deleted: ImpactNode[]; renamed: ({ id: string } & Rename)[] };
  signatures: ImpactNode[];
  edges: { added: ImpactEdge[]; removed: ImpactEdge[] };
  tests: ImpactNode[];
};

export function commitStory(h: History, index: number): CommitStory {
  const s = h.snapshots[index];
  const prev = index > 0 ? h.snapshots[index - 1] : null;
  const syms = s.analysis.nodes.filter((n) => n.kind === "symbol");
  const renamed = [...s.renames].map(([id, r]) => ({ id, ...r }));
  const renamedIds = new Set(renamed.flatMap((r) => [r.id, r.from]));
  const prevEdges = new Map((prev?.edges ?? []).map((e) => [e.id, e]));
  const nowEdges = new Map(s.edges.map((e) => [e.id, e]));
  return {
    files: s.analysis.changes,
    symbols: {
      added: syms.filter((n) => n.changeStatus === "added" && !renamedIds.has(n.id)),
      modified: syms.filter((n) => n.changeStatus === "modified"),
      deleted: syms.filter((n) => n.changeStatus === "deleted" && !renamedIds.has(n.id)),
      renamed,
    },
    signatures: syms.filter((n) => n.signatureChanged),
    edges: {
      added: [...nowEdges.values()].filter((e) => !prevEdges.has(e.id) && e.kind !== "tests"),
      removed: [...prevEdges.values()].filter((e) => !nowEdges.has(e.id) && e.kind !== "tests"),
    },
    tests: s.analysis.nodes.filter((n) => n.kind === "test" && n.changeStatus !== "unchanged"),
  };
}

/** All tests that exist anywhere in history, as "path#name". */
export function allTests(h: History) {
  const seen = new Map<string, { id: string; path: string; name: string; first: number }>();
  h.snapshots.forEach((s) => {
    for (const n of s.nodes) if (n.kind === "test" && !seen.has(`${n.path}#${n.name}`)) seen.set(`${n.path}#${n.name}`, { id: `${n.path}#${n.name}`, path: n.path, name: n.name, first: s.index });
  });
  return [...seen.values()];
}
