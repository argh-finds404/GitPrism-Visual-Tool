// Structure-aware views of a merge, built on the same parser as the Impact Studio. Every
// grouping and relationship carries its evidence; where the parser can't match a symbol
// across versions, the change is reported as unmatched with its raw diff.

import { diffLines, splitLines, type DiffLine } from "@/lib/git";
import { analyze } from "@/features/impact-analysis/analysis-service";
import { LAYER_CONFIG } from "@/features/impact-analysis/fixture";
import { findCalls, isSecretFile, isSource, parseFile, type ParsedFunction } from "@/features/impact-analysis/source-analysis";
import type { AnalysisResult } from "@/features/impact-analysis/types";
import type { MergeResult } from "./merge";

const parse = (path: string, text: string | undefined, all: Record<string, string>) =>
  text === undefined || !isSource(path) || isSecretFile(path) ? null : parseFile(path, text, new Set(Object.keys(all)));

const fnSource = (text: string, f: { startLine: number; endLine: number }) => splitLines(text).slice(f.startLine - 1, f.endLine).join("\n");

/* ------------------------------------------------------------------ */
/* Where each conflict sits                                            */
/* ------------------------------------------------------------------ */

export type Place = { conflict: string; path: string; symbols: string[]; tests: string[] };

/** Functions and tests whose lines overlap the conflict, on any of the three sides. */
export function conflictPlaces(m: MergeResult, sides: { base: Record<string, string>; ours: Record<string, string>; theirs: Record<string, string> }): Map<string, Place> {
  const out = new Map<string, Place>();
  for (const c of m.conflicts) {
    const symbols = new Set<string>();
    const tests = new Set<string>();
    if (c.kind === "content" && c.region) {
      const ranges: [keyof typeof sides, number, number][] = [
        ["base", c.region.baseStart, c.region.base.length],
        ["ours", c.region.oursStart, c.region.ours.length],
        ["theirs", c.region.theirsStart, c.region.theirs.length],
      ];
      for (const [side, start, len] of ranges) {
        const pf = parse(c.path, sides[side][c.path], sides[side]);
        if (!pf) continue;
        // 1-based inclusive line range; an empty slice is a point between lines.
        const from = start + 1;
        const to = Math.max(from, start + len);
        for (const f of pf.functions) if (f.startLine <= to && f.endLine >= from) symbols.add(f.name);
        for (const t of pf.tests) if (t.startLine <= to && t.endLine >= from) tests.add(t.name);
      }
    }
    out.set(c.id, { conflict: c.id, path: c.path, symbols: [...symbols], tests: [...tests] });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Conflict constellation                                              */
/* ------------------------------------------------------------------ */

export type Relation = {
  a: string;
  b: string;
  kind: "same-function" | "calls";
  evidence: string;
  location?: { path: string; line: number; side: "ours" | "theirs" };
};

/**
 * Relationships between conflicts, each with evidence: two conflicts inside the same function,
 * or conflicting lines that call a function another conflict sits in. Sharing a file is not
 * evidence of anything, so it is never reported.
 */
export function constellation(m: MergeResult, places: Map<string, Place>): { relations: Relation[]; groups: string[][] } {
  const relations: Relation[] = [];
  const cs = m.conflicts;
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i];
      const b = cs[j];
      const pa = places.get(a.id)!;
      const pb = places.get(b.id)!;
      const shared = a.path === b.path ? pa.symbols.filter((s) => pb.symbols.includes(s)) : [];
      if (shared.length) relations.push({ a: a.id, b: b.id, kind: "same-function", evidence: `Both are inside ${shared.map((s) => `${s}()`).join(", ")}` });
      // Conflicting lines on either side that call a function the other conflict is inside.
      for (const [from, to, toPlace] of [
        [a, b, pb],
        [b, a, pa],
      ] as const) {
        if (from.kind !== "content" || !from.region || !toPlace.symbols.length || to.path === from.path && shared.length) continue;
        for (const side of ["ours", "theirs"] as const) {
          const lines = from.region[side];
          const start = (side === "ours" ? from.region.oursStart : from.region.theirsStart) + 1;
          const call = findCalls(lines.join("\n"), start, toPlace.symbols)[0];
          if (call) {
            relations.push({
              a: from.id,
              b: to.id,
              kind: "calls",
              evidence: `The conflicting lines call ${call.name}(), which the other conflict is inside`,
              location: { path: from.path, line: call.line, side },
            });
            break;
          }
        }
      }
    }
  }
  // Connected groups, so related conflicts can be resolved together.
  const parent = new Map(cs.map((c) => [c.id, c.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
  for (const r of relations) parent.set(find(r.a), find(r.b));
  const groups = new Map<string, string[]>();
  for (const c of cs) groups.set(find(c.id), [...(groups.get(find(c.id)) ?? []), c.id]);
  return { relations, groups: [...groups.values()].filter((g) => g.length > 1) };
}

/* ------------------------------------------------------------------ */
/* Semantic diff lens                                                  */
/* ------------------------------------------------------------------ */

export type SemanticKind = "signature" | "logic" | "import" | "added" | "removed" | "renamed" | "test" | "other" | "unmatched";

export type SemanticChange = { kind: SemanticKind; title: string; detail?: string; symbol?: string; diff: DiffLine[] };

/** One side's changes to one file, grouped by the code structure they belong to. */
export function semanticChanges(path: string, base: string | undefined, side: string | undefined, all: Record<string, string>): SemanticChange[] | null {
  const b = parse(path, base ?? "", all);
  const s = parse(path, side ?? "", all);
  if (!b || !s) return null; // Not a supported source file: the line view is the only honest view.
  const out: SemanticChange[] = [];
  const baseText = base ?? "";
  const sideText = side ?? "";
  const covered = { base: new Set<number>(), side: new Set<number>() };
  const cover = (set: Set<number>, f: { startLine: number; endLine: number }) => {
    for (let l = f.startLine; l <= f.endLine; l++) set.add(l);
  };

  // Imports.
  const bi = new Map(b.imports.map((i) => [i.text, i]));
  const si = new Map(s.imports.map((i) => [i.text, i]));
  const addedI = [...si.keys()].filter((t) => !bi.has(t));
  const removedI = [...bi.keys()].filter((t) => !si.has(t));
  b.imports.forEach((i) => covered.base.add(i.line));
  s.imports.forEach((i) => covered.side.add(i.line));
  if (addedI.length || removedI.length)
    out.push({
      kind: "import",
      title: `Imports: ${[addedI.length && `+${addedI.length}`, removedI.length && `−${removedI.length}`].filter(Boolean).join(" ")}`,
      diff: [...removedI.map((text) => ({ kind: "del" as const, text, a: bi.get(text)!.line })), ...addedI.map((text) => ({ kind: "add" as const, text, b: si.get(text)!.line }))],
    });

  // Functions, matched by name.
  const bf = new Map(b.functions.map((f) => [f.name, f]));
  const sf = new Map(s.functions.map((f) => [f.name, f]));
  const removed: ParsedFunction[] = [];
  const added: ParsedFunction[] = [];
  for (const f of b.functions) cover(covered.base, f);
  for (const f of s.functions) cover(covered.side, f);
  for (const [name, f] of sf) {
    const before = bf.get(name);
    if (!before) {
      added.push(f);
      continue;
    }
    const diff = diffLines(fnSource(baseText, before), fnSource(sideText, f));
    if (!diff.some((l) => l.kind !== "same")) continue;
    if (before.params !== f.params) out.push({ kind: "signature", symbol: name, title: `${name}()`, detail: `(${before.params}) → (${f.params})`, diff });
    else out.push({ kind: "logic", symbol: name, title: `${name}()`, detail: `+${diff.filter((l) => l.kind === "add").length} −${diff.filter((l) => l.kind === "del").length} lines in the body`, diff });
  }
  for (const [name, f] of bf) if (!sf.has(name)) removed.push(f);

  // A removed and an added function with identical parameters and body are one renamed function.
  const norm = (x: string) => x.replace(/\s+/g, " ").trim();
  for (const r of [...removed]) {
    const twin = added.filter((a) => a.params === r.params && norm(a.body) === norm(r.body));
    if (twin.length === 1) {
      out.push({ kind: "renamed", symbol: twin[0].name, title: `${r.name}() → ${twin[0].name}()`, detail: "identical parameters and body", diff: diffLines(fnSource(baseText, r), fnSource(sideText, twin[0])) });
      removed.splice(removed.indexOf(r), 1);
      added.splice(added.indexOf(twin[0]), 1);
    }
  }
  if (removed.length && added.length) {
    // Something was replaced, but nothing proves which function became which.
    out.push({
      kind: "unmatched",
      title: `${removed.map((f) => `${f.name}()`).join(", ")} removed; ${added.map((f) => `${f.name}()`).join(", ")} added`,
      detail: "Not matched as the same function: their bodies differ. Raw diff shown.",
      diff: diffLines(removed.map((f) => fnSource(baseText, f)).join("\n"), added.map((f) => fnSource(sideText, f)).join("\n")),
    });
  } else {
    for (const f of added) out.push({ kind: "added", symbol: f.name, title: `${f.name}()`, detail: `(${f.params})`, diff: diffLines("", fnSource(sideText, f)) });
    for (const f of removed) out.push({ kind: "removed", symbol: f.name, title: `${f.name}()`, diff: diffLines(fnSource(baseText, f), "") });
  }

  // Tests, matched by name.
  const bt = new Map(b.tests.map((t) => [t.name, t]));
  for (const t of b.tests) cover(covered.base, t);
  for (const t of s.tests) {
    cover(covered.side, t);
    const before = bt.get(t.name);
    const diff = diffLines(before ? fnSource(baseText, before) : "", fnSource(sideText, t));
    if (diff.some((l) => l.kind !== "same")) out.push({ kind: "test", title: `“${t.name}”`, detail: before ? "changed" : "added", diff });
  }
  for (const t of b.tests) if (!s.tests.some((x) => x.name === t.name)) out.push({ kind: "test", title: `“${t.name}”`, detail: "removed", diff: diffLines(fnSource(baseText, t), "") });

  // Everything else that changed (types, constants, top-level statements), so nothing is hidden.
  const rest = diffLines(baseText, sideText).filter(
    (l) => (l.kind === "del" && !covered.base.has(l.a)) || (l.kind === "add" && !covered.side.has(l.b)),
  );
  if (rest.some((l) => l.text.trim()))
    out.push({ kind: "other", title: "Outside functions", detail: "types, constants and other top-level lines", diff: rest });

  return out;
}

/* ------------------------------------------------------------------ */
/* Merge impact preview                                                 */
/* ------------------------------------------------------------------ */

export type CallSite = { path: string; line: number; text: string; caller: string; callee: string; args: number; min: number; max: number };

/** Parameter count range: required parameters have no default and no `?`. */
export function paramRange(params: string) {
  const list = splitTopLevel(params, true);
  // A default is "= value" (not the "=>" of a function type); optional names end in "?".
  const hasDefault = (p: string) => /(^|[^=!<>])=(?![=>])/.test(p);
  return { min: list.filter((p) => !/\?$/.test(p.split(":")[0].trim()) && !hasDefault(p)).length, max: list.length };
}

/**
 * Split on commas that are not inside brackets, braces, parentheses or strings. In parameter
 * lists `<…>` are type arguments; in call arguments they are comparisons, so `angles` is off.
 */
export function splitTopLevel(s: string, angles = false) {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = "";
  let prev = "";
  for (const ch of s) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
      prev = ch;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if ("([{".includes(ch) || (angles && ch === "<")) depth++;
    else if (")]}".includes(ch) || (angles && ch === ">" && prev !== "=")) depth--;
    prev = ch;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export type ImpactPreview = {
  analysis: AnalysisResult;
  /** Symbols whose signature differs from our branch. */
  signatures: { id: string; name: string; path: string; from?: string; to: string }[];
  /** Calls to those symbols, with the argument count checked against the new parameters. */
  callSites: (CallSite & { fits: boolean })[];
  /** Tests that call a changed symbol directly. */
  tests: { id: string; name: string; path: string; target: string }[];
};

/** What the candidate changes on top of our branch, and which callers and tests need a look. */
export function impactPreview(ours: Record<string, string>, candidate: Record<string, string>): ImpactPreview {
  const analysis = analyze(ours, candidate, { base: "ours", head: "candidate", ...LAYER_CONFIG });
  const changed = analysis.nodes.filter((n) => n.kind === "symbol" && (n.changeStatus === "modified" || n.changeStatus === "added"));
  const sig = analysis.nodes.filter((n) => n.kind === "symbol" && n.signatureChanged);
  const callSites = analysis.edges
    .filter((e) => (e.kind === "calls" || e.kind === "tests") && sig.some((n) => n.id === e.target))
    .map((e) => {
      const target = sig.find((n) => n.id === e.target)!;
      const { min, max } = paramRange(target.params ?? "");
      const line = candidate[e.location.path].split("\n")[e.location.line - 1] ?? "";
      const call = findCalls(line, e.location.line, [target.name])[0];
      const args = call ? splitTopLevel(call.text.slice(call.text.indexOf("(") + 1, -1)).length : -1;
      return {
        path: e.location.path,
        line: e.location.line,
        text: e.location.text,
        caller: e.source.split("#").pop()!,
        callee: target.name,
        args,
        min,
        max,
        fits: args >= min && args <= max,
      };
    });
  const tests = analysis.edges
    .filter((e) => e.kind === "tests" && changed.some((n) => n.id === e.target))
    .map((e) => ({ id: e.source, name: e.source.split("#").pop()!, path: e.location.path, target: e.target.split("#").pop()! }));
  return {
    analysis,
    signatures: sig.map((n) => ({ id: n.id, name: n.name, path: n.path, from: n.baseParams, to: n.params ?? "" })),
    callSites,
    tests,
  };
}
