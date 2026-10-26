"use client";

import Link from "next/link";
import { StudioSwitch } from "@/components/site/StudioSwitch";
import { useEffect } from "react";

import { short } from "@/lib/git";
import { PrismMark } from "@/components/brand/PrismMark";
import { FIXTURE } from "@/features/impact-analysis/fixture";
import { M, MergeLabProvider, useMergeLab } from "./store";
import { Navigator } from "./Navigator";
import { ConflictView } from "./ConflictView";
import { FileView } from "./FileView";
import { SemanticView } from "./SemanticView";
import { ResultPanel } from "./ResultPanel";

export default function MergeLabApp() {
  return (
    <MergeLabProvider>
      <Workspace />
    </MergeLabProvider>
  );
}

function Workspace() {
  const { m, refs, selection, select, view, setView, resolve, undo } = useMergeLab();
  const path = selection.kind === "file" ? selection.path : m.conflicts.find((c) => c.id === selection.id)?.path ?? "";

  // j/k move between conflicts; o, t and b resolve the selected one; u undoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable=true]")) return;
      const i = selection.kind === "conflict" ? m.conflicts.findIndex((c) => c.id === selection.id) : -1;
      const conflict = selection.kind === "conflict" ? m.conflicts[i] : null;
      if (e.key === "j" || e.key === "k") {
        const n = m.conflicts.length;
        if (!n) return;
        const next = i < 0 ? 0 : (i + (e.key === "j" ? 1 : -1) + n) % n;
        select({ kind: "conflict", id: m.conflicts[next].id });
      } else if (conflict?.kind === "content" && (e.key === "o" || e.key === "t" || e.key === "b")) {
        resolve(conflict.id, { strategy: e.key === "o" ? "ours" : e.key === "t" ? "theirs" : "ours-theirs" });
      } else if (e.key === "u") undo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [m.conflicts, selection, select, resolve, undo]);

  return (
    <div className="studio flex min-h-[100dvh] flex-col gap-3 p-3 lg:h-[100dvh]">
      <header className="hud flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <Link href="/" aria-label="GitPrism home">
          <PrismMark className="h-6 w-6" />
        </Link>
        <div className="min-w-0">
          <p className="display text-[15px] leading-none text-white">MergeLab</p>
          <p className="mt-1 font-mono text-[11px] text-[#9a90ad]">
            {FIXTURE.owner}/{FIXTURE.repo} <span className="rounded border border-white/12 px-1 text-[10px]">fixture</span>
          </p>
        </div>
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11.5px]">
          <span className="rounded-full border px-2 py-0.5" style={{ borderColor: `${M.theirs}66`, color: M.theirs }} title={refs.theirsOid}>
            theirs {refs.theirs} {short(refs.theirsOid)}
          </span>
          <span className="text-[#9a90ad]">into</span>
          <span className="rounded-full border px-2 py-0.5" style={{ borderColor: `${M.ours}66`, color: M.ours }} title={refs.oursOid}>
            ours {refs.ours} {short(refs.oursOid)}
          </span>
          <span className="text-[#9a90ad]">
            base <span style={{ color: M.base }}>{short(refs.base)}</span>
          </span>
        </p>
        <div role="tablist" aria-label="View" className="flex rounded-xl border border-white/10 p-0.5">
          {(
            [
              ["line", "Line view"],
              ["semantic", "Semantic view"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className="h-8 shrink-0 whitespace-nowrap rounded-lg px-3 text-[12.5px] text-[#c9c0d8] transition-colors hover:text-white aria-selected:bg-[#3DE0A6]/20 aria-selected:text-white"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-[12px]">
          <span className="hidden items-center gap-1.5 text-[#9a90ad] xl:flex">
            <span className="kbd">j</span>
            <span className="kbd">k</span> conflicts <span className="kbd">o</span>
            <span className="kbd">t</span>
            <span className="kbd">b</span> resolve <span className="kbd">u</span> undo
          </span>
          <StudioSwitch current="mergelab" />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[250px_minmax(0,1fr)_340px] xl:grid-cols-[270px_minmax(0,1fr)_370px]">
        <div className="order-2 min-h-[360px] lg:order-1 lg:min-h-0 [&>nav]:h-full">
          <Navigator />
        </div>
        <main className="order-1 min-h-[520px] min-w-0 lg:order-2 lg:min-h-0">
          {view === "semantic" && path ? (
            <SemanticView path={path} />
          ) : selection.kind === "conflict" && selection.id ? (
            <ConflictView id={selection.id} />
          ) : selection.kind === "file" ? (
            <FileView path={selection.path} />
          ) : (
            <p className="hud p-5 text-[13px] text-[#c9c0d8]">These branches merge without conflicts.</p>
          )}
        </main>
        <div className="order-3 min-h-[420px] lg:min-h-0 [&>aside]:h-full">
          <ResultPanel />
        </div>
      </div>
    </div>
  );
}
