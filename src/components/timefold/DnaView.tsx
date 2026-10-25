"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { short } from "@/lib/git";
import { usePrefersReducedMotion } from "@/lib/theme";
import { C, EVENT_STYLE, useTimeFold } from "./store";
import { trackLines } from "./lines";

/** Function DNA: one function's life, commit by commit, with its code at the playhead. */
export function DnaView() {
  const { h, dna, index, preview, setIndex, relevant } = useTimeFold();
  const reduce = usePrefersReducedMotion();
  const [showChanges, setShowChanges] = useState(true);
  const lines = useMemo(() => trackLines(h, dna), [h, dna]);

  // Dragging previews the strand immediately; the code follows on release.
  const at = index;
  const entry = dna[at];
  const latest = dna.findLast((e) => e.fn)!;
  const name = (entry.fn ?? latest.fn)!.name;
  const rows = (lines.get(at) ?? []).filter((r) => showChanges || r.kind !== "del");
  const maxChurn = Math.max(1, ...relevant.map((i) => dna[i].added + dna[i].removed));
  const created = dna.find((e) => e.events.some((ev) => ev.kind === "created"));
  const deleted = dna.find((e) => e.events.some((ev) => ev.kind === "deleted"));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-[#9a90ad]">function DNA</p>
          <h2 className="display truncate text-[clamp(1.4rem,2.2vw,2rem)] text-white">{name}()</h2>
          <p className="mt-1 truncate font-mono text-[12px] text-[#9a90ad]">
            {(entry.fn ?? latest.fn)!.path} · ({(entry.fn ?? latest.fn)!.params})
          </p>
        </div>
        <p className="text-[12px] text-[#9a90ad]">
          Changed in <span className="text-white">{relevant.length}</span> of {dna.length} commits
        </p>
      </header>

      {/* The strand: every commit that changed this function, with its churn. */}
      <ol className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Commits that changed this function">
        {relevant.map((i) => {
          const e = dna[i];
          const c = h.snapshots[i].commit;
          const on = i === (preview ?? index);
          const kinds = [...new Set(e.events.map((ev) => ev.kind))];
          const churn = e.added + e.removed;
          return (
            <li key={c.oid} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-current={on ? "step" : undefined}
                className={`group flex w-[132px] flex-col gap-1.5 rounded-xl border p-2 text-left transition-colors ${
                  on ? "border-[#9D7BFF] bg-[#9D7BFF]/12" : "border-white/8 bg-white/[0.03] hover:border-white/20"
                }`}
              >
                <span className="flex h-6 items-end gap-0.5" aria-hidden="true">
                  <span className="w-1.5 rounded-sm" style={{ height: `${Math.max(8, (e.added / maxChurn) * 100)}%`, background: C.green, opacity: e.added ? 1 : 0.25 }} />
                  <span className="w-1.5 rounded-sm" style={{ height: `${Math.max(8, (e.removed / maxChurn) * 100)}%`, background: C.red, opacity: e.removed ? 1 : 0.25 }} />
                  <span className="ml-auto font-mono text-[10px] text-[#9a90ad]">{churn ? `±${churn}` : ""}</span>
                </span>
                <span className="font-mono text-[11px]" style={{ color: C.amber }}>
                  {short(c.oid)}
                </span>
                <span className="line-clamp-2 min-h-[2.4em] text-[11.5px] leading-tight text-[#c9c0d8]">{c.message}</span>
                <span className="flex flex-wrap gap-1">
                  {kinds.map((k) => (
                    <span key={k} className="rounded px-1 font-mono text-[9.5px]" style={{ color: EVENT_STYLE[k].color, background: `${EVENT_STYLE[k].color}1f` }}>
                      {EVENT_STYLE[k].label}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="hud flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-4 py-2.5">
          <p className="font-mono text-[12px] text-[#c9c0d8]">
            at <span style={{ color: C.amber }}>{short(h.snapshots[at].commit.oid)}</span>{" "}
            <span className="text-[#9a90ad]">{h.snapshots[at].commit.message}</span>
          </p>
          {entry.fn && (
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#c9c0d8]">
              <input type="checkbox" checked={showChanges} onChange={(e) => setShowChanges(e.target.checked)} className="accent-[#9D7BFF]" />
              Show removed lines
            </label>
          )}
        </div>

        {entry.events.length > 0 && (
          <ul className="flex flex-col gap-1 border-b border-white/8 px-4 py-2.5">
            {entry.events.map((ev, k) => (
              <motion.li
                key={`${at}-${k}`}
                initial={reduce ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: reduce ? 0 : k * 0.05 }}
                className="flex items-baseline gap-2 text-[12.5px] text-[#e7e1f2]"
              >
                <span className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] rounded-full" style={{ background: EVENT_STYLE[ev.kind].color }} aria-hidden="true" />
                <span className="sr-only">{EVENT_STYLE[ev.kind].label}: </span>
                {ev.text}
              </motion.li>
            ))}
          </ul>
        )}

        <div className="min-h-0 flex-1 overflow-auto py-2 font-mono text-[12.5px] leading-[1.7]">
          {entry.fn ? (
            <>
              {entry.events.length === 0 && (
                <p className="px-4 pb-2 font-sans text-[12px] text-[#9a90ad]">This commit didn&apos;t change {name}. Its code is shown as it stood here.</p>
              )}
              <AnimatePresence initial={false} mode="popLayout">
                {rows.map((r) => {
                  const changed = entry.events.length > 0;
                  const kind = changed ? r.kind : "same";
                  return (
                    <motion.div
                      key={r.key}
                      layout={reduce ? false : "position"}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="grid grid-cols-[3.2rem_1.2rem_1fr] pr-4"
                      style={{
                        background: kind === "add" ? "rgb(0 217 149 / 0.1)" : kind === "del" ? "rgb(255 0 122 / 0.1)" : undefined,
                      }}
                    >
                      <span className="select-none pr-2 text-right text-[#6f6782]">{r.line}</span>
                      <span className="select-none text-center" style={{ color: kind === "add" ? C.green : kind === "del" ? C.red : "transparent" }}>
                        {kind === "add" ? "+" : kind === "del" ? "−" : " "}
                        <span className="sr-only">{kind === "add" ? "added" : kind === "del" ? "removed" : ""}</span>
                      </span>
                      <span className={`whitespace-pre ${kind === "del" ? "text-[#ffb3c4] line-through decoration-[#ff7a90]/50" : "text-[#e7e1f2]"}`}>{r.text}</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </>
          ) : (
            <div className="grid h-full place-items-center p-6 text-center font-sans">
              <div className="max-w-sm">
                <p className="text-[14px] text-white">
                  {deleted && at >= deleted.index ? `${name} was deleted by this point.` : `${name} doesn't exist yet at this commit.`}
                </p>
                {created && at < created.index && (
                  <button type="button" onClick={() => setIndex(created.index)} className="mt-3 rounded-full border border-white/15 px-3 py-1.5 text-[12px] text-[#c9c0d8] hover:text-white">
                    Jump to {short(h.snapshots[created.index].commit.oid)}, where it was created
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
