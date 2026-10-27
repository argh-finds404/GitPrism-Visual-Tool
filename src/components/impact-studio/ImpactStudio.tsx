"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Crosshair, Expand, FolderTree, PanelLeftClose, PanelLeftOpen, PanelRightOpen, RotateCcw, ScanSearch, X } from "lucide-react";
import { usePrefersReducedMotion, useMediaQuery } from "@/lib/theme";
import { PrismMark } from "@/components/brand/PrismMark";
import { LENSES, project, type Projection } from "./lens-layouts";
import { StudioProvider, useStudio } from "./store";
import { LensDock, ReviewContext, Telemetry } from "./hud/TopZones";
import { ChangeExplorer } from "./hud/ChangeExplorer";
import { ImpactInspector } from "./hud/ImpactInspector";
import { ChronosDeck } from "./hud/ChronosDeck";
import { AgentHub, ContextPackager } from "./hud/AgentHub";
import { Scene2D } from "./scene/Scene2D";
import type { SceneProps } from "./scene/ImpactScene";

const ImpactScene = dynamic(() => import("./scene/ImpactScene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <PrismMark className="h-10 w-10 animate-pulse" />
    </div>
  ),
});

export default function ImpactStudio() {
  return (
    <StudioProvider>
      <Shell />
    </StudioProvider>
  );
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
};

