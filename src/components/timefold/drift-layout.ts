// A layout that never moves: every file and symbol that ever existed gets one fixed slot,
// so stepping through history only adds, removes and recolours, it never reshuffles.

import { LAYER_CONFIG } from "@/features/impact-analysis/fixture";
import { isTestFile } from "@/features/impact-analysis/source-analysis";
import type { History } from "@/features/timefold/history";

export const COL_W = 196;
export const CARD_W = 168;
export const HEAD_H = 26;
export const ROW_H = 19;
export const GAP = 14;
export const TOP = 30;

export type Slot = { key: string; y: number };
export type FileBox = { path: string; column: string; x: number; y: number; h: number; slots: Map<string, Slot> };

/** Slot key for a symbol: its lineage, so a renamed function keeps its row. Tests key by name. */
export const slotKey = (h: History, id: string) => (id.startsWith("test:") ? id : (h.lineageOf.get(id) ?? id));

export function driftLayout(h: History) {
  const files = new Map<string, { column: string; keys: string[] }>();
  for (const s of h.snapshots) {
    for (const n of s.nodes) {
      if (n.kind === "file") {
        if (!files.has(n.path)) files.set(n.path, { column: isTestFile(n.path) ? "tests" : (s.analysis.layerOf[n.id] ?? "unclassified"), keys: [] });
      }
    }
    for (const n of s.nodes) {
      if (n.kind === "file") continue;
      const f = files.get(n.path);
      const key = slotKey(h, n.id);
      // A renamed symbol may have moved file; it keeps the slot where it first appeared.
      if (f && ![...files.values()].some((o) => o.keys.includes(key))) f.keys.push(key);
    }
  }

  // Configured layers in order, then files no layer claims (shown, never guessed), then tests.
  const used = new Set([...files.values()].map((f) => f.column));
  const columns = [
    ...LAYER_CONFIG.layers.map((l) => ({ id: l.id, label: l.label })),
    ...(used.has("unclassified") ? [{ id: "unclassified", label: "Unclassified" }] : []),
    { id: "tests", label: "Tests" },
  ];

  const boxes = new Map<string, FileBox>();
  const slotOf = new Map<string, { path: string; y: number }>();
  let height = 0;
  columns.forEach((col, ci) => {
    let y = TOP;
    const inCol = [...files.entries()].filter(([, f]) => f.column === col.id).sort(([a], [b]) => a.localeCompare(b));
    for (const [path, f] of inCol) {
      const hgt = HEAD_H + Math.max(1, f.keys.length) * ROW_H + 6;
      const slots = new Map<string, Slot>();
      f.keys.forEach((k, i) => {
        const sy = y + HEAD_H + i * ROW_H + ROW_H / 2;
        slots.set(k, { key: k, y: sy });
        slotOf.set(k, { path, y: sy });
      });
      boxes.set(path, { path, column: col.id, x: ci * COL_W + (COL_W - CARD_W) / 2, y, h: hgt, slots });
      y += hgt + GAP;
    }
    height = Math.max(height, y);
  });
  return { columns, boxes, slotOf, width: columns.length * COL_W, height };
}
