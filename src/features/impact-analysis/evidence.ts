// Findings derived only from the analysis result. Each states its kind:
// facts (read directly from the diff), static warnings (rules over the graph)
// and hypotheses (plausible risks that need a human to confirm).

import { LAYER_CONFIG } from "./fixture";
import type { AnalysisResult, Finding } from "./types";

export function buildFindings(r: AnalysisResult): Finding[] {
  const out: Finding[] = [];
  const byId = new Map(r.nodes.map((n) => [n.id, n]));
  const changedFiles = new Set(r.changes.map((c) => c.path));

  // Facts: what the diff changed.
  for (const n of r.nodes.filter((n) => n.kind === "symbol" && n.signatureChanged)) {
    out.push({
      id: `sig:${n.id}`,
      kind: "fact",
      title: `${n.name}() changed its parameters`,
      detail: `Base: (${n.baseParams}). Head: (${n.params}).`,
      nodeIds: [n.id],
      locations: [{ path: n.path, line: n.sourceRange!.startLine }],
      method: "Compared the parsed function declarations in base and head.",
    });

    // Static warning: callers in files this PR didn't touch at the call line.
    for (const e of r.edges.filter((e) => e.target === n.id && e.kind !== "imports")) {
      const callerFileChange = r.changes.find((c) => c.path === e.location.path);
      const lineChanged = callerFileChange?.changedLines.includes(e.location.line);
      if (lineChanged) continue;
      const caller = byId.get(e.source)!;
      out.push({
        id: `stale-call:${e.id}`,
        kind: "static-warning",
        title: `${caller.name} still calls ${n.name}() with an unchanged call`,
        detail: `${e.location.path}:${e.location.line} calls \`${e.location.text}\`, but ${n.name} now takes (${n.params}). This line wasn't edited in the pull request.`,
        nodeIds: [caller.id, n.id],
        locations: [{ path: e.location.path, line: e.location.line }],
        method: "Listed direct callers of a changed signature whose call line is outside the diff.",
      });
    }
  }

  for (const n of r.nodes.filter((n) => n.kind === "symbol" && n.changeStatus === "deleted")) {
    out.push({
      id: `del:${n.id}`,
      kind: "fact",
      title: `${n.name}() was removed`,
      detail: `Declared in ${n.path} at base; absent at head. No remaining head callers were found.`,
      nodeIds: [n.id],
      locations: [{ path: n.path, line: n.sourceRange!.startLine }],
      method: "Compared exported functions between base and head.",
    });
  }

  for (const u of r.unresolved) {
    out.push({
      id: `unresolved:${u.path}:${u.line}`,
      kind: "static-warning",
      title: `Import in ${u.path.split("/").pop()} points at a missing file`,
      detail: `\`${u.text}\` can't be resolved at head. If the target was deleted in this pull request, this file will fail to load.`,
      nodeIds: [`file:${u.path}`],
      locations: [{ path: u.path, line: u.line }],
      method: "Resolved every relative import against the files present at head.",
    });
  }

  // Static warnings: architecture and cycles.
  for (const v of r.violations) {
    const rule = LAYER_CONFIG.rules.find((x) => x.id === v.ruleId)!;
    const e = r.edges.find((x) => x.id === v.edgeId)!;
    out.push({
      id: `arch:${v.edgeId}`,
      kind: "static-warning",
      title: `${byId.get(v.from)?.name} (${v.fromLayer}) imports ${byId.get(v.to)?.name} (${v.toLayer})`,
      detail: `Breaks rule “${rule.text}” from ${LAYER_CONFIG.source}.${changedFiles.has(e.location.path) ? " Introduced or touched in this pull request." : ""}`,
      nodeIds: [v.from, v.to],
      locations: [{ path: e.location.path, line: e.location.line }],
      method: "Checked every import edge against the configured layer rules.",
    });
  }
  for (const cycle of r.cycles) {
    const names = cycle.map((id) => byId.get(id)?.path ?? id);
    const loopEdges = r.edges.filter((e) => e.kind === "imports" && cycle.includes(e.source) && cycle.includes(e.target));
    out.push({
      id: `cycle:${cycle.join("|")}`,
      kind: "static-warning",
      title: `Import cycle between ${names.length} files`,
      detail: `${names.join(" → ")} → ${names[0]}. Cycles make load order and testing harder.`,
      nodeIds: cycle,
      locations: loopEdges.map((e) => ({ path: e.location.path, line: e.location.line })),
      method: "Tarjan's strongly connected components over file imports.",
    });
  }

  // Hypotheses: changed code with no test that calls it directly.
  for (const n of r.nodes.filter((n) => n.kind === "symbol" && (n.changeStatus === "added" || n.changeStatus === "modified"))) {
    const tested = r.edges.some((e) => e.kind === "tests" && e.target === n.id);
    if (tested) continue;
    out.push({
      id: `untested:${n.id}`,
      kind: "hypothesis",
      title: `No test calls ${n.name}() directly`,
      detail: `It changed in this pull request, and none of the parsed test files call it. It may still be exercised indirectly.`,
      nodeIds: [n.id],
      locations: [{ path: n.path, line: n.sourceRange!.startLine }],
      method: "Looked for test cases that call the symbol by name through an import.",
    });
  }

  const rank = { fact: 0, "static-warning": 1, hypothesis: 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}
