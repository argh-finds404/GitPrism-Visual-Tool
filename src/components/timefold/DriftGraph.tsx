"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { short } from "@/lib/git";
import { usePrefersReducedMotion } from "@/lib/theme";
import { C, useTimeFold } from "./store";
import { CARD_W, COL_W, driftLayout, HEAD_H, ROW_H, slotKey } from "./drift-layout";
import type { Snapshot } from "@/features/timefold/history";

const STATUS: Record<string, string> = { added: C.green, modified: C.magenta };
const ease = [0.22, 1, 0.36, 1] as const;

function metrics(s: Snapshot) {
  return {
    files: s.nodes.filter((n) => n.kind === "file").length,
    functions: s.functions.size,
    calls: s.edges.filter((e) => e.kind === "calls").length,
    violations: s.analysis.violations.length,
    cycles: s.analysis.cycles.length,
  };
}

/** Architecture drift: the whole codebase at one commit, in a layout that never reshuffles. */
export function DriftGraph() {
  const { h, index, lineage, setLineage, dna } = useTimeFold();
  const reduce = usePrefersReducedMotion();
  const [imports, setImports] = useState(false);
  const layout = useMemo(() => driftLayout(h), [h]);
  const snap = h.snapshots[index];
  const prev = index > 0 ? h.snapshots[index - 1] : null;
  const dur = reduce ? 0 : 0.45;

  const presentFiles = snap.nodes.filter((n) => n.kind === "file").map((n) => n.path);
  const status = new Map(snap.analysis.nodes.map((n) => [n.id, n.changeStatus]));
  const prevEdges = new Set(prev?.edges.map((e) => e.id) ?? []);
  const violating = new Set(snap.analysis.violations.map((v) => v.edgeId));
  const selectedId = dna[index].id;

  // Where a node sits: symbols and tests by slot, files by their card's header.
  const point = (id: string, side: "in" | "out") => {
    if (id.startsWith("file:")) {
      const b = layout.boxes.get(id.slice(5));
      return b ? { x: side === "out" ? b.x + CARD_W : b.x, y: b.y + HEAD_H / 2, col: b.column } : null;
    }
    const slot = layout.slotOf.get(slotKey(h, id));
    const b = slot && layout.boxes.get(slot.path);
    return slot && b ? { x: side === "out" ? b.x + CARD_W : b.x, y: slot.y, col: b.column } : null;
  };
  const curve = (a: { x: number; y: number; col: string }, b: { x: number; y: number; col: string }) => {
    if (a.col === b.col) {
      // Same column: loop out to the right and back.
      const x = a.x + 22;
      return `M${a.x} ${a.y}C${x} ${a.y} ${x} ${b.y} ${b.x + CARD_W} ${b.y}`;
    }
    const mid = (a.x + b.x) / 2;
    return `M${a.x} ${a.y}C${mid} ${a.y} ${mid} ${b.y} ${b.x} ${b.y}`;
  };

  const edges = snap.edges
    .filter((e) => e.kind !== "imports" || imports || violating.has(e.id))
    .map((e) => {
      const a = point(e.source, "out");
      const b = point(e.target, "in");
      if (!a || !b) return null;
      const touches = !!selectedId && (e.source === selectedId || e.target === selectedId);
      const fresh = !!prev && !prevEdges.has(e.id);
      const color = violating.has(e.id) ? C.red : fresh ? C.amber : touches ? C.cyan : e.kind === "tests" ? C.green : C.violet;
      return { id: e.id, d: curve(a, b), color, strong: touches || fresh || violating.has(e.id), dashed: e.kind === "imports", violation: violating.has(e.id) };
    })
    .filter((x) => x !== null);

  // Impact ripple: when this commit changed the selected function, walk its known callers outward.
  const changedHere = dna[index].events.some((e) => e.kind === "body" || e.kind === "signature" || e.kind === "created");
  const ripple: { id: string; depth: number }[] = [];
  if (changedHere && selectedId) {
    const seen = new Set([selectedId]);
    let frontier = [selectedId];
    for (let depth = 1; depth <= 3 && frontier.length; depth++) {
      const next: string[] = [];
      for (const id of frontier)
        for (const e of snap.edges)
          if ((e.kind === "calls" || e.kind === "tests") && e.target === id && !seen.has(e.source)) {
            seen.add(e.source);
            next.push(e.source);
            ripple.push({ id: e.source, depth });
          }
      frontier = next;
    }
  }

  const m = metrics(snap);
  const pm = prev ? metrics(prev) : null;
  const series = h.snapshots.map((s) => metrics(s));
  const maxCalls = Math.max(...series.map((s) => s.calls), 1);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] text-[#9a90ad]">architecture drift</p>
          <h2 className="display text-[clamp(1.4rem,2.2vw,2rem)] text-white">The codebase at {short(snap.commit.oid)}</h2>
        </div>
        <dl className="flex flex-wrap gap-x-5 gap-y-1">
          {(
            [
              ["Files", "files"],
              ["Functions", "functions"],
              ["Calls", "calls"],
              ["Layer violations", "violations"],
              ["Import cycles", "cycles"],
            ] as const
          ).map(([label, k]) => {
            const d = pm ? m[k] - pm[k] : 0;
            return (
              <div key={k}>
                <dt className="text-[11px] text-[#9a90ad]">{label}</dt>
                <dd className="font-mono text-[15px] text-white">
                  {m[k]}
                  {d !== 0 && (
                    <span className="ml-1 text-[11px]" style={{ color: (k === "violations" || k === "cycles") === d > 0 ? C.red : C.green }}>
                      {d > 0 ? `+${d}` : d}
                    </span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </header>

      {/* Drift over the whole history: calls (bars) and layer violations (red ticks). */}
      <div className="flex h-9 items-end gap-[3px]" aria-label="Calls and layer violations across history" role="img">
        {series.map((s, i) => (
          <div key={i} className="relative flex h-full flex-1 flex-col justify-end">
            <div className="rounded-sm" style={{ height: `${(s.calls / maxCalls) * 100}%`, background: i === index ? C.amber : "rgb(157 123 255 / 0.35)" }} />
            {s.violations > 0 && <div className="absolute -top-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full" style={{ background: C.red }} />}
          </div>
        ))}
      </div>

      <div className="hud relative min-h-0 flex-1 overflow-auto p-2">
        <div className="sticky left-0 top-0 z-10 flex flex-wrap items-center justify-end gap-x-4 gap-y-1 px-2 pb-1 text-[11px] text-[#9a90ad]">
          <Legend color={C.violet}>calls</Legend>
          <Legend color={C.green}>tests</Legend>
          <Legend color={C.amber}>new in this commit</Legend>
          <Legend color={C.red}>breaks a layer rule</Legend>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={imports} onChange={(e) => setImports(e.target.checked)} className="accent-[#9D7BFF]" />
            file imports
          </label>
        </div>
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="block w-full min-w-[760px]" role="img" aria-label={`Files, functions and calls at ${short(snap.commit.oid)}`}>
          {layout.columns.map((c, i) => (
            <text key={c.id} x={i * COL_W + COL_W / 2} y={16} textAnchor="middle" fontSize={11} fill={C.ink3} fontFamily="var(--font-mono)">
              {c.label}
            </text>
          ))}

          <AnimatePresence initial={false}>
            {edges.map((e) => (
              <motion.path
                key={e.id}
                d={e.d}
                fill="none"
                stroke={e.color}
                strokeWidth={e.strong ? 1.6 : 1}
                strokeDasharray={e.dashed ? "4 4" : undefined}
                initial={{ opacity: 0 }}
                animate={{ opacity: e.strong ? 0.95 : 0.32 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur, ease }}
              >
                {e.violation && <title>Breaks a configured layer rule</title>}
              </motion.path>
            ))}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {presentFiles.map((path) => {
              const b = layout.boxes.get(path);
              if (!b) return null;
              const st = status.get(`file:${path}`);
              const syms = snap.nodes.filter((n) => n.kind !== "file" && n.path === path);
              return (
                <motion.g
                  key={path}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: dur, ease }}
                  style={{ transformOrigin: `${b.x + CARD_W / 2}px ${b.y + b.h / 2}px` }}
                >
                  <rect x={b.x} y={b.y} width={CARD_W} height={b.h} rx={10} fill="#141022" stroke={st && st !== "unchanged" ? STATUS[st] : "rgb(255 255 255 / 0.1)"} strokeWidth={st && st !== "unchanged" ? 1.4 : 1} />
                  <text x={b.x + 10} y={b.y + 17} fontSize={11} fill={C.ink} fontFamily="var(--font-mono)">
                    {path.split("/").pop()}
                    <title>{path}</title>
                  </text>
                  <AnimatePresence initial={false}>
                    {syms.map((n) => {
                      const slot = b.slots.get(slotKey(h, n.id));
                      if (!slot) return null;
                      const s = status.get(n.id);
                      const selected = n.kind === "symbol" && h.lineageOf.get(n.id) === lineage;
                      return (
                        <motion.g
                          key={slotKey(h, n.id)}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: dur, ease }}
                          onClick={() => n.kind === "symbol" && setLineage(h.lineageOf.get(n.id)!)}
                          style={{ cursor: n.kind === "symbol" ? "pointer" : "default" }}
                        >
                          {selected && <rect x={b.x + 4} y={slot.y - ROW_H / 2 + 1} width={CARD_W - 8} height={ROW_H - 2} rx={5} fill="rgb(62 224 255 / 0.12)" />}
                          <circle cx={b.x + 13} cy={slot.y} r={3} fill={s === "added" || s === "modified" ? STATUS[s] : n.kind === "test" ? "rgb(61 224 166 / 0.5)" : "rgb(157 123 255 / 0.55)"} />
                          <text x={b.x + 22} y={slot.y + 3.5} fontSize={10.5} fill={selected ? C.cyan : C.ink2} fontFamily="var(--font-mono)">
                            {n.kind === "test" ? `“${n.name.length > 20 ? `${n.name.slice(0, 19)}…` : n.name}”` : `${n.name}()`}
                            <title>{n.kind === "test" ? `test “${n.name}”` : `${n.name}(${n.params ?? ""})`}</title>
                          </text>
                        </motion.g>
                      );
                    })}
                  </AnimatePresence>
                </motion.g>
              );
            })}
          </AnimatePresence>

          {/* Ripple rings, one hop at a time. Keyed by commit so stepping replays them. */}
          {!reduce &&
            ripple.map((r) => {
              const p = point(r.id, "in");
              if (!p) return null;
              return (
                <motion.circle
                  key={`${index}-${r.id}`}
                  cx={p.x + 13}
                  cy={p.y}
                  r={4}
                  fill="none"
                  stroke={C.cyan}
                  initial={{ opacity: 0.9, scale: 1 }}
                  animate={{ opacity: 0, scale: 4 }}
                  transition={{ duration: 0.45, delay: 0.25 + r.depth * 0.35, ease: "easeOut" }}
                  style={{ transformOrigin: `${p.x + 13}px ${p.y}px` }}
                />
              );
            })}
        </svg>
      </div>
      {ripple.length > 0 && (
        <p className="text-[11.5px] text-[#9a90ad]">
          This commit changed the selected function. The ring travels through its {ripple.length} known caller{ripple.length > 1 ? "s" : ""} and tests, hop by hop. That shows
          what depends on it, not what will break.
        </p>
      )}
    </div>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-3 rounded" style={{ background: color }} />
      {children}
    </span>
  );
}
