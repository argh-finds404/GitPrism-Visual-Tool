"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeftRight, ChevronDown, ChevronUp } from "lucide-react";
import { Chapter } from "@/components/ui/Chapter";
import { useLab, type Snapshot } from "@/components/lab/LabProvider";
import { diffLines, hunkIds, short, type DiffLine } from "@/lib/git";

function SnapshotPicker({
  label,
  value,
  onChange,
  snapshots,
}: {
  label: string;
  value: string;
  onChange: (oid: string) => void;
  snapshots: Snapshot[];
}) {
  const id = `pick-${label}`;
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className="mb-1.5 block text-[0.8rem] text-ink-3">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full appearance-none truncate rounded-xl border border-line-2 bg-surface pl-3 pr-9 text-[0.9rem] text-ink focus:border-violet focus:outline-none"
        >
          {snapshots.map((s) => (
            <option key={s.oid} value={s.oid}>
              {short(s.oid)} {s.message}
            </option>
          ))}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />
      </div>
    </div>
  );
}

const rowTone = {
  add: "bg-add-bg text-add",
  del: "bg-del-bg text-del",
  same: "text-ink-2",
};

function Line({ line, active, hunk }: { line: DiffLine; active: boolean; hunk: number | null }) {
  const sign = line.kind === "add" ? "+" : line.kind === "del" ? "−" : " ";
  return (
    <motion.div
      layout="position"
      data-hunk={hunk ?? undefined}
      initial={{ opacity: 0, x: line.kind === "add" ? 10 : line.kind === "del" ? -10 : 0 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`grid grid-cols-[2.6rem_2.6rem_1.4rem_1fr] font-mono text-[0.84rem] leading-7 transition-shadow ${rowTone[line.kind]} ${
        active ? "shadow-[inset_3px_0_0_var(--violet)]" : ""
      }`}
    >
      <span className="select-none pr-2 text-right text-ink-3/80">{"a" in line ? line.a : ""}</span>
      <span className="select-none pr-2 text-right text-ink-3/80">{"b" in line ? line.b : ""}</span>
      <span className="select-none text-center">{sign}</span>
      <span className="whitespace-pre-wrap break-all pr-4">{line.text || " "}</span>
    </motion.div>
  );
}

function SplitSide({ lines, side }: { lines: DiffLine[]; side: "a" | "b" }) {
  const rows = lines.filter((l) => (side === "a" ? l.kind !== "add" : l.kind !== "del"));
  return (
    <div className="min-w-0">
      {rows.map((l) => {
        const n = side === "a" ? ("a" in l ? l.a : "") : "b" in l ? l.b : "";
        return (
          <motion.div
            key={`${side}-${l.kind}-${n}-${l.text}`}
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`grid grid-cols-[2.6rem_1fr] font-mono text-[0.84rem] leading-7 ${rowTone[l.kind]}`}
          >
            <span className="select-none pr-2 text-right text-ink-3/80">{n}</span>
            <span className="whitespace-pre-wrap break-all pr-3">{l.text || " "}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

export function DiffView() {
  const { snapshots, compare, setCompare } = useLab();
  const [view, setView] = useState<"unified" | "split">("unified");
  const [hunkState, setHunkState] = useState({ pair: "", n: 0 });
  const box = useRef<HTMLDivElement>(null);

  const from = snapshots.find((s) => s.oid === compare.from) ?? snapshots[0];
  const to = snapshots.find((s) => s.oid === compare.to) ?? snapshots[snapshots.length - 1];

  const lines = useMemo(() => diffLines(from.content, to.content), [from.content, to.content]);
  const { ids, count } = useMemo(() => hunkIds(lines), [lines]);
  const added = lines.filter((l) => l.kind === "add").length;
  const removed = lines.filter((l) => l.kind === "del").length;

  // The selected change resets whenever a different pair of snapshots is compared.
  const pair = `${from.oid}:${to.oid}`;
  const activeHunk = hunkState.pair === pair ? Math.min(hunkState.n, Math.max(0, count - 1)) : 0;
  const setActiveHunk = (n: number) => setHunkState({ pair, n });

  const goHunk = (dir: 1 | -1) => {
    if (!count) return;
    const next = (activeHunk + dir + count) % count;
    setActiveHunk(next);
    const el = box.current?.querySelector(`[data-hunk="${next}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <section id="diff" aria-labelledby="diff-title" className="relative border-t border-line py-28 md:py-36">
      <div className="shell grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Chapter n={4} name="the difference" id="diff-title" title="A diff compares two states.">
            <p>
              Git didn&apos;t store these changes. It stored both versions whole. The comparison you see here is
              calculated when you ask for it.
            </p>
          </Chapter>

          <dl className="mt-10 space-y-4 border-t border-line pt-6 text-[0.88rem]">
            <div>
              <dt className="text-ink-3">Before, stored as</dt>
              <dd className="mt-0.5 break-all font-mono text-[0.8rem] text-ink">blob {from.blob}</dd>
            </div>
            <div>
              <dt className="text-ink-3">After, stored as</dt>
              <dd className="mt-0.5 break-all font-mono text-[0.8rem] text-ink">blob {to.blob}</dd>
            </div>
          </dl>
          <p className="mt-6 text-[0.88rem] text-ink-3">
            Save more snapshots in the lab above and they&apos;ll appear here.
          </p>
        </div>

        <div className="lg:col-span-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <SnapshotPicker
              label="Before"
              value={from.oid}
              snapshots={snapshots}
              onChange={(oid) => setCompare({ from: oid, to: to.oid })}
            />
            <button
              type="button"
              onClick={() => setCompare({ from: to.oid, to: from.oid })}
              className="grid h-11 w-11 shrink-0 place-items-center self-center rounded-full border border-line-2 text-ink-2 transition-colors hover:border-violet hover:text-violet sm:self-end"
              aria-label="Swap before and after"
            >
              <ArrowLeftRight size={16} />
            </button>
            <SnapshotPicker
              label="After"
              value={to.oid}
              snapshots={snapshots}
              onChange={(oid) => setCompare({ from: from.oid, to: oid })}
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-line bg-surface shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="flex items-center gap-3 text-[0.85rem]">
                <span className="font-mono text-ink">hello.txt</span>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={`${added}-${removed}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="flex gap-2 font-mono text-[0.8rem]"
                  >
                    <span className="text-add">+{added}</span>
                    <span className="text-del">−{removed}</span>
                  </motion.span>
                </AnimatePresence>
                <span className="text-ink-3">
                  {count} change{count === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-full border border-line-2">
                  <button
                    type="button"
                    onClick={() => goHunk(-1)}
                    disabled={!count}
                    className="grid h-8 w-9 place-items-center text-ink-2 hover:text-violet disabled:opacity-40"
                    aria-label="Previous change"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <span className="px-1 font-mono text-[0.75rem] text-ink-3">
                    {count ? activeHunk + 1 : 0}/{count}
                  </span>
                  <button
                    type="button"
                    onClick={() => goHunk(1)}
                    disabled={!count}
                    className="grid h-8 w-9 place-items-center text-ink-2 hover:text-violet disabled:opacity-40"
                    aria-label="Next change"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
                <div className="flex gap-1" role="group" aria-label="Diff layout">
                  {(["unified", "split"] as const).map((v) => (
                    <button key={v} type="button" className="chip h-8" aria-pressed={view === v} onClick={() => setView(v)}>
                      {v === "unified" ? "Unified" : "Split"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div ref={box} className="max-h-[440px] min-h-[240px] overflow-auto py-2">
              {from.oid === to.oid ? (
                <p className="px-5 py-10 text-[0.92rem] text-ink-3">
                  You&apos;re comparing a snapshot with itself. Pick a different one for Before or After.
                </p>
              ) : added + removed === 0 ? (
                <p className="px-5 py-10 text-[0.92rem] text-ink-3">
                  Same content, same blob. These two commits point to the identical object.
                </p>
              ) : view === "unified" ? (
                <AnimatePresence initial={false} mode="popLayout">
                  {lines.map((l, i) => (
                    <div
                      key={`${l.kind}-${"a" in l ? l.a : ""}-${"b" in l ? l.b : ""}-${l.text}`}
                      onClick={() => ids[i] !== null && setActiveHunk(ids[i]!)}
                      className={ids[i] !== null ? "cursor-pointer" : ""}
                    >
                      <Line line={l} hunk={ids[i]} active={ids[i] === activeHunk} />
                    </div>
                  ))}
                </AnimatePresence>
              ) : (
                <div className="grid grid-cols-2 divide-x divide-line">
                  <SplitSide lines={lines} side="a" />
                  <SplitSide lines={lines} side="b" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
