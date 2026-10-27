// Gives every line of a function a stable identity across revisions, so unchanged lines
// keep their place when the view moves between commits and only real changes animate.

import { diffLines } from "@/lib/git";
import type { DnaEntry, History } from "@/features/timefold/history";

export type Row = { key: string; kind: "same" | "add" | "del"; text: string; line: number };

const sourceOf = (h: History, e: DnaEntry) => {
  const fn = e.fn!;
  return h.snapshots[e.index].commit.files[fn.path].split("\n").slice(fn.startLine - 1, fn.endLine).join("\n");
};

/** Rows for each revision where the function exists: its source, diffed against the parent revision. */
export function trackLines(h: History, dna: DnaEntry[]) {
  const out = new Map<number, Row[]>();
  let next = 0;
  let prevIds: string[] = [];
  let prevText = "";
  let prev: DnaEntry | null = null;

  for (const e of dna) {
    if (!e.fn) {
      prev = null;
      prevIds = [];
      continue;
    }
    const text = sourceOf(h, e);
    const start = e.fn.startLine;
    const rows: Row[] = [];
    const ids: string[] = [];
    if (prev && prev.index === e.index - 1) {
      for (const d of diffLines(prevText, text)) {
        if (d.kind === "same") {
          const id = prevIds[d.a - 1];
          ids.push(id);
          rows.push({ key: id, kind: "same", text: d.text, line: start + d.b - 1 });
        } else if (d.kind === "add") {
          const id = `l${next++}`;
          ids.push(id);
          rows.push({ key: id, kind: "add", text: d.text, line: start + d.b - 1 });
        } else {
          rows.push({ key: prevIds[d.a - 1], kind: "del", text: d.text, line: prev.fn!.startLine + d.a - 1 });
        }
      }
    } else {
      text.split("\n").forEach((t, k) => {
        const id = `l${next++}`;
        ids.push(id);
        rows.push({ key: id, kind: "add", text: t, line: start + k });
      });
    }
    out.set(e.index, rows);
    prev = e;
    prevIds = ids;
    prevText = text;
  }
  return out;
}
