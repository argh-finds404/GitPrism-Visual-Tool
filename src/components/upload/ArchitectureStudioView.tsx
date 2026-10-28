"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Compass,
  FileCode2,
  Filter,
  Flame,
  FolderGit2,
  Link2Off,
  Network,
  Repeat,
  Search,
  ShieldCheck,
} from "lucide-react";
import { blastRadius, pathToCenter } from "@/features/impact-analysis/blast-radius";
import type { AnalysisResult, ImpactNode } from "@/features/impact-analysis/types";
import type { Collected } from "@/features/upload/collect";
import { LIMITS } from "@/features/upload/collect";
import type { ParsedGitRepo } from "@/features/upload/git-reader";
import { FindingBadge } from "@/components/impact-studio/hud/ui";
import { STUDIOS } from "@/components/site/studios";
import { SaveProject } from "./SaveProject";

type FilterMode = "all" | "hubs" | "cycles" | "untested" | "entrypoints";
type SortMode = "fanIn" | "fanOut" | "symbols" | "churn" | "path";

interface ModuleProfile {
  node: ImpactNode;
  path: string;
  folder: string;
  fanIn: number;
  fanOut: number;
  importers: { id: string; path: string; line: number; text: string }[];
  imports: { id: string; path: string; line: number; text: string }[];
  symbols: ImpactNode[];
  tests: ImpactNode[];
  inCycle: boolean;
  gitTouches: number;
  riskScore: number;
}

const LAYER_PALETTE = [
  "#8B5CF6", // Violet
  "#06B6D4", // Cyan
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EC4899", // Magenta
  "#6366F1", // Indigo
];

