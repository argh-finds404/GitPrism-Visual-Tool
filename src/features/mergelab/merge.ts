// Tree-level three-way merge over whole snapshots, conflict bookkeeping, and the candidate
// result built from the user's resolutions. Nothing here touches a branch: the candidate is a
// separate buffer until it is exported.

import { diffLines, splitLines } from "@/lib/git";
import { merge3, type ConflictRegion, type Region } from "./diff3";

export type Strategy = "ours" | "theirs" | "ours-theirs" | "theirs-ours" | "edit";

export type Resolution = { strategy: Strategy; /** Only for "edit". */ text?: string };

export type FileStatus =
  | "unchanged"
  | "ours" // only our branch changed it
  | "theirs" // only their branch changed it
  | "same" // both changed it identically
  | "merged" // both changed it, merged without conflicts
  | "conflict" // both changed it and some regions conflict
  | "modify-delete" // one side deleted it, the other changed it
  | "add-add"; // both added it with different content

export type FileMerge = {
  path: string;
  status: FileStatus;
  base?: string;
  ours?: string;
  theirs?: string;
  regions?: Region[];
  /** Conflict IDs in file order. */
  conflicts: string[];
};

export type Conflict = {
  id: string;
  path: string;
  /** 1-based position among the file's conflicts. */
  n: number;
  kind: "content" | "modify-delete";
  region?: ConflictRegion;
  /** For modify-delete: which side deleted the file. */
  deletedBy?: "ours" | "theirs";
};

export type MergeResult = { files: FileMerge[]; conflicts: Conflict[] };

export function mergeTrees(base: Record<string, string>, ours: Record<string, string>, theirs: Record<string, string>): MergeResult {
  const paths = [...new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])].sort();
  const files: FileMerge[] = [];
  const conflicts: Conflict[] = [];

  for (const path of paths) {
    const b = base[path];
    const o = ours[path];
    const t = theirs[path];
    const fm: FileMerge = { path, status: "unchanged", base: b, ours: o, theirs: t, conflicts: [] };
    if (o === t) fm.status = o === b ? "unchanged" : "same";
    else if (o === b) fm.status = "theirs";
    else if (t === b) fm.status = "ours";
    else if (o === undefined || t === undefined) {
      // One side deleted a file the other changed: a whole-file decision.
      fm.status = "modify-delete";
      const id = `${path}#1`;
      fm.conflicts.push(id);
      conflicts.push({ id, path, n: 1, kind: "modify-delete", deletedBy: o === undefined ? "ours" : "theirs" });
    } else {
      // Both changed (or both added): merge the lines, with an empty base for add/add.
      fm.regions = merge3(b ?? "", o, t);
      const cs = fm.regions.filter((r): r is ConflictRegion => r.kind === "conflict");
      fm.status = cs.length ? (b === undefined ? "add-add" : "conflict") : "merged";
      cs.forEach((region, i) => {
        const id = `${path}#${i + 1}`;
        fm.conflicts.push(id);
        conflicts.push({ id, path, n: i + 1, kind: "content", region });
      });
    }
    files.push(fm);
  }
  return { files, conflicts };
}

/** The lines a resolution puts in place of a conflict region. */
export function resolveRegion(region: ConflictRegion, r: Resolution): string[] {
  switch (r.strategy) {
    case "ours":
      return region.ours;
    case "theirs":
      return region.theirs;
    case "ours-theirs":
      return [...region.ours, ...region.theirs];
    case "theirs-ours":
      return [...region.theirs, ...region.ours];
    case "edit":
      return r.text === undefined || r.text === "" ? [] : splitLines(r.text.endsWith("\n") ? r.text : `${r.text}\n`);
  }
}

export type Origin = "base" | "ours" | "theirs" | "both" | "resolved" | "conflict";
export type ResolvedLine = { text: string; origin: Origin; conflict?: string };

/** One file of the candidate: its lines with where each came from, or null when the result deletes it. */
export function resolveFile(fm: FileMerge, resolutions: Record<string, Resolution>): ResolvedLine[] | null {
  const lines = (text: string | undefined, origin: Origin) => (text === undefined ? null : text === "" ? [] : splitLines(text).map((t) => ({ text: t, origin })));
  switch (fm.status) {
    case "unchanged":
      return lines(fm.base, "base");
    case "ours":
      return lines(fm.ours, "ours");
    case "theirs":
      return lines(fm.theirs, "theirs");
    case "same":
      return lines(fm.ours, "both");
    case "modify-delete": {
      const r = resolutions[fm.conflicts[0]];
      if (!r) return lines(fm.ours ?? fm.theirs, "conflict");
      const keep = r.strategy === "ours" ? fm.ours : r.strategy === "theirs" ? fm.theirs : fm.ours ?? fm.theirs;
      return lines(keep, "resolved");
    }
  }
  const out: ResolvedLine[] = [];
  let n = 0;
  for (const region of fm.regions ?? []) {
    if (region.kind === "stable") out.push(...region.lines.map((text) => ({ text, origin: "base" as const })));
    else if (region.kind === "clean") out.push(...region.lines.map((text) => ({ text, origin: region.side })));
    else {
      const id = fm.conflicts[n++];
      const r = resolutions[id];
      if (r) out.push(...resolveRegion(region, r).map((text) => ({ text, origin: "resolved" as const, conflict: id })));
      else
        out.push(
          { text: "<<<<<<< ours", origin: "conflict", conflict: id },
          ...region.ours.map((text) => ({ text, origin: "conflict" as const, conflict: id })),
          { text: "=======", origin: "conflict", conflict: id },
          ...region.theirs.map((text) => ({ text, origin: "conflict" as const, conflict: id })),
          { text: ">>>>>>> theirs", origin: "conflict", conflict: id },
        );
    }
  }
  return out;
}

