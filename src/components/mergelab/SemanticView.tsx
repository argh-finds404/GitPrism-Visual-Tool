"use client";

import { useMemo } from "react";
import { semanticChanges, type SemanticChange, type SemanticKind } from "@/features/mergelab/semantic";
import { M, useMergeLab } from "./store";

const KIND: Record<SemanticKind, { label: string; color: string }> = {
  signature: { label: "Signature change", color: "#FF5CB8" },
  logic: { label: "Logic change", color: "#9D7BFF" },
  import: { label: "Dependency change", color: "#3EE0FF" },
  added: { label: "Function added", color: "#3DE0A6" },
  removed: { label: "Function removed", color: "#FF7A90" },
  renamed: { label: "Rename", color: "#FFC15C" },
  test: { label: "Test change", color: "#3DE0A6" },
  other: { label: "Other declarations", color: "#C9C0D8" },
  unmatched: { label: "Unmatched", color: "#FFC15C" },
};

/** Each branch's changes to one file, grouped by the code structure they belong to. */
export function SemanticView({ path }: { path: string }) {
  const { sides, refs, m, select } = useMergeLab();
  const ours = useMemo(() => semanticChanges(path, sides.base[path], sides.ours[path], sides.ours), [path, sides]);
  const theirs = useMemo(() => semanticChanges(path, sides.base[path], sides.theirs[path], sides.theirs), [path, sides]);
  const fileConflicts = m.conflicts.filter((c) => c.path === path);

  if (!ours || !theirs)
    return (
      <div className="hud p-5 text-[13px] text-[#c9c0d8]">
        <p className="text-white">No structural view for {path.split("/").pop()}.</p>
        <p className="mt-1">GitPrism only parses TypeScript and JavaScript. For this file, the line view shows exactly what changed.</p>
      </div>
    );

  const both = new Set(ours.filter((c) => c.symbol && theirs.some((t) => t.symbol === c.symbol)).map((c) => c.symbol!));

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto pr-1">
      <header>
        <p className="font-mono text-[11px] text-[#9a90ad]">semantic diff lens</p>
        <h2 className="display text-[clamp(1.25rem,2vw,1.8rem)] text-white">{path.split("/").pop()}</h2>
        <p className="mt-1 max-w-[46rem] text-[12.5px] text-[#c9c0d8]">
          Each branch&apos;s changes against the merge base, grouped by the functions, imports and tests they touch. A function renamed with an identical body is matched;
          anything else that can&apos;t be matched is shown as a raw diff.
        </p>
        {fileConflicts.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-2 text-[12px]">
            {fileConflicts.map((c) => (
              <button key={c.id} type="button" onClick={() => select({ kind: "conflict", id: c.id })} className="rounded-full border border-[#FF7A90]/40 px-2.5 py-0.5 text-[#ffb3c0] hover:text-white">
                Conflict {c.n} in this file
              </button>
            ))}
          </p>
        )}
      </header>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Side title={`ours · ${refs.ours}`} color={M.ours} changes={ours} both={both} />
        <Side title={`theirs · ${refs.theirs}`} color={M.theirs} changes={theirs} both={both} />
      </div>
    </div>
  );
}

function Side({ title, color, changes, both }: { title: string; color: string; changes: SemanticChange[]; both: Set<string> }) {
  return (
    <section className="hud min-w-0 p-3" aria-label={title}>
      <p className="mb-2 flex items-center gap-2 font-mono text-[11.5px]" style={{ color }}>
        <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
        {title}
      </p>
      {changes.length === 0 && <p className="text-[12px] text-[#9a90ad]">No changes to this file.</p>}
      <ul className="space-y-2">
        {changes.map((c, k) => (
          <li key={k}>
            <details className="group rounded-lg border border-white/8 bg-white/[0.02]" open={c.kind === "signature" || c.kind === "unmatched"}>
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2 [&::-webkit-details-marker]:hidden">
                <span className="rounded px-1.5 font-mono text-[10px]" style={{ color: KIND[c.kind].color, background: `${KIND[c.kind].color}1f` }}>
                  {KIND[c.kind].label}
                </span>
                <span className="font-mono text-[12px] text-white">{c.title}</span>
                {c.symbol && both.has(c.symbol) && <span className="rounded-full border border-[#FF5CB8]/40 px-1.5 text-[10px] text-[#ff9fd3]">both branches</span>}
                {c.detail && <span className="w-full font-mono text-[11px] text-[#9a90ad]">{c.detail}</span>}
              </summary>
              <pre className="overflow-x-auto border-t border-white/8 py-1.5 font-mono text-[11.5px] leading-[1.6]">
                {c.diff.map((l, i) => (
                  <div
                    key={i}
                    className="px-3"
                    style={{
                      background: l.kind === "add" ? "rgb(0 217 149 / 0.1)" : l.kind === "del" ? "rgb(255 0 122 / 0.1)" : undefined,
                      color: l.kind === "add" ? "#bff5df" : l.kind === "del" ? "#ffc2d1" : "#9a90ad",
                    }}
                  >
                    {l.kind === "add" ? "+ " : l.kind === "del" ? "− " : "  "}
                    {l.text}
                  </div>
                ))}
              </pre>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