export function ArchitectureStudioView({
  name,
  picked,
  result,
  gitRepo,
  onOpenShare,
}: {
  name: string;
  picked: Collected;
  result: AnalysisResult;
  gitRepo?: ParsedGitRepo | null;
  onOpenShare: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("fanIn");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [inspectorSubTab, setInspectorSubTab] = useState<"blast" | "deps" | "symbols" | "source">("blast");
  const [blastDepth, setBlastDepth] = useState<number>(3);

  const files = useMemo(() => result.nodes.filter((n) => n.kind === "file"), [result.nodes]);
  const symbols = useMemo(() => result.nodes.filter((n) => n.kind === "symbol"), [result.nodes]);
  const tests = useMemo(() => result.nodes.filter((n) => n.kind === "test"), [result.nodes]);

  // Compute Git commit frequency per file path
  const gitChurnByPath = useMemo(() => {
    const map = new Map<string, number>();
    if (!gitRepo) return map;
    for (const commit of gitRepo.commits) {
      for (const d of commit.diffs ?? []) {
        const norm = d.path.replace(/^[/\\]+/, "");
        map.set(norm, (map.get(norm) ?? 0) + 1);
      }
    }
    return map;
  }, [gitRepo]);

  // Set of file node IDs participating in circular dependencies
  const cycleNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const cyc of result.cycles) {
      for (const id of cyc) set.add(id);
    }
    return set;
  }, [result.cycles]);

  // Comprehensive profile for every source module
  const modules = useMemo<ModuleProfile[]>(() => {
    const nodeById = new Map(result.nodes.map((n) => [n.id, n]));
    return files.map((fileNode) => {
      const importers = result.edges
        .filter((e) => e.kind === "imports" && e.target === fileNode.id)
        .map((e) => {
          const srcNode = nodeById.get(e.source);
          return {
            id: e.source,
            path: srcNode?.path ?? e.source.replace(/^file:/, ""),
            line: e.location.line,
            text: e.location.text,
          };
        });

      const imports = result.edges
        .filter((e) => e.kind === "imports" && e.source === fileNode.id)
        .map((e) => {
          const tgtNode = nodeById.get(e.target);
          return {
            id: e.target,
            path: tgtNode?.path ?? e.target.replace(/^file:/, ""),
            line: e.location.line,
            text: e.location.text,
          };
        });

      const fileSymbols = symbols.filter((s) => s.fileId === fileNode.id);
      const symbolIds = new Set(fileSymbols.map((s) => s.id));
      symbolIds.add(fileNode.id);

      const linkedTestIds = new Set<string>();
      for (const e of result.edges) {
        if (e.kind === "tests" && symbolIds.has(e.target)) {
          linkedTestIds.add(e.source);
        }
      }
      const fileTests = tests.filter((t) => linkedTestIds.has(t.id) || t.fileId === fileNode.id);

      const inCycle = cycleNodeIds.has(fileNode.id);
      const gitTouches = gitChurnByPath.get(fileNode.path) ?? 0;
      const parts = fileNode.path.split("/");
      const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "(root)";

      // Risk combines fan-in, cycle participation, git churn, and lack of test links
      const riskScore =
        importers.length * 12 +
        (inCycle ? 35 : 0) +
        gitTouches * 6 +
        (importers.length >= 2 && fileTests.length === 0 ? 15 : 0);

      return {
        node: fileNode,
        path: fileNode.path,
        folder,
        fanIn: importers.length,
        fanOut: imports.length,
        importers,
        imports,
        symbols: fileSymbols,
        tests: fileTests,
        inCycle,
        gitTouches,
        riskScore,
      };
    });
  }, [files, symbols, tests, result.nodes, result.edges, cycleNodeIds, gitChurnByPath]);

  const moduleById = useMemo(() => new Map(modules.map((m) => [m.node.id, m])), [modules]);

  // Filtered and sorted module list
  const filteredModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = modules.filter((m) => {
      if (filterMode === "hubs" && m.fanIn < 2) return false;
      if (filterMode === "cycles" && !m.inCycle) return false;
      if (filterMode === "untested" && (m.tests.length > 0 || m.fanIn === 0)) return false;
      if (filterMode === "entrypoints" && m.fanIn > 0) return false;
      if (!q) return true;
      return (
        m.path.toLowerCase().includes(q) ||
        m.symbols.some((s) => s.name.toLowerCase().includes(q))
      );
    });

    return list.sort((a, b) => {
      if (sortMode === "fanIn") return b.fanIn - a.fanIn || b.riskScore - a.riskScore;
      if (sortMode === "fanOut") return b.fanOut - a.fanOut;
      if (sortMode === "symbols") return b.symbols.length - a.symbols.length;
      if (sortMode === "churn") return b.gitTouches - a.gitTouches || b.fanIn - a.fanIn;
      return a.path.localeCompare(b.path);
    });
  }, [modules, searchQuery, filterMode, sortMode]);

  // Active selected module (default to top fan-in module)
  const activeModule = useMemo(() => {
    if (selectedFileId && moduleById.has(selectedFileId)) {
      return moduleById.get(selectedFileId)!;
    }
    if (filteredModules.length > 0) return filteredModules[0];
    return modules[0] ?? null;
  }, [selectedFileId, moduleById, filteredModules, modules]);

  // Compute live Blast Radius for the active module
  const activeBlast = useMemo(() => {
    if (!activeModule) return null;
    const rad = blastRadius(result, activeModule.node.id, blastDepth);
    const affectedModules: { module: ModuleProfile; distance: number; chain: string[] }[] = [];
    for (const [id, dist] of rad.distance.entries()) {
      if (dist === 0) continue;
      const mod = moduleById.get(id);
      if (mod) {
        const edgeChain = pathToCenter(rad, id).map((e) => e.source.replace(/^file:/, ""));
        affectedModules.push({ module: mod, distance: dist, chain: edgeChain });
      }
    }
    affectedModules.sort((a, b) => a.distance - b.distance || b.module.fanIn - a.module.fanIn);
    return {
      radius: rad,
      affectedModules,
      hop1: affectedModules.filter((x) => x.distance === 1),
      hop2: affectedModules.filter((x) => x.distance === 2),
      hop3Plus: affectedModules.filter((x) => x.distance >= 3),
    };
  }, [result, activeModule, blastDepth, moduleById]);

  // Interactive 2D SVG Dependency Graph layout (top N most connected modules for visual clarity)
  const graphData = useMemo(() => {
    const maxNodes = 28;
    const ranked = [...modules]
      .sort((a, b) => b.fanIn + b.fanOut - (a.fanIn + a.fanOut))
      .slice(0, maxNodes);

    if (activeModule && !ranked.some((m) => m.node.id === activeModule.node.id)) {
      ranked[ranked.length - 1] = activeModule;
    }

    const folderNames = Array.from(new Set(ranked.map((m) => m.folder))).sort();
    const folderColor = new Map(
      folderNames.map((f, i) => [f, LAYER_PALETTE[i % LAYER_PALETTE.length]])
    );

    // Group into columns by topological role: Entrypoints (fanIn=0) -> Mid-tier -> Core Hubs (high fanIn)
    const cols: ModuleProfile[][] = [[], [], [], []];
    for (const m of ranked) {
      if (m.fanIn === 0) cols[0].push(m);
      else if (m.fanIn === 1) cols[1].push(m);
      else if (m.fanIn <= 3) cols[2].push(m);
      else cols[3].push(m);
    }
    // Balance empty columns
    const nonEmptyCols = cols.filter((c) => c.length > 0);
    const width = 760;
    const height = Math.max(340, Math.max(...nonEmptyCols.map((c) => c.length), 1) * 52 + 60);

    const posMap = new Map<string, { x: number; y: number; color: string; mod: ModuleProfile }>();
    nonEmptyCols.forEach((col, cIdx) => {
      const x =
        nonEmptyCols.length === 1
          ? width / 2
          : 110 + (cIdx / (nonEmptyCols.length - 1)) * (width - 220);
      col.forEach((m, rIdx) => {
        const y = ((rIdx + 1) / (col.length + 1)) * (height - 40) + 20;
        posMap.set(m.node.id, {
          x,
          y,
          color: folderColor.get(m.folder) ?? "#8B5CF6",
          mod: m,
        });
      });
    });

    const visibleEdges = result.edges.filter(
      (e) => e.kind === "imports" && posMap.has(e.source) && posMap.has(e.target)
    );

    return {
      width,
      height,
      nodes: Array.from(posMap.values()),
      posMap,
      edges: visibleEdges,
      folders: folderNames.slice(0, 6).map((f) => ({
        name: f,
        color: folderColor.get(f) ?? "#8B5CF6",
      })),
    };
  }, [modules, activeModule, result.edges]);

  // Hotspots: cross-referencing Git churn with architectural fan-in
  const hotspots = useMemo(() => {
    return [...modules]
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 6);
  }, [modules]);

  const skippedTotal = Object.values(picked.skipped).reduce((a, b) => a + b, 0);
  const activeSource = activeModule ? result.headFiles[activeModule.path] ?? "" : "";

  return (
    <div className="space-y-6">
      {/* 1. Top Summary KPI Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <StatPill n={files.length} label="source files" />
          <StatPill n={symbols.length} label="functions" />
          <StatPill
            n={result.edges.filter((e) => e.kind === "imports").length}
            label="resolved imports"
          />
          <StatPill n={tests.length} label="test cases" />
          <StatPill
            n={result.cycles.length}
            label="import cycles"
            tone={result.cycles.length ? "warn" : "ok"}
          />
          <StatPill
            n={result.unresolved.length}
            label="unresolved imports"
            tone={result.unresolved.length ? "warn" : undefined}
          />
        </div>
      </div>

      {(picked.truncated || skippedTotal > 0) && (
        <p className="rounded-xl border border-[var(--line-2)] bg-white/[0.02] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
          {picked.truncated && (
            <>
              <strong className="font-semibold text-[#FFD166]">This is a partial read.</strong>{" "}
              The limit of {LIMITS.files} files or {Math.round(LIMITS.bytes / 1000)} KB was
              reached, so what you see below describes only part of the project.{" "}
            </>
          )}
          Skipped {skippedTotal}: {picked.skipped.ignored} in ignored directories,{" "}
          {picked.skipped.notSource} non-JS/TS files, {picked.skipped.secret} secret files,{" "}
          {picked.skipped.tooBig} oversized files.
        </p>
      )}

      {/* 2. Interactive Visual Dependency & Blast-Radius Topology Map */}
      {graphData.nodes.length > 0 && (
        <section className="hud overflow-hidden rounded-2xl p-0" aria-label="Dependency Topology Map">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line-2)] px-4 py-3">
            <div className="flex items-center gap-2">
              <Network size={16} className="text-[var(--violet)]" />
              <h2 className="text-[13.5px] font-semibold text-[var(--ink)]">
                Interactive Dependency & Blast-Radius Topology
              </h2>
              <span className="rounded-full bg-[var(--violet)]/15 px-2 py-0.5 font-mono text-[10px] text-[var(--violet-ink)]">
                Click any module node to simulate blast radius
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-[var(--ink-3)]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#3DE0A6]" /> Selected Center
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#F59E0B]" /> Downstream Affected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#06B6D4]" /> Direct Dependency
              </span>
              {result.cycles.length > 0 && (
                <span className="flex items-center gap-1.5 text-[#FF6B6B]">
                  <span className="h-2 w-2 rounded-full bg-[#FF6B6B]" /> In Cycle
                </span>
              )}
            </div>
          </div>

          <div className="relative overflow-x-auto bg-[#0B0A12]/70 p-3">
            {/* Column labels */}
            <div className="mb-1 flex justify-between px-12 font-mono text-[10px] uppercase tracking-wider text-[var(--ink-3)]">
              <span>Entrypoints & Leaves (Fan-In 0)</span>
              <span>Feature Modules</span>
              <span>Shared Hubs & Core Choke-Points (High Fan-In &rarr;)</span>
            </div>

            <svg
              viewBox={`0 0 ${graphData.width} ${graphData.height}`}
              className="block h-auto w-full min-w-[640px]"
              role="img"
              aria-label="Module import dependency graph"
            >
              <defs>
                <marker
                  id="arch-arrow"
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path d="M0 0 L8 4 L0 8 z" fill="#8B5CF6" fillOpacity="0.7" />
                </marker>
                <marker
                  id="arch-arrow-blast"
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto"
                >
                  <path d="M0 0 L8 4 L0 8 z" fill="#F59E0B" />
                </marker>
              </defs>

              {/* Edges */}
              {graphData.edges.map((e) => {
                const a = graphData.posMap.get(e.source);
                const b = graphData.posMap.get(e.target);
                if (!a || !b) return null;

                const isSelectedSource = activeModule?.node.id === e.source;
                const isSelectedTarget = activeModule?.node.id === e.target;
                const isBlastEdge =
                  activeBlast &&
                  activeBlast.radius.distance.has(e.source) &&
                  activeBlast.radius.distance.has(e.target) &&
                  (activeBlast.radius.distance.get(e.source) ?? 0) >
                    (activeBlast.radius.distance.get(e.target) ?? 0);
                const isCycleEdge = a.mod.inCycle && b.mod.inCycle;

                const mx = (a.x + b.x) / 2;
                const d = `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;

                let stroke = "rgba(148, 163, 184, 0.22)";
                let width = 1.25;
                if (isCycleEdge) {
                  stroke = "#FF6B6B";
                  width = 2.2;
                } else if (isSelectedTarget || isBlastEdge) {
                  stroke = "#F59E0B";
                  width = 2.2;
                } else if (isSelectedSource) {
                  stroke = "#06B6D4";
                  width = 2;
                }

                return (
                  <path
                    key={e.id}
                    d={d}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={width}
                    strokeDasharray={isCycleEdge ? "4 3" : undefined}
                    markerEnd={
                      isSelectedTarget || isBlastEdge
                        ? "url(#arch-arrow-blast)"
                        : "url(#arch-arrow)"
                    }
                  />
                );
              })}

              {/* Nodes */}
              {graphData.nodes.map(({ x, y, color, mod }) => {
                const isSelected = activeModule?.node.id === mod.node.id;
                const blastDist = activeBlast?.radius.distance.get(mod.node.id);
                const isDirectDep = activeModule?.imports.some((i) => i.id === mod.node.id);
                const r = Math.min(13, 6 + mod.fanIn * 1.3);

                let ringColor = color;
                let fill = "#14121F";
                if (isSelected) {
                  ringColor = "#3DE0A6";
                  fill = "#3DE0A6";
                } else if (blastDist !== undefined && blastDist > 0) {
                  ringColor = "#F59E0B";
                  fill = "rgba(245, 158, 11, 0.28)";
                } else if (isDirectDep) {
                  ringColor = "#06B6D4";
                  fill = "rgba(6, 182, 212, 0.25)";
                } else if (mod.inCycle) {
                  ringColor = "#FF6B6B";
                }

                const shortLabel = mod.node.name.length > 20 ? mod.node.name.slice(0, 18) + "…" : mod.node.name;

                return (
                  <g
                    key={mod.node.id}
                    transform={`translate(${x}, ${y})`}
                    onClick={() => setSelectedFileId(mod.node.id)}
                    className="cursor-pointer"
                  >
                    {(isSelected || (blastDist !== undefined && blastDist > 0)) && (
                      <circle
                        r={r + 5}
                        fill={isSelected ? "#3DE0A6" : "#F59E0B"}
                        fillOpacity={0.2}
                      />
                    )}
                    <circle
                      r={r}
                      fill={fill}
                      stroke={ringColor}
                      strokeWidth={isSelected ? 2.5 : 1.8}
                    />
                    {blastDist !== undefined && blastDist > 0 && (
                      <text
                        y={3}
                        textAnchor="middle"
                        className="fill-[#FFD166] font-mono text-[8.5px] font-bold"
                      >
                        r{blastDist}
                      </text>
                    )}
                    <text
                      x={0}
                      y={r + 12}
                      textAnchor="middle"
                      className={`font-mono text-[9.5px] ${
                        isSelected
                          ? "fill-[#3DE0A6] font-semibold"
                          : blastDist
                          ? "fill-[#FFD166]"
                          : "fill-[#cbd5e1]"
                      }`}
                    >
                      {shortLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </section>
      )}

      {/* 3. Interactive Module Explorer (Left) + Deep Blast Radius & Source Inspector (Right) */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Module & Symbol Explorer */}
        <div className="hud flex min-h-[520px] flex-col overflow-hidden rounded-2xl p-0 lg:col-span-6">
          <div className="border-b border-[var(--line-2)] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--ink)]">
                <FolderGit2 size={15} className="text-[var(--cyan)]" />
                Module & Choke-Point Explorer
              </h3>
              <span className="font-mono text-[11px] text-[var(--ink-3)]">
                {filteredModules.length} of {modules.length} modules
              </span>
            </div>

            {/* Search & Sort */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search file path or exported function..."
                  className="w-full rounded-xl border border-[var(--line-2)] bg-surface/60 py-1.5 pl-8 pr-3 text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--violet)] focus:outline-none"
                />
              </div>
              <select
                aria-label="Sort modules by"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="rounded-xl border border-[var(--line-2)] bg-surface px-2.5 py-1.5 font-mono text-[11px] text-[var(--ink-2)] focus:border-[var(--violet)] focus:outline-none"
              >
                <option value="fanIn">Sort: Most Imported (Fan-In)</option>
                <option value="fanOut">Sort: Most Imports (Fan-Out)</option>
                <option value="symbols">Sort: Function Count</option>
                <option value="churn">Sort: Git Commit Churn</option>
                <option value="path">Sort: Alphabetical Path</option>
              </select>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter size={12} className="text-[var(--ink-3)] mr-0.5" />
              {(
                [
                  { id: "all", label: `All (${modules.length})` },
                  {
                    id: "hubs",
                    label: `Choke-Points (${modules.filter((m) => m.fanIn >= 2).length})`,
                  },
                  {
                    id: "cycles",
                    label: `In Cycles (${modules.filter((m) => m.inCycle).length})`,
                  },
                  {
                    id: "untested",
                    label: `Unshielded (${
                      modules.filter((m) => m.fanIn > 0 && m.tests.length === 0).length
                    })`,
                  },
                  {
                    id: "entrypoints",
                    label: `Entrypoints (${modules.filter((m) => m.fanIn === 0).length})`,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterMode(f.id)}
                  className={`rounded-lg px-2.5 py-1 font-mono text-[10.5px] transition-all ${
                    filterMode === f.id
                      ? "bg-[var(--violet)] text-white shadow-sm"
                      : "border border-[var(--line)] bg-surface/40 text-[var(--ink-3)] hover:text-[var(--ink)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Module rows */}
          <div className="max-h-[460px] flex-1 overflow-y-auto divide-y divide-[var(--line)]">
            {filteredModules.length === 0 ? (
              <div className="py-16 text-center text-[12.5px] text-[var(--ink-3)]">
                No modules match the current filter.
              </div>
            ) : (
              filteredModules.map((m) => {
                const isSelected = activeModule?.node.id === m.node.id;
                const blastDist = activeBlast?.radius.distance.get(m.node.id);
                return (
                  <button
                    key={m.node.id}
                    type="button"
                    onClick={() => setSelectedFileId(m.node.id)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected
                        ? "bg-[var(--violet-wash)]/75 text-[var(--ink)] ring-1 ring-inset ring-[var(--violet)]/40"
                        : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileCode2
                          size={13}
                          className={
                            isSelected
                              ? "text-[var(--violet)] shrink-0"
                              : m.inCycle
                              ? "text-[#FF6B6B] shrink-0"
                              : "text-[var(--cyan)] shrink-0"
                          }
                        />
                        <span className="truncate font-mono text-[12px] font-medium text-[var(--ink)]">
                          {m.path}
                        </span>
                        {blastDist !== undefined && blastDist > 0 && (
                          <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.2 font-mono text-[9.5px] font-semibold text-amber-300">
                            hop r{blastDist}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10.5px] text-[var(--ink-3)]">
                        <span>{m.symbols.length} fn</span>
                        <span>{m.fanOut} imports</span>
                        {m.gitTouches > 0 && <span>{m.gitTouches} commits</span>}
                        {m.tests.length > 0 && (
                          <span className="text-[#3DE0A6]">{m.tests.length} test links</span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {m.inCycle && (
                        <span className="rounded border border-rose-500/35 bg-rose-500/15 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-rose-300">
                          Cycle
                        </span>
                      )}
                      {m.fanIn >= 3 && (
                        <span className="rounded border border-amber-500/35 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-amber-300">
                          Hub
                        </span>
                      )}
                      <span className="rounded-lg border border-[var(--line)] bg-surface px-2 py-1 font-mono text-[11px] text-[var(--ink-2)]">
                        {m.fanIn} importer{m.fanIn === 1 ? "" : "s"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Deep Module Blast-Radius Simulator & Code Inspector */}
        <div className="hud flex min-h-[520px] flex-col justify-between rounded-2xl p-4 sm:p-5 lg:col-span-6">
          {activeModule ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="border-b border-[var(--line-2)] pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-3)]">
                    Module Blast-Radius & Code Inspector
                  </span>
                  <div className="flex items-center gap-1.5">
                    {activeModule.inCycle && (
                      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-rose-300">
                        In Circular Dependency
                      </span>
                    )}
                    <span className="rounded-full bg-[var(--violet)]/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--violet-ink)]">
                      Fan-In: {activeModule.fanIn} • Fan-Out: {activeModule.fanOut}
                    </span>
                  </div>
                </div>
                <h3 className="mt-1.5 break-all font-mono text-[14px] font-semibold text-[var(--ink)]">
                  {activeModule.path}
                </h3>
              </div>

              {/* Sub-navigation tabs */}
              <div className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--line)] bg-surface/50 p-1">
                {(
                  [
                    {
                      id: "blast",
                      label: "Blast Radius",
                      count: activeBlast?.affectedModules.length ?? 0,
                    },
                    {
                      id: "deps",
                      label: "Imports",
                      count: activeModule.importers.length + activeModule.imports.length,
                    },
                    {
                      id: "symbols",
                      label: "Symbols & Tests",
                      count: activeModule.symbols.length + activeModule.tests.length,
                    },
                    {
                      id: "source",
                      label: "Source Code",
                      count: activeSource ? activeSource.split("\n").length : 0,
                    },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setInspectorSubTab(t.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 font-mono text-[11px] transition-all ${
                      inspectorSubTab === t.id
                        ? "bg-[var(--violet)] text-white shadow-sm font-medium"
                        : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <span className="truncate">{t.label}</span>
                    <span
                      className={`rounded-full px-1.5 text-[9.5px] ${
                        inspectorSubTab === t.id
                          ? "bg-white/20 text-white"
                          : "bg-white/5 text-[var(--ink-3)]"
                      }`}
                    >
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Sub-tab 1: Blast Radius Simulator */}
              {inspectorSubTab === "blast" && activeBlast && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-white/[0.02] p-3">
                    <div>
                      <p className="text-[12px] font-medium text-[var(--ink)]">
                        Transitive Impact Simulation (Hops 1&ndash;{blastDepth})
                      </p>
                      <p className="text-[11px] text-[var(--ink-3)]">
                        If <code className="font-mono text-[var(--cyan)]">{activeModule.node.name}</code> changes,{" "}
                        <strong className="text-[var(--ink)]">
                          {activeBlast.affectedModules.length} downstream file
                          {activeBlast.affectedModules.length === 1 ? "" : "s"}
                        </strong>{" "}
                        and{" "}
                        <strong className="text-[#3DE0A6]">
                          {activeBlast.radius.tests.length} test
                          {activeBlast.radius.tests.length === 1 ? "" : "s"}
                        </strong>{" "}
                        are reachable.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <span className="text-[var(--ink-3)]">Max Hops:</span>
                      {[1, 2, 3, 4].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setBlastDepth(d)}
                          className={`h-6 w-6 rounded-md border ${
                            blastDepth === d
                              ? "border-[var(--violet)] bg-[var(--violet)] text-white"
                              : "border-[var(--line)] bg-surface text-[var(--ink-3)]"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeBlast.affectedModules.length === 0 ? (
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4 text-center">
                      <CheckCircle2 size={20} className="mx-auto text-[#3DE0A6]" />
                      <p className="mt-1.5 text-[12.5px] font-medium text-[var(--ink)]">
                        Isolated Leaf / Entrypoint Module
                      </p>
                      <p className="mt-1 text-[11.5px] text-[var(--ink-2)]">
                        No other analyzed files import <code className="font-mono">{activeModule.path}</code>. Edits here have zero downstream blast radius.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                      {activeBlast.affectedModules.map(({ module: depMod, distance, chain }) => (
                        <div
                          key={depMod.node.id}
                          onClick={() => setSelectedFileId(depMod.node.id)}
                          className="group flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-white/[0.02] px-3 py-2 transition-colors hover:border-[var(--violet)]/40 hover:bg-white/[0.04]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`shrink-0 rounded px-1.5 py-0.2 font-mono text-[10px] font-bold ${
                                  distance === 1
                                    ? "bg-amber-500/20 text-amber-300"
                                    : distance === 2
                                    ? "bg-purple-500/20 text-purple-300"
                                    : "bg-cyan-500/20 text-cyan-300"
                                }`}
                              >
                                r{distance}
                              </span>
                              <span className="truncate font-mono text-[12px] text-[var(--ink)] group-hover:text-[var(--violet-ink)]">
                                {depMod.path}
                              </span>
                            </div>
                            {chain.length > 1 && (
                              <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--ink-3)]">
                                via {chain.join(" → ")}
                              </p>
                            )}
                          </div>
                          <span className="font-mono text-[10.5px] text-[var(--ink-3)]">
                            {depMod.tests.length > 0 ? (
                              <span className="text-[#3DE0A6]">{depMod.tests.length} tests</span>
                            ) : (
                              "untested"
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 2: Inbound & Outbound Imports */}
              {inspectorSubTab === "deps" && (
                <div className="max-h-[340px] overflow-y-auto space-y-4 pr-1">
                  <div>
                    <h4 className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-3)]">
                      Imported By ({activeModule.importers.length} upstream callers)
                    </h4>
                    {activeModule.importers.length === 0 ? (
                      <p className="mt-1.5 text-[12px] text-[var(--ink-3)]">
                        Not imported by any other file.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {activeModule.importers.map((imp) => (
                          <li
                            key={`${imp.id}-${imp.line}`}
                            onClick={() => setSelectedFileId(imp.id)}
                            className="cursor-pointer rounded-lg border border-[var(--line)] bg-white/[0.02] p-2.5 hover:border-[var(--violet)]/40"
                          >
                            <div className="flex items-center justify-between font-mono text-[11.5px]">
                              <span className="text-[var(--ink)]">{imp.path}</span>
                              <span className="text-[var(--ink-3)]">line {imp.line}</span>
                            </div>
                            <pre className="mt-1 truncate font-mono text-[10.5px] text-[var(--ink-3)]">
                              {imp.text}
                            </pre>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h4 className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-3)]">
                      Direct Imports ({activeModule.imports.length} outbound dependencies)
                    </h4>
                    {activeModule.imports.length === 0 ? (
                      <p className="mt-1.5 text-[12px] text-[var(--ink-3)]">
                        Zero local relative imports.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {activeModule.imports.map((imp) => (
                          <li
                            key={`${imp.id}-${imp.line}`}
                            onClick={() => setSelectedFileId(imp.id)}
                            className="cursor-pointer rounded-lg border border-[var(--line)] bg-white/[0.02] p-2.5 hover:border-[var(--cyan)]/40"
                          >
                            <div className="flex items-center justify-between font-mono text-[11.5px]">
                              <span className="text-[var(--cyan)]">{imp.path}</span>
                              <span className="text-[var(--ink-3)]">line {imp.line}</span>
                            </div>
                            <pre className="mt-1 truncate font-mono text-[10.5px] text-[var(--ink-3)]">
                              {imp.text}
                            </pre>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Exported Functions & Linked Tests */}
              {inspectorSubTab === "symbols" && (
                <div className="max-h-[340px] overflow-y-auto space-y-4 pr-1">
                  <div>
                    <h4 className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-3)]">
                      Exported Functions ({activeModule.symbols.length})
                    </h4>
                    {activeModule.symbols.length === 0 ? (
                      <p className="mt-1.5 text-[12px] text-[var(--ink-3)]">
                        No <code className="font-mono">export function</code> declarations found in this file.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {activeModule.symbols.map((sym) => (
                          <li
                            key={sym.id}
                            className="rounded-lg border border-[var(--line)] bg-white/[0.02] px-3 py-2 font-mono text-[11.5px]"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[var(--violet-ink)]">
                                {sym.name}({sym.params ?? ""})
                              </span>
                              {sym.sourceRange && (
                                <span className="text-[10.5px] text-[var(--ink-3)]">
                                  L{sym.sourceRange.startLine}&ndash;{sym.sourceRange.endLine}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h4 className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-3)]">
                      Linked Test Cases ({activeModule.tests.length})
                    </h4>
                    {activeModule.tests.length === 0 ? (
                      <p className="mt-1.5 text-[12px] text-[var(--ink-3)]">
                        No direct <code className="font-mono">test()</code> or <code className="font-mono">it()</code> calls linked to this module.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {activeModule.tests.map((tc) => (
                          <li
                            key={tc.id}
                            className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] px-3 py-2 font-mono text-[11.5px]"
                          >
                            <span className="text-[#3DE0A6]">{tc.name}</span>
                            <span className="ml-2 text-[10px] text-[var(--ink-3)]">({tc.path})</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 4: Full Source Code Preview */}
              {inspectorSubTab === "source" && (
                <div className="max-h-[340px] overflow-auto rounded-xl border border-[var(--line)] bg-[#0A0911] p-3 font-mono text-[11.5px] leading-6">
                  {activeSource ? (
                    activeSource.split("\n").map((line, idx) => (
                      <div key={idx} className="grid grid-cols-[2.5rem_1fr] gap-2 hover:bg-white/[0.03]">
                        <span className="select-none text-right text-[var(--ink-3)]/60">
                          {idx + 1}
                        </span>
                        <span className="whitespace-pre-wrap break-all text-[var(--ink-2)]">
                          {line || " "}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[var(--ink-3)]">Source content unavailable.</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-[13px] text-[var(--ink-3)]">
              Select a file from the explorer to inspect its blast radius and dependencies.
            </div>
          )}
        </div>
      </div>

      {/* 4. Architectural Findings + Churn × Fan-In Hotspot Matrix */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="hud p-4" aria-labelledby="an-findings">
          <h2
            id="an-findings"
            className="flex items-center justify-between border-b border-[var(--line-2)] pb-3 text-[14px] font-semibold text-[var(--ink)]"
          >
            <span>What the analyser found</span>
            <span className="font-mono text-[11px] font-normal text-[var(--ink-3)]">
              {result.findings.length} finding{result.findings.length === 1 ? "" : "s"}
            </span>
          </h2>
          {result.findings.length === 0 ? (
            <div className="py-8 text-center">
              <ShieldCheck size={24} className="mx-auto text-[#3DE0A6]" />
              <p className="mt-2 text-[13px] font-medium text-[var(--ink)]">
                Zero Circular Dependencies or Broken Relative Imports
              </p>
              <p className="mt-1 text-[12px] text-[var(--ink-3)]">
                Clean acyclic import hierarchy across all {files.length} analyzed source files.
              </p>
            </div>
          ) : (
            <ul className="mt-3 max-h-[320px] overflow-y-auto space-y-2 pr-1">
              {result.findings.slice(0, 16).map((f) => (
                <li
                  key={f.id}
                  onClick={() => {
                    if (f.locations[0]?.path) {
                      setSelectedFileId(`file:${f.locations[0].path}`);
                    }
                  }}
                  className="cursor-pointer rounded-lg border border-[var(--line)] bg-white/[0.02] p-3 transition-colors hover:border-[var(--violet)]/40"
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <FindingBadge kind={f.kind} />
                    <span className="min-w-0 flex-1 text-[12.5px] text-[var(--ink)]">
                      {f.title}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-2)]">
                    {f.detail}
                  </p>
                  {f.locations[0] && (
                    <p className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">
                      {f.locations[0].path}:{f.locations[0].line}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="hud p-4" aria-labelledby="an-hotspots">
          <div className="flex items-center justify-between border-b border-[var(--line-2)] pb-3">
            <h2
              id="an-hotspots"
              className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]"
            >
              <Flame size={15} className="text-[#F59E0B]" />
              <span>Git Churn &times; Blast-Radius Hotspots</span>
            </h2>
            <span className="font-mono text-[10.5px] text-[var(--ink-3)]">
              Ranked by coupling + commit activity
            </span>
          </div>
          <p className="mt-1.5 text-[12px] text-[var(--ink-3)]">
            Modules that combine high downstream importer fan-in with frequent Git modifications or circular coupling.
          </p>
          <ul className="mt-3 space-y-2">
            {hotspots.map((h) => (
              <li
                key={h.path}
                onClick={() => setSelectedFileId(h.node.id)}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-white/[0.02] px-3 py-2 transition-colors hover:border-[var(--violet)]/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[12px] text-[var(--ink)]">{h.path}</p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-[var(--ink-3)]">
                    {h.fanIn} importers &bull; {h.symbols.length} functions
                    {h.gitTouches > 0 ? ` • ${h.gitTouches} commits` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {h.inCycle && (
                    <span className="rounded bg-rose-500/15 px-1.5 py-0.5 font-mono text-[10px] text-rose-300 border border-rose-500/30">
                      Cycle
                    </span>
                  )}
                  {h.fanIn >= 3 && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-300 border border-amber-500/30">
                      Choke-Point
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* 5. Cross-Studio Launchpad */}
      <section className="hud p-5" aria-label="Explore GitPrism Studios">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line-2)] pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]">
              <Compass size={16} className="text-[var(--cyan)]" />
              <span>Continue into GitPrism Interactive Studios</span>
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">
              Jump directly into any specialized GitPrism studio to simulate PR blast radius, 3-way merges, bisection, or candidate sandboxes.
            </p>
          </div>
        </div>
        <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {STUDIOS.filter((s) => s.id !== "analyze").map((s) => (
            <Link
              key={s.id}
              href={s.href}
              className="group flex flex-col justify-between rounded-xl border border-[var(--line)] bg-surface/60 p-3 transition-all hover:border-[var(--violet)]/50 hover:bg-surface"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] font-semibold text-[var(--ink)] group-hover:text-[var(--violet-ink)]">
                    {s.label}
                  </span>
                  <ArrowUpRight
                    size={13}
                    className="text-[var(--ink-3)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--violet)]"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[var(--ink-3)]">{s.blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {Object.keys(result.headFiles).length > 0 && (
        <SaveProject name={name} files={result.headFiles} onOpenShareModal={onOpenShare} />
      )}

      <div className="hud p-4">
        <h2 className="text-[11px] font-semibold text-[var(--ink-3)]">What this does not tell you</h2>
        <ul className="mt-2 space-y-1.5">
          {[
            "Relationships come from explicit relative or @/ path imports and direct calls by name. Dynamic imports, re-exports and method calls are not followed.",
            "Nothing was executed. No test was run and no behaviour was observed — this is what the code says, not what it does.",
            "Only TypeScript and JavaScript are parsed for AST symbols. Other languages in the project remain visible in your Git commit history and file trees.",
          ].map((l) => (
            <li key={l} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              <Link2Off size={13} className="mt-0.5 shrink-0 text-[var(--ink-3)]" />
              {l}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatPill({ n, label, tone }: { n: number; label: string; tone?: "warn" | "ok" }) {
  return (
    <span
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
        tone === "warn"
          ? "border-[#FFB800]/35 bg-[#FFB800]/10 text-[#FFD166]"
          : tone === "ok"
          ? "border-emerald-500/30 bg-emerald-500/10 text-[#3DE0A6]"
          : "border-[var(--line-2)] bg-white/[0.02] text-[var(--ink)]"
      }`}
    >
      {tone === "warn" ? <Repeat size={14} /> : tone === "ok" ? <CheckCircle2 size={14} /> : null}
      <span className="font-mono text-[17px] leading-none">{n}</span>
      <span className="text-[12px] text-[var(--ink-3)]">{label}</span>
    </span>
  );
}