function Shell() {
  const s = useStudio();
  const reduce = usePrefersReducedMotion();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const wide = useMediaQuery("(min-width: 1280px)");
  const commandRef = useRef<HTMLInputElement>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"explorer" | "inspector" | "agent" | null>(null);
  const [prevSelected, setPrevSelected] = useState(s.selected);

  // On phones, selecting a node opens the inspector sheet.
  if (prevSelected !== s.selected) {
    setPrevSelected(s.selected);
    if (!desktop && s.selected && sheet !== "explorer") setSheet("inspector");
  }

  const projection: Projection | null = useMemo(() => {
    if (!s.result) return null;
    return project({
      result: s.result,
      lens: s.lens,
      selected: s.selected,
      depth: s.depth,
      layers: s.layers,
      context: s.context,
      chronos: { step: s.chronosStep, commits: s.range, base: s.history.base },
      highlight: s.highlight?.ids ?? null,
    });
  }, [s.result, s.lens, s.selected, s.depth, s.layers, s.context, s.chronosStep, s.range, s.history, s.highlight]);

  // Keyboard: 1–5 lenses, [ and ] panels, Esc, Ctrl/⌘K commands, F focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        commandRef.current?.focus();
        return;
      }
      if (isTyping(e.target) || document.querySelector("dialog[open]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[1-5]$/.test(e.key)) s.setLens(Number(e.key) as 1 | 2 | 3 | 4 | 5);
      else if (e.key === "[") s.setExplorerOpen(!s.explorerOpen);
      else if (e.key === "]") s.setInspectorOpen(!s.inspectorOpen);
      else if (e.key.toLowerCase() === "f" && s.selected) s.requestFocus();
      else if (e.key === "Escape") {
        if (sheet) setSheet(null);
        else if (s.agentOpen) s.setAgentOpen(false);
        else if (s.highlight) s.setHighlight(null);
        else if (s.selected) s.select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s, sheet]);

  const lens = LENSES.find((l) => l.id === s.lens)!;
  const sceneProps: SceneProps | null =
    projection && s.result
      ? {
          projection,
          result: s.result,
          hovered: s.hovered,
          reduced: reduce,
          lensKey: lens.key,
          focusId: s.selected,
          focusTick: s.focusTick,
          fitTick: s.fitTick,
          resetTick: s.resetTick,
          onSelect: (id) => s.select(id, { focus: false }),
          onToggleContext: (id) => {
            s.toggleContext(id);
            if (s.lens !== 4) s.notify("Added to the review context. Open lens 4 to see it.");
          },
          onHover: s.setHovered,
          onFocusCluster: (id) => {
            const r = s.result!;
            const n = r.nodes.find((x) => x.id === id);
            const fileId = n?.kind === "file" ? id : n?.fileId;
            const ids = new Set([id, ...r.nodes.filter((x) => x.fileId === fileId || x.id === fileId).map((x) => x.id)]);
            r.edges.forEach((e) => (ids.has(e.source) ? ids.add(e.target) : ids.has(e.target) ? ids.add(e.source) : null));
            s.setHighlight({ ids, label: `Neighbourhood of ${n?.name}` });
            s.select(id);
          },
          onFps: s.showFps ? setFps : undefined,
          insets: desktop ? { left: s.explorerOpen ? (wide ? 360 : 320) : 0, right: s.inspectorOpen || s.agentOpen ? (wide ? 400 : 360) : 0 } : undefined,
        }
      : null;

  const scene = (
    <div className="absolute inset-0">
      {sceneProps ? (
        s.view3d ? (
          <ImpactScene {...sceneProps} />
        ) : (
          <Scene2D {...sceneProps} />
        )
      ) : (
        <div className="grid h-full place-items-center text-center text-[13px] text-[#9a90ad]">
          <div>
            <PrismMark className="mx-auto h-10 w-10 animate-pulse" />
            <p className="mt-3">{s.status === "error" ? s.error : s.stageLabel ?? "Preparing analysis"}</p>
            {s.status === "error" && (
              <button type="button" onClick={s.runAnalysis} className="mt-3 h-8 rounded-lg bg-[#7C3AED] px-3 text-[12px] text-white">
                Try again
              </button>
            )}
          </div>
        </div>
      )}
      {/* Vignette keeps HUD text readable over bright nodes. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(16_14_22/0.7))]" />
    </div>
  );

  const highlightChip = s.highlight && (
    <div className="hud flex items-center gap-2 py-1 pl-3 pr-1 text-[11.5px]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#FF007A]" />
      <span className="max-w-[18rem] truncate">{s.highlight.label}</span>
      <button type="button" onClick={() => s.setHighlight(null)} aria-label="Clear highlight" className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/10">
        <X size={12} />
      </button>
    </div>
  );

  const camera = (
    <div className="hud flex flex-col gap-0.5 p-1" role="group" aria-label="Camera">
      <CamButton label="Focus selected (F)" onClick={s.requestFocus} disabled={!s.selected}>
        <Crosshair size={14} />
      </CamButton>
      <CamButton label="Fit all" onClick={s.requestFit}>
        <Expand size={14} />
      </CamButton>
      <CamButton label="Reset camera" onClick={s.requestReset}>
        <RotateCcw size={14} />
      </CamButton>
    </div>
  );

  if (!desktop) {
    return (
      <main className="studio relative h-[100dvh] overflow-hidden" aria-label="Impact Studio">
        {scene}
        <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-col gap-2">
          <div className="pointer-events-auto relative z-10">
            <ReviewContext compact />
          </div>
          <div className="pointer-events-auto">
            <LensDock />
          </div>
          {highlightChip && <div className="pointer-events-auto self-start">{highlightChip}</div>}
        </div>
        <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-2">
          <div className="flex items-end justify-between">
            <div className="hud flex gap-0.5 p-1">
              <CamButton label="Explorer" onClick={() => setSheet("explorer")}>
                <FolderTree size={15} />
              </CamButton>
              <CamButton label="Inspector" onClick={() => setSheet("inspector")}>
                <ScanSearch size={15} />
              </CamButton>
              <CamButton label="Agent Hub" onClick={() => setSheet("agent")}>
                <Bot size={15} />
              </CamButton>
            </div>
            <div className="flex gap-1">{camera}</div>
          </div>
          <ChronosDeck commandRef={commandRef} compact />
        </div>
        {sheet && (
          <div className="absolute inset-x-2 bottom-2 top-[22%] z-30">
            {sheet === "explorer" && <ChangeExplorer />}
            {sheet === "inspector" && <ImpactInspector onClose={() => setSheet(null)} />}
            {sheet === "agent" && <AgentHub />}
            {sheet === "explorer" && (
              <button type="button" onClick={() => setSheet(null)} aria-label="Close explorer" className="absolute right-2 top-1.5 grid h-7 w-7 place-items-center rounded-lg text-[#c9c0d8]">
                <X size={15} />
              </button>
            )}
          </div>
        )}
        <Toast />
        <ContextPackager />
      </main>
    );
  }

  return (
    <main className="studio relative h-[100dvh] overflow-hidden" aria-label="Impact Studio">
      {scene}

      {/* Zone A + D */}
      <div className="pointer-events-none absolute bottom-4 left-4 top-4 z-30 flex w-[300px] flex-col gap-3 xl:w-[340px]">
        {/* Above the explorer, so its popovers aren't covered (each HUD panel is its own stacking context). */}
        <div className="pointer-events-auto relative z-10">
          <ReviewContext />
        </div>
        {s.explorerOpen ? (
          <div className="pointer-events-auto relative min-h-0 flex-1">
            <ChangeExplorer />
            <button type="button" onClick={() => s.setExplorerOpen(false)} aria-label="Collapse explorer ([)" title="Collapse explorer ([)" className="absolute right-9 top-1.5 grid h-6 w-6 place-items-center rounded text-[#9a90ad] hover:text-white">
              <PanelLeftClose size={14} />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => s.setExplorerOpen(true)} className="hud pointer-events-auto flex items-center gap-2 self-start px-3 py-2 text-[12px]">
            <PanelLeftOpen size={14} /> Change explorer <span className="kbd">[</span>
          </button>
        )}
      </div>

      {/* Zone B, lens caption and highlight */}
      <div className="pointer-events-none absolute left-[328px] right-[368px] top-4 z-30 flex flex-col items-center gap-2 xl:left-[372px] xl:right-[412px]">
        <div className="pointer-events-auto max-w-full">
          <LensDock />
        </div>
        <p className="hidden text-center text-[11.5px] text-[#9a90ad] xl:block">
          <span style={{ color: lens.color }}>{lens.label}</span>: {lens.purpose}
          {s.lens === 2 && " · potential impact, not confirmed breakage"}
          {s.lens === 4 && " · shift-click nodes to add or remove"}
        </p>
        {highlightChip && <div className="pointer-events-auto">{highlightChip}</div>}
      </div>

      {/* Zone C + E */}
      <div className="pointer-events-none absolute bottom-4 right-4 top-4 z-30 flex w-[340px] flex-col gap-3 xl:w-[380px]">
        <div className="pointer-events-auto relative z-10 self-end">
          <Telemetry projection={projection} fps={fps} />
        </div>
        {s.agentOpen ? (
          <div className="pointer-events-auto min-h-0 flex-1">
            <AgentHub />
          </div>
        ) : s.inspectorOpen ? (
          <div className="pointer-events-auto relative min-h-0 flex-1">
            <ImpactInspector onClose={() => s.setInspectorOpen(false)} />
          </div>
        ) : (
          <button type="button" onClick={() => s.setInspectorOpen(true)} className="hud pointer-events-auto flex items-center gap-2 self-end px-3 py-2 text-[12px]">
            <PanelRightOpen size={14} /> Impact inspector <span className="kbd">]</span>
          </button>
        )}
      </div>

      {/* Zone F + camera */}
      <div className="pointer-events-none absolute bottom-4 left-[328px] right-[368px] z-30 flex items-end gap-3 xl:left-[372px] xl:right-[412px]">
        <div className="pointer-events-auto mx-auto w-full max-w-[760px]">
          <ChronosDeck commandRef={commandRef} />
        </div>
        <div className="pointer-events-auto">{camera}</div>
      </div>

      <Legend />
      <Toast />
      <ContextPackager />
    </main>
  );
}

function CamButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="grid h-8 w-8 place-items-center rounded-lg text-[#c9c0d8] hover:bg-white/10 hover:text-white disabled:opacity-30">
      {children}
    </button>
  );
}

function Legend() {
  const s = useStudio();
  const items =
    s.lens === 3
      ? [
          { c: "#00D995", t: "Allowed import" },
          { c: "#FF3B5C", t: "Rule violation or cycle" },
          { c: "#FFB800", t: "Unclassified file" },
        ]
      : [
          { c: "#FF007A", t: "Changed" },
          { c: "#00D995", t: "Added" },
          { c: "#00F0FF", t: "Import" },
          { c: "#9D7BFF", t: "Call" },
          { c: "#41B27F", t: "Test link (dashed)" },
        ];
  return (
    <ul className="pointer-events-none absolute bottom-[10.5rem] left-[372px] z-20 hidden gap-3 text-[10.5px] text-[#9a90ad] 2xl:flex" aria-label="Legend">
      {items.map((i) => (
        <li key={i.t} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: i.c }} />
          {i.t}
        </li>
      ))}
    </ul>
  );
}

function Toast() {
  const { toast } = useStudio();
  if (!toast) return null;
  return (
    <p role="status" className="hud fixed left-1/2 top-24 z-50 max-w-[90vw] -translate-x-1/2 px-4 py-2 text-[12px]">
      {toast}
    </p>
  );
}
