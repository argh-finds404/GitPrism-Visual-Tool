"use client";

import Link from "next/link";
import { StudioSwitch } from "@/components/site/StudioSwitch";
import { useEffect } from "react";

import { PrismMark } from "@/components/brand/PrismMark";
import { FIXTURE } from "@/features/impact-analysis/fixture";
import { TimeFoldProvider, useTimeFold, type Mode } from "./store";
import { Timeline } from "./Timeline";
import { DnaView } from "./DnaView";
import { DriftGraph } from "./DriftGraph";
import { BisectView } from "./BisectView";
import { StoryDrawer } from "./StoryDrawer";
import { SymbolRail } from "./SymbolRail";

const MODES: { id: Mode; label: string; key: string }[] = [
  { id: "dna", label: "Function DNA", key: "1" },
  { id: "drift", label: "Architecture drift", key: "2" },
  { id: "bisect", label: "Regression hunt", key: "3" },
];

export default function TimeFoldApp() {
  return (
    <TimeFoldProvider>
      <Workspace />
    </TimeFoldProvider>
  );
}

function Workspace() {
  const { mode, setMode, index, setIndex, visible, relevant, playing, setPlaying } = useTimeFold();

  // Keyboard: ←/→ commits, [ and ] changes to the selected function, space plays, 1–3 switch modes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, select, textarea, [role=slider], [contenteditable=true]")) return;
      const move = (list: number[], dir: 1 | -1) => {
        const next = dir > 0 ? list.find((i) => i > index) : [...list].reverse().find((i) => i < index);
        if (next !== undefined) setIndex(next);
      };
      if (e.key === "ArrowRight") move(visible, 1);
      else if (e.key === "ArrowLeft") move(visible, -1);
      else if (e.key === "]") move(relevant, 1);
      else if (e.key === "[") move(relevant, -1);
      else if (e.key === " " && !t.closest("button, a")) setPlaying(!playing);
      else if (MODES.some((m) => m.key === e.key)) setMode(MODES.find((m) => m.key === e.key)!.id);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, visible, relevant, playing, setIndex, setPlaying, setMode]);

  return (
    <div className="studio flex min-h-[100dvh] flex-col gap-3 p-3 lg:h-[100dvh]">
      <header className="hud flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <Link href="/" className="flex items-center gap-2" aria-label="GitPrism home">
          <PrismMark className="h-6 w-6" />
        </Link>
        <div className="min-w-0">
          <p className="display text-[15px] leading-none text-white">TimeFold</p>
          <p className="mt-1 font-mono text-[11px] text-[#9a90ad]">
            {FIXTURE.owner}/{FIXTURE.repo} <span className="rounded border border-white/12 px-1 text-[10px]">fixture</span>
          </p>
        </div>
        <div role="tablist" aria-label="View" className="flex max-w-full overflow-x-auto rounded-xl border border-white/10 p-0.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className="flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[12.5px] text-[#c9c0d8] transition-colors hover:text-white aria-selected:bg-[#9D7BFF]/25 aria-selected:text-white"
            >
              {m.label}
              {/* .kbd sets display, so the responsive hide lives on a wrapper. */}
              <span className="hidden md:inline">
                <span className="kbd">{m.key}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-[12px]">
          <span className="hidden items-center gap-1.5 text-[#9a90ad] xl:flex">
            <span className="kbd">←</span>
            <span className="kbd">→</span> commits <span className="kbd">[</span>
            <span className="kbd">]</span> changes <span className="kbd">space</span> play
          </span>
          <StudioSwitch current="timefold" />
        </div>
      </header>

      <div className="order-3 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:order-2 lg:grid-cols-[230px_minmax(0,1fr)_300px] xl:grid-cols-[250px_minmax(0,1fr)_330px]">
        <div className="order-2 min-h-[320px] lg:order-1 lg:min-h-0 [&>nav]:h-full">
          <SymbolRail />
        </div>
        <main className="order-1 min-h-[560px] min-w-0 lg:order-2 lg:min-h-0" aria-live="off">
          {mode === "dna" && <DnaView />}
          {mode === "drift" && <DriftGraph />}
          {mode === "bisect" && <BisectView />}
        </main>
        <div className="order-3 min-h-[420px] lg:min-h-0 [&>aside]:h-full">
          <StoryDrawer />
        </div>
      </div>

      <div className="order-2 lg:order-3">
        <Timeline />
      </div>
    </div>
  );
}
