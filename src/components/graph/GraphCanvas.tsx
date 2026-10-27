"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import { Hand, Map as MapIcon, RotateCcw, X } from "lucide-react";
import { useRepository } from "@/features/repository/RepositoryProvider";
import { buildHistoryGraph, buildObjectGraph, buildRefractionGraph, branchOrder, type GNode, type Graph } from "@/lib/graph/build-graph";
import { Glyph, kindName, type GlyphKind } from "@/components/workbench/bits";
import { useWorkbench, type CanvasView } from "@/components/workbench/WorkbenchContext";
import { usePrefersReducedMotion } from "@/lib/theme";
import { FileEditor } from "@/components/explorer/FileEditor";
import { nodeTypes, type Emphasis, type ObjFlowNode } from "./nodes";

const LANE = ["#a48cff", "#68d9f5", "#4cc38a", "#f0b75a", "#f08ad6"];

const views: { id: Exclude<CanvasView, "editor">; label: string; hint: string }[] = [
  { id: "history", label: "History", hint: "Commits and the parents they point to" },
  { id: "objects", label: "Objects", hint: "One commit's tree and blobs" },
  { id: "refraction", label: "Refraction", hint: "History with the selected commit opened up" },
];

function useGraph(): Graph {
  const { state } = useRepository();
  const { view, focusCommit, branchFilter } = useWorkbench();
  return useMemo(() => {
    if (view === "objects") return focusCommit ? buildObjectGraph(state, focusCommit) : { nodes: [], edges: [] };
    if (view === "refraction") return buildRefractionGraph(state, focusCommit, { branches: branchFilter });
    return buildHistoryGraph(state, { branches: branchFilter });
  }, [state, view, focusCommit, branchFilter]);
}

