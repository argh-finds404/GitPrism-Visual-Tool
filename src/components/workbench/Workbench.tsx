"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FolderTree, Lightbulb, ListTree, PanelLeftClose, PanelLeftOpen, Share2, ScanSearch, X } from "lucide-react";
import { RepositoryProvider, useRepository } from "@/features/repository/RepositoryProvider";
import { challenges } from "@/features/repository/challenges";
import type { RepositoryCommand } from "@/features/repository/types";
import { ExplorerPanel } from "@/components/explorer/ExplorerPanel";
import { CanvasRegion } from "@/components/graph/GraphCanvas";
import { PrismInspector } from "@/components/inspector/PrismInspector";
import { BottomPanel } from "@/components/timeline/BottomPanel";
import { PrismMark } from "@/components/brand/PrismMark";
import { Header } from "./Header";
import { useWorkbench, WorkbenchProvider, type MobileView } from "./WorkbenchContext";
import { useMediaQuery } from "@/lib/theme";

export function Workbench() {
  return (
    <RepositoryProvider>
      <WorkbenchProvider>
        <Shell />
      </WorkbenchProvider>
    </RepositoryProvider>
  );
}

/** Marks challenges complete from real state; never from button clicks alone. */
function useChallengeTracking() {
  const repo = useRepository();
  const wb = useWorkbench();
  const commands = useMemo(() => repo.steps.map((s) => s.command).filter(Boolean) as RepositoryCommand[], [repo.steps]);
  const selectedOid = wb.selection?.kind === "object" ? wb.selection.oid : null;
  const { complete, completed, replaying, state } = repo;
  useEffect(() => {
    if (replaying) return;
    for (const c of challenges) {
      if (!completed.includes(c.id) && c.done({ state, selectedOid, commands })) {
        complete(c.id);
        wb.notify(`Challenge complete: ${c.title}`, "info");
      }
    }
  }, [state, selectedOid, commands, completed, complete, replaying, wb]);
}

