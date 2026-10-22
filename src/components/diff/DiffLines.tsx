"use client";

import { useMemo, useState } from "react";
import { diffLines, hunkIds, type DiffLine } from "@/lib/git";

const tone = { add: "bg-add-bg text-add", del: "bg-del-bg text-del", same: "text-ink-2" };

/** Line diff between two texts, unified or split. Clicking a changed line reports it. */
export function DiffLines({
  before,
  after,
  mode,
  onLine,
  emptyText = "No differences.",
}: {
  before: string;
  after: string;
  mode: "unified" | "split";
  onLine?: (line: DiffLine) => void;
  emptyText?: string;
}) {
  const lines = useMemo(() => diffLines(before, after), [before, after]);
  const { ids } = useMemo(() => hunkIds(lines), [lines]);
  const [active, setActive] = useState<number | null>(null);
  if (!lines.some((l) => l.kind !== "same")) return <p className="px-4 py-6 text-[12.5px] text-ink-3">{emptyText}</p>;

  const click = (l: DiffLine, i: number) => {
    if (l.kind === "same") return;
    setActive(ids[i]);
    onLine?.(l);
  };

  if (mode === "split") {
    const side = (s: "a" | "b") =>
      lines
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => (s === "a" ? l.kind !== "add" : l.kind !== "del"))
        .map(({ l, i }) => (
          <div
            key={`${s}-${i}`}
            onClick={() => click(l, i)}
            className={`grid grid-cols-[2.4rem_1fr] font-mono text-[12px] leading-6 ${tone[l.kind]} ${l.kind !== "same" ? "cursor-pointer" : ""} ${
              ids[i] !== null && ids[i] === active ? "shadow-[inset_3px_0_0_var(--violet)]" : ""
            }`}
          >
            <span className="select-none pr-2 text-right text-ink-3/70">{s === "a" ? ("a" in l ? l.a : "") : "b" in l ? l.b : ""}</span>
            <span className="whitespace-pre-wrap break-all pr-3">{l.text || " "}</span>
          </div>
        ));
    return (
      <div className="grid grid-cols-2 divide-x divide-line">
        <div className="min-w-0">{side("a")}</div>
        <div className="min-w-0">{side("b")}</div>
      </div>
    );
  }

  return (
    <div>
      {lines.map((l, i) => (
        <div
          key={i}
          onClick={() => click(l, i)}
          className={`grid grid-cols-[2.4rem_2.4rem_1.2rem_1fr] font-mono text-[12px] leading-6 ${tone[l.kind]} ${l.kind !== "same" ? "cursor-pointer" : ""} ${
            ids[i] !== null && ids[i] === active ? "shadow-[inset_3px_0_0_var(--violet)]" : ""
          }`}
        >
          <span className="select-none pr-2 text-right text-ink-3/70">{"a" in l ? l.a : ""}</span>
          <span className="select-none pr-2 text-right text-ink-3/70">{"b" in l ? l.b : ""}</span>
          <span className="select-none text-center">{l.kind === "add" ? "+" : l.kind === "del" ? "−" : ""}</span>
          <span className="whitespace-pre-wrap break-all pr-3">{l.text || " "}</span>
        </div>
      ))}
    </div>
  );
}

export function ModeSwitch({ mode, setMode }: { mode: "unified" | "split"; setMode: (m: "unified" | "split") => void }) {
  return (
    <div className="flex rounded-lg border border-line-2 p-0.5" role="group" aria-label="Diff layout">
      {(["unified", "split"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className="h-6 rounded-md px-2 text-[11.5px] text-ink-3 aria-pressed:bg-ink aria-pressed:text-paper"
        >
          {m === "unified" ? "Unified" : "Split"}
        </button>
      ))}
    </div>
  );
}