function Canvas() {
  const repo = useRepository();
  const wb = useWorkbench();
  const reduce = usePrefersReducedMotion();
  const graph = useGraph();
  const flow = useReactFlow();
  const [drag, setDrag] = useState(false);
  const [minimap, setMinimap] = useState(false);
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>({});

  const lastEvent = repo.steps[repo.cursor].event;
  const fresh = useMemo(() => new Set(repo.cursor > 0 ? (lastEvent?.objects ?? []) : []), [lastEvent, repo.cursor]);

  // What to emphasise: the selection and its neighbours, or a traced path.
  const emphasis = useMemo(() => {
    const sel = wb.selection;
    const selId =
      sel?.kind === "object" ? sel.oid : sel?.kind === "branch" ? `ref:${sel.name}` : sel?.kind === "head" ? "HEAD" : null;
    const lit = new Set<string>();
    const pick = (n: GNode) => (n.oid ?? n.id) === selId || n.id === selId;
    if (wb.trace) {
      wb.trace.forEach((t) => lit.add(t));
    } else if (selId) {
      const ids = new Set(graph.nodes.filter(pick).map((n) => n.id));
      graph.edges.forEach((e) => {
        if (ids.has(e.source)) lit.add(e.target);
        if (ids.has(e.target)) lit.add(e.source);
      });
    }
    return { selId, lit, tracing: !!wb.trace };
  }, [wb.selection, wb.trace, graph]);

  const nodeOf = useCallback(
    (n: GNode): Emphasis => {
      const key = n.oid ?? n.id;
      if (emphasis.selId && (key === emphasis.selId || n.id === emphasis.selId)) return "selected";
      if (emphasis.lit.has(n.id) || (n.oid && emphasis.lit.has(n.oid))) return "lit";
      if (emphasis.tracing) return "dim";
      return "normal";
    },
    [emphasis],
  );

  const nodes: ObjFlowNode[] = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: "obj",
        position: moved[n.id] ?? { x: n.x, y: n.y },
        draggable: drag,
        ariaLabel: `${kindName[n.kind as GlyphKind]} ${n.sub ?? ""} ${n.label}`.trim(),
        data: {
          kind: n.kind,
          label: n.kind === "tree" && n.label === "/" ? "root tree" : n.label,
          sub: n.sub,
          emphasis: nodeOf(n),
          current: n.current,
          fresh: !reduce && !!n.oid && fresh.has(n.oid),
        },
      })),
    [graph.nodes, moved, drag, nodeOf, fresh, reduce],
  );

  const edges: Edge[] = useMemo(() => {
    const idToOid = new Map(graph.nodes.map((n) => [n.id, n.oid ?? n.id]));
    return graph.edges.map((e) => {
      const a = idToOid.get(e.source)!;
      const b = idToOid.get(e.target)!;
      const isLit = emphasis.tracing
        ? emphasis.lit.has(a) && emphasis.lit.has(b)
        : !!emphasis.selId && (a === emphasis.selId || b === emphasis.selId || e.source === emphasis.selId || e.target === emphasis.selId);
      const base = e.kind === "parent" ? LANE[(e.lane ?? 0) % LANE.length] : e.kind === "ref" ? "#f0b75a" : "#6f6982";
      const color = isLit ? "#c4b3ff" : base;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: `s-${e.from}`,
        targetHandle: `t-${e.to}`,
        type: e.kind === "ref" ? "straight" : "default",
        label: e.kind === "entry" || e.kind === "tree" ? e.label : undefined,
        labelBgPadding: [4, 2] as [number, number],
        animated: isLit && !reduce,
        focusable: false,
        markerEnd: e.kind === "ref" ? undefined : { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
        style: {
          stroke: color,
          strokeWidth: e.kind === "parent" ? (isLit ? 3 : 2.2) : isLit ? 2 : 1.3,
          strokeDasharray: e.kind === "ref" ? "4 4" : undefined,
          opacity: emphasis.tracing && !isLit ? 0.2 : 1,
          filter: isLit ? "drop-shadow(0 0 4px #9579f5)" : undefined,
        },
      };
    });
  }, [graph, emphasis, reduce]);

  // Refit whenever the shape of the graph changes.
  // Refit when the graph's shape changes, once React Flow has measured the new nodes
  // (a fit before measurement ignores them). A fallback timer covers shape changes
  // that add no new nodes.
  const shape = `${wb.view}:${graph.nodes.length}:${wb.focusCommit}:${wb.branchFilter?.join(",")}`;
  const fitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingFit = useRef(true);
  const wrapper = useRef<HTMLDivElement>(null);
  const scheduleFit = useCallback(
    (delay: number) => {
      if (fitTimer.current) clearTimeout(fitTimer.current);
      fitTimer.current = setTimeout(() => {
        pendingFit.current = false;
        // On narrow screens keep labels readable and let people pan instead.
        const narrow = (wrapper.current?.clientWidth ?? 1000) < 640;
        flow.fitView({ padding: 0.2, duration: reduce ? 0 : 450, maxZoom: 1.25, minZoom: narrow ? 0.6 : 0.2 });
      }, delay);
    },
    [flow, reduce],
  );
  useEffect(() => {
    pendingFit.current = true;
    scheduleFit(250);
  }, [shape, scheduleFit]);
  useEffect(() => () => void (fitTimer.current && clearTimeout(fitTimer.current)), []);

  const onNodesChange = useCallback(
    (changes: NodeChange<ObjFlowNode>[]) => {
      const next: Record<string, { x: number; y: number }> = {};
      for (const c of changes) if (c.type === "position" && c.position) next[c.id] = c.position;
      if (Object.keys(next).length) setMoved((m) => ({ ...m, ...next }));
      if (pendingFit.current && changes.some((c) => c.type === "dimensions")) scheduleFit(40);
    },
    [scheduleFit],
  );

  const selectNode = (id: string) => {
    const n = graph.nodes.find((g) => g.id === id);
    if (!n) return;
    if (n.kind === "branch") wb.select({ kind: "branch", name: n.label });
    else if (n.kind === "head") wb.select({ kind: "head" });
    else if (n.oid) wb.select({ kind: "object", oid: n.oid });
    wb.setMobileView("inspect");
  };

  return (
    <div
      ref={wrapper}
      className="wb-canvas relative h-full w-full"
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const id = (e.target as HTMLElement).closest(".react-flow__node")?.getAttribute("data-id");
        if (id) {
          e.preventDefault();
          selectNode(id);
        }
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={(_, n) => selectNode(n.id)}
        onNodeDoubleClick={(_, n) => {
          const g = graph.nodes.find((x) => x.id === n.id);
          if (g?.kind === "commit" && g.oid) {
            wb.setFocusCommit(g.oid);
            wb.setView("refraction");
          }
        }}
        onPaneClick={() => wb.setTrace(null)}
        colorMode="dark"
        nodesConnectable={false}
        elementsSelectable={false}
        nodesFocusable
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
        fitView
      >
        <Background variant={BackgroundVariant.Lines} gap={28} color="#1c1730" bgColor="#0b0916" />
        <Controls showInteractive={false} position="bottom-right" />
        {minimap && (
          <MiniMap
            position="top-right"
            pannable
            zoomable
            nodeColor={(n) => {
              const k = (n.data as ObjFlowNode["data"]).kind;
              return k === "commit" ? "#a48cff" : k === "tree" ? "#4cc38a" : k === "blob" ? "#68d9f5" : "#f0b75a";
            }}
            maskColor="rgb(14 12 20 / 0.7)"
            style={{ marginTop: 56 }}
          />
        )}
      </ReactFlow>

      {/* Canvas tools */}
      <div className="pointer-events-none absolute inset-x-3 top-14 flex flex-wrap items-start justify-between gap-2">
        <BranchFilter />
        <div className="pointer-events-auto flex gap-1 rounded-xl border border-[#2a2342] bg-[#120e20]/90 p-1 backdrop-blur">
          <ToolButton label={drag ? "Lock node positions" : "Drag nodes"} pressed={drag} onClick={() => setDrag((d) => !d)}>
            <Hand size={15} />
          </ToolButton>
          <ToolButton
            label="Reset layout"
            onClick={() => {
              setMoved({});
              setTimeout(() => flow.fitView({ padding: 0.18, duration: reduce ? 0 : 400 }), 20);
            }}
          >
            <RotateCcw size={15} />
          </ToolButton>
          <ToolButton label={minimap ? "Hide minimap" : "Show minimap"} pressed={minimap} onClick={() => setMinimap((m) => !m)}>
            <MapIcon size={15} />
          </ToolButton>
        </div>
      </div>

      <Legend />

      {wb.trace && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#4a3f7a] bg-[#221d36] py-1.5 pl-4 pr-1.5 text-[12px] text-[#e4ddff]">
          Tracing {wb.trace.length} linked object{wb.trace.length === 1 ? "" : "s"}
          <button
            type="button"
            onClick={() => wb.setTrace(null)}
            className="grid h-6 w-6 place-items-center rounded-full hover:bg-white/10"
            aria-label="Stop tracing"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {graph.nodes.length === 0 && (
        <div className="absolute inset-0 grid place-items-center text-center text-[13px] text-[#9a94ab]">
          <p className="max-w-xs">There&apos;s no commit to open yet. Stage a file and commit it to see its tree here.</p>
        </div>
      )}
    </div>
  );
}