function Shell() {
  const repo = useRepository();
  const wb = useWorkbench();
  // Mount exactly one layout so the canvas, editor and 3D lens exist once.
  const desktop = useMediaQuery("(min-width: 1024px)");
  const wide = useMediaQuery("(min-width: 1280px)");
  useChallengeTracking();

  if (repo.status === "loading") {
    return (
      <div className="grid h-[100dvh] place-items-center bg-paper" role="status">
        <div className="flex flex-col items-center gap-3 text-[13px] text-ink-3">
          <PrismMark className="h-10 w-10 animate-pulse" />
          Opening your lab
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-paper text-ink">
      <Header />
      {repo.storageNote && (
        <p className="border-b border-line bg-del-bg px-4 py-1.5 text-[12px] text-del" role="status">
          {repo.storageNote}
        </p>
      )}

      {/* Desktop and laptop */}
      {desktop ? (
      <div className="flex min-h-0 flex-1">
        <aside
          className={`relative shrink-0 border-r border-line transition-[width] duration-300 ${wb.explorerOpen ? "w-[248px]" : "w-11"}`}
          aria-label="Explorer panel"
        >
          {wb.explorerOpen ? (
            <ExplorerPanel />
          ) : (
            <div className="flex flex-col items-center gap-1 pt-12">
              {(["files", "objects", "refs"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    wb.setExplorerTab(t);
                    wb.setExplorerOpen(true);
                  }}
                  title={t[0].toUpperCase() + t.slice(1)}
                  aria-label={`Open ${t}`}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-violet-wash hover:text-violet-ink"
                >
                  {t === "files" ? <FolderTree size={16} /> : t === "objects" ? <ListTree size={16} /> : <Share2 size={16} />}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => wb.setExplorerOpen(!wb.explorerOpen)}
            aria-label={wb.explorerOpen ? "Collapse explorer" : "Expand explorer"}
            aria-expanded={wb.explorerOpen}
            className={`absolute grid h-7 w-7 place-items-center rounded-lg text-ink-3 hover:bg-violet-wash hover:text-violet-ink ${
              wb.explorerOpen ? "bottom-2 right-2" : "left-2 top-2"
            }`}
          >
            {wb.explorerOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1">
            <div className="relative min-w-[420px] flex-1">
              <CanvasRegion
                trailing={
                  !wide &&
                  !wb.inspectorOpen && (
                    <button
                      type="button"
                      onClick={() => wb.setInspectorOpen(true)}
                      className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-[#cfcadb] hover:bg-white/10 hover:text-white"
                    >
                      <ScanSearch size={14} /> Inspector
                    </button>
                  )
                }
              />
              <GuidedOverlay />
            </div>
            {/* Inspector: a column on wide screens, a drawer on laptops. */}
            {wide && (
              <aside className="w-[330px] shrink-0 border-l border-line" aria-label="Inspector panel">
                <PrismInspector />
              </aside>
            )}
            <AnimatePresence>
              {!wide && wb.inspectorOpen && (
                <motion.aside
                  key="drawer"
                  initial={{ x: 340 }}
                  animate={{ x: 0 }}
                  exit={{ x: 340 }}
                  transition={{ type: "spring", stiffness: 300, damping: 32 }}
                  className="absolute inset-y-0 right-0 z-20 w-[330px] border-l border-line shadow-2xl"
                  aria-label="Inspector drawer"
                >
                  <button
                    type="button"
                    onClick={() => wb.setInspectorOpen(false)}
                    aria-label="Close inspector"
                    className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-lg bg-surface text-ink-3 hover:text-ink"
                  >
                    <X size={15} />
                  </button>
                  <PrismInspector />
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
          <div className={`shrink-0 transition-[height] duration-300 ${wb.bottomOpen ? "h-[260px]" : "h-10"}`}>
            <BottomPanel />
          </div>
        </div>
      </div>

      ) : (
      /* Phones and tablets: one view at a time */
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-0 flex-1">
          {wb.mobileView === "files" && <ExplorerPanel />}
          {wb.mobileView === "graph" && (
            <>
              <CanvasRegion />
              <GuidedOverlay />
            </>
          )}
          {wb.mobileView === "inspect" && <PrismInspector />}
          {wb.mobileView === "timeline" && <BottomPanel mobile />}
        </div>
        <MobileNav />
      </div>
      )}

      <Toast />
    </div>
  );
}

function MobileNav() {
  const wb = useWorkbench();
  const items: { id: MobileView; label: string; icon: React.ReactNode }[] = [
    { id: "files", label: "Explorer", icon: <FolderTree size={18} /> },
    { id: "graph", label: "Graph", icon: <Share2 size={18} /> },
    { id: "inspect", label: "Inspector", icon: <ScanSearch size={18} /> },
    { id: "timeline", label: "Timeline", icon: <ListTree size={18} /> },
  ];
  return (
    <nav aria-label="Workbench views" className="grid shrink-0 grid-cols-4 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          aria-current={wb.mobileView === i.id ? "page" : undefined}
          onClick={() => wb.setMobileView(i.id)}
          className="flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-ink-3 aria-[current=page]:text-violet-ink"
        >
          {i.icon}
          {i.label}
        </button>
      ))}
    </nav>
  );
}

function GuidedOverlay() {
  const repo = useRepository();
  const wb = useWorkbench();
  const [showHint, setShowHint] = useState(false);
  if (!wb.guided) return null;
  const next = challenges.find((c) => !repo.completed.includes(c.id));
  return (
    <div className="absolute bottom-16 left-3 z-10 w-[min(320px,calc(100%-1.5rem))] rounded-2xl border border-[#4a3f7a] bg-[#221d36]/95 p-3.5 text-[#ece9f5] shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-[#b6a0ff]">
          {next ? `Challenge ${challenges.indexOf(next) + 1} of ${challenges.length}` : "All challenges complete"}
        </p>
        <button type="button" onClick={() => wb.setGuided(false)} aria-label="Turn off guided mode" className="grid h-6 w-6 place-items-center rounded hover:bg-white/10">
          <X size={13} />
        </button>
      </div>
      {next ? (
        <>
          <p className="mt-1 text-[13.5px] font-medium leading-snug">{next.title}</p>
          {showHint ? (
            <p className="mt-2 text-[12px] leading-relaxed text-[#cfc6f5]">{next.hint}</p>
          ) : (
            <button type="button" onClick={() => setShowHint(true)} className="mt-2 flex items-center gap-1.5 text-[12px] text-[#b6a0ff] hover:underline">
              <Lightbulb size={12} /> Show a hint
            </button>
          )}
        </>
      ) : (
        <p className="mt-1 text-[12.5px] leading-relaxed text-[#cfc6f5]">You traced parents, found a blob, staged, committed and branched. Reset the lab any time to try again.</p>
      )}
    </div>
  );
}

function Toast() {
  const { toast } = useWorkbench();
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 lg:bottom-auto lg:top-16" aria-live="assertive">
      <AnimatePresence>
        {toast && (
          <motion.p
            key={toast.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`rounded-xl border px-4 py-2.5 text-[12.5px] shadow-xl ${
              toast.tone === "error" ? "border-del/40 bg-del-bg text-del" : "border-line bg-surface text-ink"
            }`}
          >
            {toast.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