export type Candidate = {
  files: Record<string, string>;
  /** Conflicts still without a resolution. */
  unresolved: string[];
  /** True when any text was typed by hand (an "edit" resolution or a whole-file edit). */
  handEdited: boolean;
};

/** The whole merge result as a file set. `fileEdits` replace a file's merged text entirely. */
export function buildCandidate(m: MergeResult, resolutions: Record<string, Resolution>, fileEdits: Record<string, string> = {}): Candidate {
  const files: Record<string, string> = {};
  for (const fm of m.files) {
    if (fm.path in fileEdits) {
      files[fm.path] = fileEdits[fm.path];
      continue;
    }
    const lines = resolveFile(fm, resolutions);
    if (lines) files[fm.path] = lines.length ? `${lines.map((l) => l.text).join("\n")}\n` : "";
  }
  const unresolved = m.conflicts.filter((c) => !resolutions[c.id] && !(c.path in fileEdits)).map((c) => c.id);
  const handEdited = Object.keys(fileEdits).length > 0 || Object.values(resolutions).some((r) => r.strategy === "edit");
  return { files, unresolved, handEdited };
}

type Diag = { path: string; line: number; code: number; message: string };

/**
 * Split diagnostics into those the merge introduced and those already on our branch.
 * Matched by file, code, message and the text of the line, so shifted line numbers still match.
 */
export function compareDiagnostics<D extends Diag>(baseline: Diag[], baselineFiles: Record<string, string>, now: D[], nowFiles: Record<string, string>) {
  const key = (d: Diag, files: Record<string, string>) => `${d.path}|${d.code}|${d.message}|${(files[d.path] ?? "").split("\n")[d.line - 1]?.trim()}`;
  const before = new Map<string, number>();
  for (const d of baseline) before.set(key(d, baselineFiles), (before.get(key(d, baselineFiles)) ?? 0) + 1);
  const introduced: D[] = [];
  const existing: D[] = [];
  for (const d of now) {
    const k = key(d, nowFiles);
    const left = before.get(k) ?? 0;
    if (left > 0) {
      before.set(k, left - 1);
      existing.push(d);
    } else introduced.push(d);
  }
  return { introduced, existing };
}

/** A `git diff`-style patch from one file set to another, with three lines of context. */
export function unifiedPatch(from: Record<string, string>, to: Record<string, string>) {
  const out: string[] = [];
  const paths = [...new Set([...Object.keys(from), ...Object.keys(to)])].sort();
  for (const path of paths) {
    const a = from[path];
    const b = to[path];
    if (a === b) continue;
    out.push(`diff --git a/${path} b/${path}`);
    if (a === undefined) out.push("new file mode 100644");
    if (b === undefined) out.push("deleted file mode 100644");
    out.push(`--- ${a === undefined ? "/dev/null" : `a/${path}`}`, `+++ ${b === undefined ? "/dev/null" : `b/${path}`}`);
    const d = diffLines(a ?? "", b ?? "");
    const changed = d.map((l) => l.kind !== "same");
    let i = 0;
    while (i < d.length) {
      if (!changed[i]) {
        i++;
        continue;
      }
      // Grow the hunk while changes are within six lines of each other.
      const start = Math.max(0, i - 3);
      let end = i;
      for (let j = i; j < d.length; j++) {
        if (changed[j]) end = j;
        else if (j - end > 6) break;
      }
      const stop = Math.min(d.length, end + 4);
      const slice = d.slice(start, stop);
      const aLines = slice.filter((l) => l.kind !== "add");
      const bLines = slice.filter((l) => l.kind !== "del");
      const aStart = aLines.length ? (aLines[0] as { a: number }).a : (d.slice(0, start).filter((l) => l.kind !== "add").length);
      const bStart = bLines.length ? (bLines[0] as { b: number }).b : (d.slice(0, start).filter((l) => l.kind !== "del").length);
      out.push(`@@ -${aStart},${aLines.length} +${bStart},${bLines.length} @@`);
      for (const l of slice) out.push(`${l.kind === "add" ? "+" : l.kind === "del" ? "-" : " "}${l.text}`);
      i = stop;
    }
  }
  return out.length ? `${out.join("\n")}\n` : "";
}
