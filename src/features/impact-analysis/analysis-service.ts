// Runs the analysis pipeline over a base/head pair of file sets and produces
// the one versioned result every view reads.

import { diffLines, hashBlob } from "@/lib/git";
import { findCalls, isSecretFile, isSource, parseFile, type ParsedFile } from "./source-analysis";
import { architecture } from "./architecture-rules";
import { buildFindings } from "./evidence";
import type { AnalysisResult, AnalysisStage, FileChange, ImpactEdge, ImpactNode, Layer, LayerRule } from "./types";

export const fileId = (path: string) => `file:${path}`;
export const symbolId = (path: string, name: string) => `sym:${path}#${name}`;
export const testId = (path: string, name: string) => `test:${path}#${name}`;

/* ------------------------------------------------------------------ */
/* Stage 1: base/head diff                                             */
/* ------------------------------------------------------------------ */

export function diffFiles(baseFiles: Record<string, string>, headFiles: Record<string, string>): FileChange[] {
  const paths = [...new Set([...Object.keys(baseFiles), ...Object.keys(headFiles)])].sort();
  const out: FileChange[] = [];
  for (const path of paths) {
    const a = baseFiles[path];
    const b = headFiles[path];
    if (a === b) continue;
    const lines = diffLines(a ?? "", b ?? "");
    out.push({
      path,
      status: a === undefined ? "added" : b === undefined ? "deleted" : "modified",
      added: lines.filter((l) => l.kind === "add").length,
      removed: lines.filter((l) => l.kind === "del").length,
      changedLines: lines.flatMap((l) => (l.kind === "add" ? [l.b] : [])),
    });
  }
  return out;
}

/** Base line numbers that were removed (used to detect symbols changed only by deletion). */
function removedBaseLines(a: string, b: string) {
  return diffLines(a, b).flatMap((l) => (l.kind === "del" ? [l.a] : []));
}

/* ------------------------------------------------------------------ */
/* Stages 2–4                                                          */
/* ------------------------------------------------------------------ */

