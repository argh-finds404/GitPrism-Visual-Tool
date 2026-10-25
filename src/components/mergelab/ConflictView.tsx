"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Undo2 } from "lucide-react";
import { splitLines } from "@/lib/git";
import { usePrefersReducedMotion } from "@/lib/theme";
import { resolveRegion, type Resolution } from "@/features/mergelab/merge";
import { semanticChanges } from "@/features/mergelab/semantic";
import type { ConflictRegion } from "@/features/mergelab/diff3";
import { SmoothInput } from "@/components/ui/skiper-ui/skiper106";
import { M, useMergeLab } from "./store";

const ease = [0.22, 1, 0.36, 1] as const;

const STRATEGIES: { id: Resolution["strategy"]; label: string; hint: string; key: string }[] = [
  { id: "ours", label: "Use ours", hint: "Keep the current branch's lines", key: "o" },
  { id: "theirs", label: "Use theirs", hint: "Keep the incoming branch's lines", key: "t" },
  { id: "ours-theirs", label: "Both, ours first", hint: "Ours, then theirs", key: "b" },
  { id: "theirs-ours", label: "Both, theirs first", hint: "Theirs, then ours", key: "" },
  { id: "edit", label: "Edit by hand", hint: "Write the combined version", key: "" },
];

/** A slice of a side's file around the conflict, with real line numbers. */
function window_(text: string | undefined, start: number, len: number, pad = 2) {
  const lines = text ? splitLines(text) : [];
  const from = Math.max(0, start - pad);
  const to = Math.min(lines.length, start + len + pad);
  return lines.slice(from, to).map((t, i) => ({ n: from + i + 1, t, hot: from + i >= start && from + i < start + len }));
}

