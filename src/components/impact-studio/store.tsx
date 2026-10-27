"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { analyze } from "@/features/impact-analysis/analysis-service";
import { defaultItems } from "@/features/impact-analysis/context-packager";
import { fixtureHistory, LAYER_CONFIG, type FixtureCommit } from "@/features/impact-analysis/fixture";
import type { AnalysisResult } from "@/features/impact-analysis/types";
import { defaultCenter, type LensId } from "./lens-layouts";

// Interaction state for the Impact Studio. The analysis result is the only copy
// of repository truth; everything else here is selection, filters and layout.

export type AnalysisStatus = "idle" | "analyzing" | "ready" | "stale" | "error";
export type InspectorTab = "impact" | "calls" | "tests" | "source" | "evidence";

type Studio = {
  history: { base: FixtureCommit; commits: FixtureCommit[] };
  headOid: string;
  setHeadOid: (oid: string) => void;
  status: AnalysisStatus;
  stageLabel: string | null;
  error: string | null;
  result: AnalysisResult | null;
  runAnalysis: () => void;

  lens: LensId;
  setLens: (l: LensId) => void;
  selected: string | null;
  select: (id: string | null, opts?: { focus?: boolean; tab?: InspectorTab }) => void;
  hovered: string | null;
  setHovered: (id: string | null) => void;
  /** Nodes emphasised by a command or finding, with what produced them. */
  highlight: { ids: Set<string>; label: string } | null;
  setHighlight: (h: { ids: Set<string>; label: string } | null) => void;
  focusTick: number;
  requestFocus: () => void;
  fitTick: number;
  requestFit: () => void;
  resetTick: number;
  requestReset: () => void;

  depth: number;
  setDepth: (d: number) => void;
  layers: { imports: boolean; calls: boolean; tests: boolean };
  setLayers: (l: Partial<Studio["layers"]>) => void;
  context: Set<string>;
  toggleContext: (id: string) => void;
  resetContext: () => void;
  /** PR commits from base up to the analyzed head, oldest first. Chronos scrubs only these. */
  range: FixtureCommit[];
  /** 0 = base, range.length = the analyzed head. */
  chronosStep: number;
  setChronosStep: (s: number) => void;

  inspectorTab: InspectorTab;
  setInspectorTab: (t: InspectorTab) => void;
  explorerOpen: boolean;
  setExplorerOpen: (o: boolean) => void;
  inspectorOpen: boolean;
  setInspectorOpen: (o: boolean) => void;
  agentOpen: boolean;
  setAgentOpen: (o: boolean) => void;
  packOpen: boolean;
  setPackOpen: (o: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (o: boolean) => void;
  view3d: boolean;
  setView3d: (v: boolean) => void;
  showFps: boolean;
  setShowFps: (v: boolean) => void;
  sourceCompare: boolean;
  setSourceCompare: (v: boolean) => void;
  /** Line to reveal in the Source tab. */
  sourceLine: number | null;
  setSourceLine: (l: number | null) => void;
  toast: string | null;
  notify: (m: string) => void;
};

const Ctx = createContext<Studio | null>(null);

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

/** A shared permalink can carry ?lens=2&node=<id>. The studio renders client-side only. */
function fromUrl() {
  const q = new URLSearchParams(window.location.search);
  const l = Number(q.get("lens"));
  return { lens: l >= 1 && l <= 5 ? (l as LensId) : null, node: q.get("node") };
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const history = useMemo(() => fixtureHistory(), []);
  const [headOid, setHeadOid] = useState(history.commits.at(-1)!.oid);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [running, setRunning] = useState(false);
  const [stageLabel, setStageLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [lens, setLens] = useState<LensId>(() => fromUrl().lens ?? 2);
  const [selected, setSelected] = useState<string | null>(() => fromUrl().node);
  const [hovered, setHovered] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<Studio["highlight"]>(null);
  const [focusTick, setFocusTick] = useState(0);
  const [fitTick, setFitTick] = useState(0);
  const [resetTick, setResetTick] = useState(0);
  const [depth, setDepth] = useState(3);
  const [layers, setLayersRaw] = useState({ imports: true, calls: true, tests: true });
  const [contextRaw, setContext] = useState<Set<string> | null>(null);
  // null means "at the analyzed head", so a re-analysis always lands on its new head.
  const [chronosRaw, setChronosRaw] = useState<number | null>(null);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("impact");
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [agentOpen, setAgentOpen] = useState(false);
  const [packOpen, setPackOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [view3d, setView3d] = useState(true);
  const [showFps, setShowFps] = useState(false);
  const [sourceCompare, setSourceCompare] = useState(false);
  const [sourceLine, setSourceLine] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status: AnalysisStatus = error ? "error" : running ? "analyzing" : !result ? "idle" : result.head !== headOid ? "stale" : "ready";

  const runAnalysis = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const head = history.commits.find((c) => c.oid === headOid);
      if (!head) throw new Error("The selected head commit isn't in this pull request.");
      // Each label shows while the pipeline actually runs; the timings reported are measured.
      setStageLabel("Resolving base and head");
      await nextFrame();
      setStageLabel("Parsing source and building the graph");
      await nextFrame();
      const r = analyze(history.base.files, head.files, { base: history.base.oid, head: head.oid, ...LAYER_CONFIG });
      setResult(r);
      setContext(null);
      setSelected((s) => (s && r.nodes.some((n) => n.id === s) ? s : defaultCenter(r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setRunning(false);
      setStageLabel(null);
    }
  }, [history, headOid]);

  // Analyse once on open.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void runAnalysis();
  }, [runAnalysis]);

  const context = useMemo(() => contextRaw ?? new Set(result ? defaultItems(result).map((i) => i.nodeId) : []), [contextRaw, result]);

  const range = useMemo(() => {
    const head = result?.head ?? headOid;
    const end = history.commits.findIndex((c) => c.oid === head);
    return history.commits.slice(0, end + 1);
  }, [history, result, headOid]);
  const chronosStep = chronosRaw === null ? range.length : Math.min(chronosRaw, range.length);
  const setChronosStep = useCallback((i: number) => setChronosRaw(i >= range.length ? null : Math.max(0, i)), [range.length]);

  const notify = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  const select = useCallback<Studio["select"]>((id, opts) => {
    setSelected(id);
    if (id) {
      setInspectorOpen(true);
      if (opts?.tab) setInspectorTab(opts.tab);
      if (opts?.focus !== false) setFocusTick((t) => t + 1);
    }
  }, []);

  const value = useMemo<Studio>(
    () => ({
      history,
      headOid,
      setHeadOid,
      status,
      stageLabel,
      error,
      result,
      runAnalysis: () => void runAnalysis(),
      lens,
      setLens: (l) => {
        setLens(l);
        setFitTick((t) => t + 1);
      },
      selected,
      select,
      hovered,
      setHovered,
      highlight,
      setHighlight,
      focusTick,
      requestFocus: () => setFocusTick((t) => t + 1),
      fitTick,
      requestFit: () => setFitTick((t) => t + 1),
      resetTick,
      requestReset: () => setResetTick((t) => t + 1),
      depth,
      setDepth,
      layers,
      setLayers: (l) => setLayersRaw((p) => ({ ...p, ...l })),
      context,
      toggleContext: (id) =>
        setContext(() => {
          const n = new Set(context);
          if (n.has(id)) n.delete(id);
          else n.add(id);
          return n;
        }),
      resetContext: () => setContext(null),
      range,
      chronosStep,
      setChronosStep,
      inspectorTab,
      setInspectorTab,
      explorerOpen,
      setExplorerOpen,
      inspectorOpen,
      setInspectorOpen,
      agentOpen,
      setAgentOpen,
      packOpen,
      setPackOpen,
      paletteOpen,
      setPaletteOpen,
      view3d,
      setView3d,
      showFps,
      setShowFps,
      sourceCompare,
      setSourceCompare,
      sourceLine,
      setSourceLine,
      toast,
      notify,
    }),
    [history, headOid, status, stageLabel, error, result, runAnalysis, lens, selected, select, hovered, highlight, focusTick, fitTick, resetTick, depth, layers, context, range, chronosStep, setChronosStep, inspectorTab, explorerOpen, inspectorOpen, agentOpen, packOpen, paletteOpen, view3d, showFps, sourceCompare, sourceLine, toast, notify],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudio() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStudio must be used inside <StudioProvider>");
  return c;
}