type Options = { base: string; head: string; layers: Layer[]; rules: LayerRule[] };

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Synchronous pipeline. `onStage` lets callers show genuine progress between stages. */
export function analyze(baseFiles: Record<string, string>, headFiles: Record<string, string>, opts: Options): AnalysisResult {
  const stages: AnalysisStage[] = [];
  let t = now();
  const mark = (id: string, label: string) => {
    const n = now();
    stages.push({ id, label, ms: Math.round((n - t) * 100) / 100 });
    t = n;
  };
  // The version identifies exactly which inputs produced this result.
  const version = hashBlob(`${opts.base}..${opts.head}`).slice(0, 12);

  const changes = diffFiles(baseFiles, headFiles);
  const changeOf = new Map(changes.map((c) => [c.path, c]));
  mark("diff", "Resolve base and head, compute diff");

  const parse = (files: Record<string, string>) => {
    const set = new Set(Object.keys(files));
    const out = new Map<string, ParsedFile>();
    for (const [p, src] of Object.entries(files)) if (isSource(p) && !isSecretFile(p)) out.set(p, parseFile(p, src, set));
    return out;
  };
  const head = parse(headFiles);
  const baseParsed = parse(baseFiles);
  mark("parse", "Parse imports, functions and tests");

  const nodes: ImpactNode[] = [];
  const edges: ImpactEdge[] = [];
  const nodeIds = new Set<string>();
  const unresolved: AnalysisResult["unresolved"] = [];
  const add = (n: Omit<ImpactNode, "analysisVersion">) => {
    nodes.push({ ...n, analysisVersion: version });
    nodeIds.add(n.id);
  };

  // Files present in head, plus deleted files so the review can show them.
  const allPaths = [...new Set([...Object.keys(headFiles), ...Object.keys(baseFiles)])].filter((p) => isSource(p)).sort();
  for (const path of allPaths) {
    const c = changeOf.get(path);
    add({ id: fileId(path), kind: "file", path, name: path.split("/").pop()!, changeStatus: c?.status ?? "unchanged" });
  }

  // Symbols, classified by comparing their line ranges with the diff.
  for (const path of allPaths) {
    const h = head.get(path);
    const b = baseParsed.get(path);
    const c = changeOf.get(path);
    const removed = c && b && h ? new Set(removedBaseLines(baseFiles[path], headFiles[path])) : new Set<number>();
    const changed = new Set(c?.changedLines ?? []);
    const bFns = new Map((b?.functions ?? []).map((f) => [f.name, f]));
    for (const f of h?.functions ?? []) {
      const before = bFns.get(f.name);
      let status: ImpactNode["changeStatus"] = "unchanged";
      if (!before) status = c ? "added" : "unchanged";
      else {
        const touched = [...changed].some((l) => l >= f.startLine && l <= f.endLine) || [...removed].some((l) => l >= before.startLine && l <= before.endLine);
        if (touched) status = "modified";
      }
      add({
        id: symbolId(path, f.name),
        kind: "symbol",
        path,
        name: f.name,
        changeStatus: status,
        sourceRange: { startLine: f.startLine, endLine: f.endLine },
        params: f.params,
        baseParams: before?.params,
        signatureChanged: !!before && before.params !== f.params,
        fileId: fileId(path),
      });
    }
    // Functions that exist only in base were deleted by this change.
    for (const f of b?.functions ?? []) {
      if (h?.functions.some((x) => x.name === f.name)) continue;
      add({
        id: symbolId(path, f.name),
        kind: "symbol",
        path,
        name: f.name,
        changeStatus: "deleted",
        sourceRange: { startLine: f.startLine, endLine: f.endLine },
        params: f.params,
        baseParams: f.params,
        fileId: fileId(path),
      });
    }
    for (const tc of h?.tests ?? []) {
      const changedTest = [...changed].some((l) => l >= tc.startLine && l <= tc.endLine);
      add({
        id: testId(path, tc.name),
        kind: "test",
        path,
        name: tc.name,
        changeStatus: changedTest ? "modified" : c?.status === "added" ? "added" : "unchanged",
        sourceRange: { startLine: tc.startLine, endLine: tc.endLine },
        fileId: fileId(path),
      });
    }
  }

  // Relationships, from head source only.
  for (const [path, pf] of head) {
    const lines = headFiles[path].split("\n");
    const imported = new Map<string, string>(); // local name -> symbol id
    for (const imp of pf.imports) {
      if (!imp.resolved) {
        if (imp.from.startsWith(".")) unresolved.push({ path, line: imp.line, text: imp.text });
        continue;
      }
      edges.push({
        id: `imports:${path}->${imp.resolved}`,
        source: fileId(path),
        target: fileId(imp.resolved),
        kind: "imports",
        evidence: "resolved",
        location: { path, line: imp.line, text: lines[imp.line - 1].trim() },
        analysisVersion: version,
      });
      for (const n of imp.names) {
        const sid = symbolId(imp.resolved, n);
        if (nodeIds.has(sid)) imported.set(n, sid);
      }
    }
    for (const f of pf.functions) imported.set(f.name, symbolId(path, f.name));

    const callers: { id: string; body: string; start: number; kind: "calls" | "tests"; self?: string }[] = [
      ...pf.functions.map((f) => ({ id: symbolId(path, f.name), body: f.body, start: f.startLine, kind: "calls" as const, self: f.name })),
      ...pf.tests.map((tc) => ({ id: testId(path, tc.name), body: tc.body, start: tc.startLine, kind: "tests" as const })),
    ];
    for (const c of callers) {
      const names = [...imported.keys()].filter((n) => n !== c.self);
      const seen = new Set<string>();
      for (const call of findCalls(c.body, c.start, names)) {
        const target = imported.get(call.name)!;
        const id = `${c.kind}:${c.id}->${target}`;
        if (seen.has(id)) continue;
        seen.add(id);
        edges.push({
          id,
          source: c.id,
          target,
          kind: c.kind,
          evidence: "resolved",
          location: { path, line: call.line, text: lines[call.line - 1]?.trim() ?? call.text },
          analysisVersion: version,
        });
      }
    }
  }
  mark("graph", "Build canonical graph");

  const arch = architecture(nodes, edges, opts.layers, opts.rules);
  const result: AnalysisResult = {
    version,
    base: opts.base,
    head: opts.head,
    nodes,
    edges,
    changes,
    baseFiles,
    headFiles,
    layerOf: arch.layerOf,
    violations: arch.violations,
    cycles: arch.cycles,
    unresolved,
    findings: [],
    stages,
    analyzedAt: Date.now(),
    limitations: [
      "Relationships come from explicit relative imports and direct calls by name. Method calls, dynamic imports and re-exports are not detected.",
      "A highlighted dependent may be affected; static analysis cannot prove it will break.",
      "Test links mean a test calls the symbol directly. They are not coverage measurements.",
      "Secret files such as .env are never parsed or packed.",
    ],
  };
  mark("impact", "Impact, cycles and architecture rules");
  result.findings = buildFindings(result);
  mark("findings", "Evidence-backed findings");
  return result;
}
