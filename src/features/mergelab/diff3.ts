// Three-way line merge (diff3). Lines that base, ours and theirs all share are sync
// points; between them, a side that changed wins, identical changes merge, and different
// changes conflict. Conflicts are then refined like Git's default (zealous) merge level.
// Tests compare the output with git merge-file, byte for byte.

import { diffLines, splitLines } from "@/lib/git";

export type Region =
  | { kind: "stable"; lines: string[]; baseStart: number }
  | {
      kind: "clean";
      side: "ours" | "theirs" | "both";
      lines: string[];
      base: string[];
      baseStart: number;
      /** Lines both sides wrote inside what began as a conflict. */
      agreed?: boolean;
    }
  | {
      kind: "conflict";
      base: string[];
      ours: string[];
      theirs: string[];
      /** 0-based first line of each slice in its own file. */
      baseStart: number;
      oursStart: number;
      theirsStart: number;
    };

export type ConflictRegion = Extract<Region, { kind: "conflict" }>;

const eq = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** For each line of `a`, the index of the matching line of `b`, or -1. */
function matchMap(a: string[], b: string[]) {
  const m = new Array<number>(a.length).fill(-1);
  for (const d of diffLines(text(a), text(b))) if (d.kind === "same") m[d.a - 1] = d.b - 1;
  return m;
}

const hasAlnum = (lines: string[]) => lines.some((l) => /[A-Za-z0-9]/.test(l));

export function merge3(baseText: string, oursText: string, theirsText: string): Region[] {
  const base = splitLines(baseText);
  const ours = splitLines(oursText);
  const theirs = splitLines(theirsText);
  // splitLines("") gives [""]; an empty file has no lines.
  if (baseText === "") base.length = 0;
  if (oursText === "") ours.length = 0;
  if (theirsText === "") theirs.length = 0;

  const mo = matchMap(base, ours);
  const mt = matchMap(base, theirs);
  const raw: Region[] = [];
  let i = 0;
  let j = 0;
  let k = 0;

  const flush = (i2: number, j2: number, k2: number) => {
    const b = base.slice(i, i2);
    const o = ours.slice(j, j2);
    const t = theirs.slice(k, k2);
    if (!b.length && !o.length && !t.length) return;
    if (eq(o, b) && eq(t, b)) raw.push({ kind: "stable", lines: b, baseStart: i });
    else if (eq(o, b)) raw.push({ kind: "clean", side: "theirs", lines: t, base: b, baseStart: i });
    else if (eq(t, b)) raw.push({ kind: "clean", side: "ours", lines: o, base: b, baseStart: i });
    else if (eq(o, t)) raw.push({ kind: "clean", side: "both", lines: o, base: b, baseStart: i });
    else raw.push({ kind: "conflict", base: b, ours: o, theirs: t, baseStart: i, oursStart: j, theirsStart: k });
  };

  for (let x = 0; x < base.length; x++) {
    if (mo[x] < 0 || mt[x] < 0) continue;
    flush(x, mo[x], mt[x]);
    raw.push({ kind: "stable", lines: [base[x]], baseStart: x });
    i = x + 1;
    j = mo[x] + 1;
    k = mt[x] + 1;
  }
  flush(base.length, ours.length, theirs.length);

  return refine(coalesce(raw));
}

/** Join neighbouring stable regions. */
function coalesce(regions: Region[]) {
  const out: Region[] = [];
  for (const r of regions) {
    const last = out.at(-1);
    if (r.kind === "stable" && last?.kind === "stable") last.lines.push(...r.lines);
    else out.push(r.kind === "stable" ? { ...r, lines: [...r.lines] } : r);
  }
  return out;
}

/**
 * Git's default (zealous) merge level, in Git's order. First each conflict is split wherever
 * ours and theirs share lines; those lines merge cleanly. Then neighbouring conflicts are joined
 * when at most three unchanged lines separate them, or when those lines have no letters or digits.
 */
function refine(regions: Region[]): Region[] {
  const split: Region[] = [];
  for (const r of regions) {
    if (r.kind !== "conflict" || !r.ours.length || !r.theirs.length) {
      split.push(r);
      continue;
    }
    let first = true;
    let pendO: string[] = [];
    let pendT: string[] = [];
    let at = { o: 0, t: 0 };
    let oi = 0;
    let ti = 0;
    const flush = () => {
      if (!pendO.length && !pendT.length) return;
      split.push({
        kind: "conflict",
        // Git keeps the base with the first piece; later pieces have none of their own.
        base: first ? r.base : [],
        ours: pendO,
        theirs: pendT,
        baseStart: r.baseStart,
        oursStart: r.oursStart + at.o,
        theirsStart: r.theirsStart + at.t,
      });
      first = false;
      pendO = [];
      pendT = [];
    };
    const mark = () => {
      if (!pendO.length && !pendT.length) at = { o: oi, t: ti };
    };
    for (const l of diffLines(text(r.ours), text(r.theirs))) {
      if (l.kind === "same") {
        flush();
        split.push({ kind: "clean", side: "both", lines: [l.text], base: [], baseStart: r.baseStart, agreed: true });
        oi++;
        ti++;
      } else if (l.kind === "del") {
        mark();
        pendO.push(l.text);
        oi++;
      } else {
        mark();
        pendT.push(l.text);
        ti++;
      }
    }
    flush();
  }

  const out: Region[] = [];
  for (const r of split) {
    out.push(r);
    if (r.kind !== "conflict") continue;
    // Walk back over unchanged lines to the previous conflict, if nothing else is in between.
    let g = out.length - 2;
    const gap: Exclude<Region, ConflictRegion>[] = [];
    for (let x = out[g]; g >= 0 && (x.kind === "stable" || (x.kind === "clean" && x.agreed)); x = out[--g]) gap.unshift(x);
    const prev = out[g];
    if (!prev || prev.kind !== "conflict") continue;
    const lines = gap.flatMap((x) => x.lines);
    if (lines.length > 3 && hasAlnum(lines)) continue;
    const baseLines = gap.flatMap((x) => (x.kind === "stable" ? x.lines : []));
    out.splice(g, out.length - g, {
      ...prev,
      base: [...prev.base, ...baseLines, ...r.base],
      ours: [...prev.ours, ...lines, ...r.ours],
      theirs: [...prev.theirs, ...lines, ...r.theirs],
    });
  }
  return out;
}

const text = (lines: string[]) => (lines.length ? `${lines.join("\n")}\n` : "");

/** The merged text with Git-style conflict markers for every conflict. */
export function withMarkers(regions: Region[], labels = { ours: "ours", base: "base", theirs: "theirs" }, diff3 = false) {
  const out: string[] = [];
  for (const r of regions) {
    if (r.kind !== "conflict") out.push(...r.lines);
    else {
      out.push(`<<<<<<< ${labels.ours}`, ...r.ours);
      if (diff3) out.push(`||||||| ${labels.base}`, ...r.base);
      out.push("=======", ...r.theirs, `>>>>>>> ${labels.theirs}`);
    }
  }
  return out.length ? `${out.join("\n")}\n` : "";
}