function ToolButton({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className="grid h-7 w-7 place-items-center rounded-lg text-[#b9b3c8] hover:bg-white/10 hover:text-white aria-pressed:bg-[#3b2c74] aria-pressed:text-white"
    >
      {children}
    </button>
  );
}

function BranchFilter() {
  const { state } = useRepository();
  const wb = useWorkbench();
  if (wb.view === "objects") return <span />;
  const all = branchOrder(state);
  const active = wb.branchFilter;
  const toggle = (b: string) => {
    const cur = active ?? [];
    const next = cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b];
    wb.setBranchFilter(next.length ? next : null);
  };
  return (
    <div className="pointer-events-auto flex flex-wrap gap-1 rounded-xl border border-[#2a2342] bg-[#120e20]/90 p-1 backdrop-blur" role="group" aria-label="Filter branches">
      <button
        type="button"
        aria-pressed={!active}
        onClick={() => wb.setBranchFilter(null)}
        className="h-7 rounded-lg px-2.5 text-[11.5px] text-[#b9b3c8] hover:text-white aria-pressed:bg-[#3b2c74] aria-pressed:text-white"
      >
        All branches
      </button>
      {all.map((b, i) => (
        <button
          key={b}
          type="button"
          aria-pressed={!!active?.includes(b)}
          onClick={() => toggle(b)}
          className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 font-mono text-[11px] text-[#b9b3c8] hover:text-white aria-pressed:bg-[#3b2c74] aria-pressed:text-white"
        >
          <span className="h-[3px] w-3 rounded-full" style={{ background: LANE[i % LANE.length] }} aria-hidden="true" />
          {b}
        </button>
      ))}
    </div>
  );
}