export function ConflictView({ id }: { id: string }) {
  const { m, sides, places, relations, resolutions, resolve, notes, setNote, undo, canUndo, select, refs } = useMergeLab();
  const reduce = usePrefersReducedMotion();
  const conflict = m.conflicts.find((c) => c.id === id)!;
  const index = m.conflicts.indexOf(conflict);
  const place = places.get(id)!;
  const current = resolutions[id];
  const [editing, setEditing] = useState<string | null>(null);

  // Symbols both branches changed the signature of, when this conflict sits inside them.
  const bothSigs = useMemo(() => {
    const o = semanticChanges(conflict.path, sides.base[conflict.path], sides.ours[conflict.path], sides.ours) ?? [];
    const t = semanticChanges(conflict.path, sides.base[conflict.path], sides.theirs[conflict.path], sides.theirs) ?? [];
    return place.symbols.flatMap((s) => {
      const a = o.find((c) => c.kind === "signature" && c.symbol === s);
      const b = t.find((c) => c.kind === "signature" && c.symbol === s);
      return a && b ? [{ symbol: s, ours: a.detail!.split(" → ")[1], theirs: b.detail!.split(" → ")[1], base: a.detail!.split(" → ")[0] }] : [];
    });
  }, [conflict.path, place.symbols, sides]);

  const linked = relations.filter((r) => r.a === id || r.b === id);
  const go = (d: 1 | -1) => select({ kind: "conflict", id: m.conflicts[(index + d + m.conflicts.length) % m.conflicts.length].id });

  if (conflict.kind === "modify-delete") return <ModifyDelete id={id} />;
  const region = conflict.region as ConflictRegion;
  const panes = [
    { side: "ours" as const, label: `ours · ${refs.ours}`, color: M.ours, rows: window_(sides.ours[conflict.path], region.oursStart, region.ours.length), delay: 0.25, x: -16 },
    { side: "base" as const, label: "base · common ancestor", color: M.base, rows: window_(sides.base[conflict.path], region.baseStart, region.base.length), delay: 0, x: 0 },
    { side: "theirs" as const, label: `theirs · ${refs.theirs}`, color: M.theirs, rows: window_(sides.theirs[conflict.path], region.theirsStart, region.theirs.length), delay: 0.25, x: 16 },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto pr-1">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-[#9a90ad]">
            conflict {index + 1} of {m.conflicts.length}
          </p>
          <h2 className="display truncate text-[clamp(1.25rem,2vw,1.8rem)] text-white">
            {place.symbols.length ? `${place.symbols.map((s) => `${s}()`).join(", ")}` : conflict.path.split("/").pop()}
          </h2>
          <p className="mt-0.5 truncate font-mono text-[12px] text-[#9a90ad]">{conflict.path}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} className="grid h-8 w-8 place-items-center rounded-lg text-[#c9c0d8] hover:bg-white/8 hover:text-white" aria-label="Previous conflict" title="Previous conflict (k)">
            <ArrowLeft size={16} />
          </button>
          <button type="button" onClick={() => go(1)} className="grid h-8 w-8 place-items-center rounded-lg text-[#c9c0d8] hover:bg-white/8 hover:text-white" aria-label="Next conflict" title="Next conflict (j)">
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {bothSigs.map((b) => (
        <div key={b.symbol} className="rounded-xl border border-[#FF5CB8]/30 bg-[#FF5CB8]/[0.07] px-4 py-3 text-[12.5px] leading-relaxed text-[#f3eef8]">
          <p className="font-medium">Both branches changed {b.symbol}()&apos;s signature.</p>
          <p className="mt-1 font-mono text-[11.5px] text-[#c9c0d8]">
            base {b.base}<br />
            <span style={{ color: M.ours }}>ours</span> {b.ours}
            <br />
            <span style={{ color: M.theirs }}>theirs</span> {b.theirs}
          </p>
          <p className="mt-1 text-[#c9c0d8]">Every caller has to agree with whichever signature survives. Check the linked conflicts and the call sites after resolving.</p>
        </div>
      ))}

      {/* The history's shape: base first, diverging into the two branches, which then converge on the decision. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={id} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <Pane pane={panes[1]} reduce={reduce} />
          <Wires from="center" reduce={reduce} delay={0.15} />
          <div className="mt-2 grid grid-cols-1 gap-2 xl:mt-0 xl:grid-cols-2">
            <Pane pane={panes[0]} reduce={reduce} />
            <Pane pane={panes[2]} reduce={reduce} />
          </div>
          <Wires from="sides" reduce={reduce} delay={0.45} />
          <div className="h-2 xl:hidden" />
        </motion.div>
      </AnimatePresence>

      <section className="hud p-4" aria-label="Resolution">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-white">Decision</h3>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 font-mono text-[10.5px] ${current ? "bg-[#3DE0A6]/15 text-[#7ff0c4]" : "bg-[#FF7A90]/15 text-[#ffb3c0]"}`}>
              {current ? "resolved" : "unresolved"}
            </span>
            <button type="button" onClick={undo} disabled={!canUndo} className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-[#c9c0d8] hover:bg-white/8 disabled:opacity-30" title="Undo (u)">
              <Undo2 size={13} /> Undo
            </button>
          </div>
        </div>

        <div role="radiogroup" aria-label="Resolution strategy" className="mt-3 grid gap-1.5 sm:grid-cols-3 xl:grid-cols-6">
          {STRATEGIES.map((st) => {
            const on = current?.strategy === st.id;
            return (
              <button
                key={st.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => (st.id === "edit" ? setEditing(current ? resolveRegion(region, current).join("\n") : region.ours.join("\n")) : (setEditing(null), resolve(id, { strategy: st.id })))}
                className={`flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors ${on ? "border-[#3DE0A6] bg-[#3DE0A6]/10" : "border-white/10 hover:border-white/25"}`}
              >
                <span className="flex w-full items-center justify-between text-[12.5px] font-medium text-white">
                  {st.label}
                  {st.key && <span className="kbd">{st.key}</span>}
                </span>
                <span className="mt-0.5 text-[11px] leading-snug text-[#9a90ad]">{st.hint}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => (setEditing(null), resolve(id, undefined))}
            className="flex flex-col items-start rounded-xl border border-dashed border-white/15 px-3 py-2 text-left hover:border-white/30"
          >
            <span className="text-[12.5px] font-medium text-white">Defer</span>
            <span className="mt-0.5 text-[11px] leading-snug text-[#9a90ad]">Leave it unresolved for now</span>
          </button>
        </div>

        {editing !== null && (
          <div className="mt-3">
            <label className="text-[11.5px] text-[#9a90ad]" htmlFor="ml-edit">
              Lines that replace this conflict. Hand-written code is checked by parsing and type checking; its tests run in your browser.
            </label>
            <textarea
              id="ml-edit"
              value={editing}
              onChange={(e) => setEditing(e.target.value)}
              spellCheck={false}
              rows={Math.min(14, Math.max(4, editing.split("\n").length + 1))}
              className="mt-1.5 w-full rounded-xl border border-white/12 bg-[#0e0b19] p-3 font-mono text-[12px] leading-[1.6] text-white outline-none focus:border-[#3DE0A6]"
            />
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => (resolve(id, { strategy: "edit", text: editing }), setEditing(null))} className="h-8 rounded-full bg-[#3DE0A6] px-4 text-[12.5px] font-medium text-[#06110c]">
                Use these lines
              </button>
              <button type="button" onClick={() => setEditing(null)} className="h-8 rounded-full border border-white/15 px-4 text-[12.5px] text-[#c9c0d8]">
                Cancel
              </button>
            </div>
          </div>
        )}

        <label className="mt-3 flex flex-col gap-1 text-[11.5px] text-[#9a90ad]">
          Note for the resolution history (optional)
          <SmoothInput
            value={notes[id] ?? ""}
            onChange={(e) => setNote(id, e.target.value)}
            placeholder="Why this resolution?"
            wrapperClassName="border-white/12 bg-[#120e20] has-[:focus-visible]:border-[#3DE0A6] has-[:focus-visible]:shadow-none"
            className="font-sans text-[12.5px] text-white placeholder:text-[#6f6782]"
          />
        </label>

        <Preview region={region} resolution={current} />

        {linked.length > 0 && (
          <div className="mt-3 border-t border-white/8 pt-3 text-[12px] text-[#c9c0d8]">
            <p className="mb-1 text-[11px] font-semibold text-[#9a90ad]">Linked conflicts</p>
            <ul className="space-y-1">
              {linked.map((r, k) => {
                const other = r.a === id ? r.b : r.a;
                return (
                  <li key={k}>
                    <button type="button" onClick={() => select({ kind: "conflict", id: other })} className="text-left hover:text-white">
                      <span className="font-mono text-[11.5px]" style={{ color: M.theirs }}>
                        {other.split("/").pop()}
                      </span>{" "}
                      · {r.evidence}
                      {r.location && (
                        <span className="text-[#9a90ad]">
                          {" "}
                          ({r.location.side}, line {r.location.line})
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

type PaneData = { side: "ours" | "base" | "theirs"; label: string; color: string; rows: { n: number; t: string; hot: boolean }[]; delay: number; x: number };

function Pane({ pane: p, reduce }: { pane: PaneData; reduce: boolean }) {
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, x: p.x, y: p.side === "base" ? -6 : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.4, delay: reduce ? 0 : p.delay, ease }}
      className="hud min-w-0 overflow-hidden"
      aria-label={p.label}
    >
      <p className="flex items-center gap-2 border-b border-white/8 px-3 py-1.5 font-mono text-[11px]" style={{ color: p.color }}>
        <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden="true" />
        {p.label}
      </p>
      <pre className="overflow-x-auto py-1.5 font-mono text-[11.5px] leading-[1.65]">
        {p.rows.map((r) => (
          <div key={r.n} className="grid grid-cols-[2.4rem_1fr] pr-3" style={{ background: r.hot ? `${p.color}1a` : undefined }}>
            <span className="select-none pr-2 text-right text-[#6f6782]">{r.n}</span>
            <span className={r.hot ? "text-white" : "text-[#9a90ad]"}>{r.t || " "}</span>
          </div>
        ))}
        {!p.rows.some((r) => r.hot) && <p className="px-3 text-[11px] text-[#9a90ad]">This side has no lines here; the conflict sits between the lines shown.</p>}
      </pre>
    </motion.section>
  );
}

/** Connectors: base splitting into the two branches, or the branches meeting at the decision. */
function Wires({ from, reduce, delay }: { from: "center" | "sides"; reduce: boolean; delay: number }) {
  const paths =
    from === "center"
      ? [
          { d: "M150 0 C150 14 75 10 75 24", c: M.ours },
          { d: "M150 0 C150 14 225 10 225 24", c: M.theirs },
        ]
      : [
          { d: "M75 0 C75 14 150 10 150 24", c: M.ours },
          { d: "M225 0 C225 14 150 10 150 24", c: M.theirs },
        ];
  return (
    <svg viewBox="0 0 300 24" preserveAspectRatio="none" className="hidden h-7 w-full xl:block" aria-hidden="true">
      {paths.map((p, i) => (
        <motion.path
          key={i}
          d={p.d}
          fill="none"
          stroke={p.c}
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 0.85 }}
          transition={{ duration: 0.25, delay: reduce ? 0 : delay + i * 0.05 }}
        />
      ))}
    </svg>
  );
}

/** The resolved lines, marked by where they came from, plus what the choice drops. */
function Preview({ region, resolution }: { region: ConflictRegion; resolution: Resolution | undefined }) {
  const reduce = usePrefersReducedMotion();
  if (!resolution)
    return <p className="mt-3 rounded-lg border border-white/8 bg-white/[0.02] p-3 text-[12px] text-[#9a90ad]">Pick a strategy to preview the merged lines.</p>;
  const kept = resolveRegion(region, resolution);
  const origin = (k: number) => {
    if (resolution.strategy === "ours") return "ours";
    if (resolution.strategy === "theirs") return "theirs";
    if (resolution.strategy === "ours-theirs") return k < region.ours.length ? "ours" : "theirs";
    if (resolution.strategy === "theirs-ours") return k < region.theirs.length ? "theirs" : "ours";
    return "typed";
  };
  const dropped =
    resolution.strategy === "ours"
      ? region.theirs.map((t) => ({ t, from: "theirs" }))
      : resolution.strategy === "theirs"
        ? region.ours.map((t) => ({ t, from: "ours" }))
        : resolution.strategy === "edit"
          ? [...region.ours.filter((l) => !kept.includes(l)).map((t) => ({ t, from: "ours" })), ...region.theirs.filter((l) => !kept.includes(l)).map((t) => ({ t, from: "theirs" }))]
          : [];
  const color = (o: string) => (o === "ours" ? M.ours : o === "theirs" ? M.theirs : M.resolved);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={JSON.stringify(resolution)}
        initial={reduce ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease }}
        className="mt-3 overflow-hidden rounded-lg border border-white/8"
      >
        <p className="border-b border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-[#9a90ad]">Merged lines</p>
        <pre className="overflow-x-auto py-1.5 font-mono text-[11.5px] leading-[1.65]">
          {kept.length ? (
            kept.map((t, k) => (
              <div key={k} className="grid grid-cols-[4.2rem_1fr] pr-3">
                <span className="select-none px-2 text-[10px] leading-[1.9]" style={{ color: color(origin(k)) }}>
                  {origin(k)}
                </span>
                <span className="text-white">{t || " "}</span>
              </div>
            ))
          ) : (
            <p className="px-3 text-[#9a90ad]">No lines: the conflict resolves to nothing.</p>
          )}
        </pre>
        {dropped.length > 0 && (
          <details className="border-t border-white/8">
            <summary className="cursor-pointer px-3 py-1.5 text-[11px] text-[#9a90ad]">
              Dropped: {dropped.length} line{dropped.length > 1 ? "s" : ""}
            </summary>
            <pre className="overflow-x-auto pb-1.5 font-mono text-[11.5px] leading-[1.65]">
              {dropped.map((d, k) => (
                <div key={k} className="grid grid-cols-[4.2rem_1fr] pr-3">
                  <span className="select-none px-2 text-[10px] leading-[1.9]" style={{ color: color(d.from) }}>
                    {d.from}
                  </span>
                  <span className="text-[#9a90ad] line-through decoration-[#FF7A90]/60">{d.t || " "}</span>
                </div>
              ))}
            </pre>
          </details>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function ModifyDelete({ id }: { id: string }) {
  const { m, resolutions, resolve } = useMergeLab();
  const c = m.conflicts.find((x) => x.id === id)!;
  const r = resolutions[id];
  const keeper = c.deletedBy === "ours" ? "theirs" : "ours";
  return (
    <div className="hud p-5">
      <h2 className="text-[16px] font-semibold text-white">{c.path}</h2>
      <p className="mt-2 text-[13px] text-[#c9c0d8]">
        {c.deletedBy === "ours" ? "Our branch deleted this file" : "Their branch deleted this file"}, and the other branch changed it. Keep the changed file or delete it.
      </p>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => resolve(id, { strategy: keeper })} aria-pressed={r?.strategy === keeper} className="h-9 rounded-full border border-white/15 px-4 text-[12.5px] text-white aria-pressed:border-[#3DE0A6]">
          Keep the changed file
        </button>
        <button type="button" onClick={() => resolve(id, { strategy: c.deletedBy! })} aria-pressed={r?.strategy === c.deletedBy} className="h-9 rounded-full border border-white/15 px-4 text-[12.5px] text-white aria-pressed:border-[#3DE0A6]">
          Delete it
        </button>
      </div>
    </div>
  );
}