function Legend() {
  const items: { kind: GlyphKind; text: string }[] = [
    { kind: "commit", text: "Commit" },
    { kind: "tree", text: "Tree" },
    { kind: "blob", text: "Blob" },
    { kind: "branch", text: "Reference" },
  ];
  return (
    <ul className="absolute bottom-4 left-4 hidden gap-3 rounded-xl border border-[#2a2342] bg-[#120e20]/90 px-3 py-2 text-[11px] text-[#b9b3c8] backdrop-blur sm:flex" aria-label="Legend">
      {items.map((i) => (
        <li key={i.kind} className="flex items-center gap-1.5">
          <Glyph kind={i.kind} size={11} />
          {i.text}
        </li>
      ))}
    </ul>
  );
}

/** The centre region: view tabs plus either the graph or the file editor. */
export function CanvasRegion({ trailing }: { trailing?: React.ReactNode }) {
  const wb = useWorkbench();
  const { state } = useRepository();
  const commit = wb.focusCommit ? state.objects[wb.focusCommit] : null;

  return (
    <section aria-label="Repository canvas" className="night relative flex h-full min-h-0 flex-col bg-[#0b0916]">
      <div className="z-10 flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-[#231d3a] bg-[#0e0b19] px-2" role="tablist" aria-label="Canvas view">
        {views.map((v) => (
          <button
            key={v.id}
            role="tab"
            type="button"
            aria-selected={wb.view === v.id}
            title={v.hint}
            onClick={() => wb.setView(v.id)}
            className="h-8 shrink-0 rounded-lg px-3 text-[12.5px] text-[#b9b3c8] transition-colors hover:text-white aria-selected:bg-[#2a2150] aria-selected:text-white"
          >
            {v.label}
          </button>
        ))}
        {wb.openFile && (
          <span
            className={`ml-1 flex h-8 shrink-0 items-center rounded-lg pl-3 pr-1 font-mono text-[12px] ${
              wb.view === "editor" ? "bg-[#2a2150] text-white" : "text-[#b9b3c8]"
            }`}
          >
            <button type="button" role="tab" aria-selected={wb.view === "editor"} onClick={() => wb.setView("editor")} className="hover:text-white">
              {wb.openFile.split("/").pop()}
            </button>
            <button type="button" onClick={wb.closeFile} aria-label={`Close ${wb.openFile}`} className="ml-1 grid h-6 w-6 place-items-center rounded hover:bg-white/10">
              <X size={12} />
            </button>
          </span>
        )}
        {(wb.view === "objects" || wb.view === "refraction") && commit?.type === "commit" && (
          <span className="ml-auto hidden shrink-0 truncate pl-3 text-[11.5px] text-[#9a94ab] md:block">
            Opened: <span className="font-mono text-[#cfcadb]">{commit.oid.slice(0, 7)}</span> {commit.message}
          </span>
        )}
        {trailing && <div className="ml-auto shrink-0 pl-2">{trailing}</div>}
      </div>
      <div className="relative min-h-0 flex-1">
        {wb.view === "editor" && wb.openFile ? (
          <FileEditor path={wb.openFile} />
        ) : (
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
        )}
      </div>
    </section>
  );
}

