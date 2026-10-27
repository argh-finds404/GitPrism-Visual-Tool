"use client";

import { useMemo, useState } from "react";
import { ChevronRight, CircleDot, RefreshCcw, Search } from "lucide-react";
import { blastRadius } from "@/features/impact-analysis/blast-radius";
import { LAYER_CONFIG } from "@/features/impact-analysis/fixture";
import type { ImpactNode } from "@/features/impact-analysis/types";
import { defaultCenter } from "../lens-layouts";
import { useStudio } from "../store";
import { StatusBadge } from "./ui";

type Filter = "all" | "changed" | "impacted" | "tests";
type Sort = "path" | "distance" | "lines";

export function ChangeExplorer() {
  const s = useStudio();
  const r = s.result;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [layer, setLayer] = useState("all");
  const [sort, setSort] = useState<Sort>("path");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const center = r ? (s.selected && r.nodes.some((n) => n.id === s.selected && n.changeStatus !== "deleted") ? s.selected : defaultCenter(r)) : null;
  const radius = useMemo(() => (r && center ? blastRadius(r, center, s.depth) : null), [r, center, s.depth]);

  const files = useMemo(() => {
    if (!r) return [];
    const kids = (f: ImpactNode) => r.nodes.filter((n) => n.fileId === f.id);
    const matchQ = (n: ImpactNode) => !q || n.path.toLowerCase().includes(q.toLowerCase()) || n.name.toLowerCase().includes(q.toLowerCase());
    const dist = (n: ImpactNode) => radius?.distance.get(n.id);
    const fileDist = (f: ImpactNode) => Math.min(...[f, ...kids(f)].map((k) => dist(k) ?? 99));
    const keep = (f: ImpactNode) => {
      const all = [f, ...kids(f)];
      if (layer !== "all" && (r.layerOf[f.id] ?? "unclassified") !== layer) return false;
      if (!all.some(matchQ)) return false;
      if (filter === "changed") return all.some((n) => n.changeStatus !== "unchanged");
      if (filter === "impacted") return all.some((n) => dist(n) !== undefined);
      if (filter === "tests") return all.some((n) => n.kind === "test");
      return true;
    };
    const lines = (f: ImpactNode) => {
      const c = r.changes.find((x) => x.path === f.path);
      return c ? c.added + c.removed : 0;
    };
    return r.nodes
      .filter((n) => n.kind === "file" && keep(n))
      .sort((a, b) => (sort === "distance" ? fileDist(a) - fileDist(b) : sort === "lines" ? lines(b) - lines(a) : 0) || a.path.localeCompare(b.path))
      .map((f) => ({ f, kids: kids(f).filter((k) => matchQ(k) || matchQ(f)), dist: fileDist(f), lines: r.changes.find((x) => x.path === f.path) }));
  }, [r, q, filter, layer, sort, radius]);

  if (!r) return <ExplorerShell>{s.status === "error" ? <p className="p-3 text-[12px] text-[#FF7A90]">{s.error}</p> : <p className="p-3 text-[12px] text-[#9a90ad]">Waiting for analysis…</p>}</ExplorerShell>;

  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <ExplorerShell>
      <div className="space-y-2 border-b border-white/8 p-3">
        <label className="relative block">
          <span className="sr-only">Search files or symbols</span>
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9a90ad]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search files or symbols"
            className="h-8 w-full rounded-lg border border-white/10 bg-white/5 pl-8 pr-2 text-[12px] text-white placeholder:text-[#7d748f] focus:border-[#7C3AED] focus:outline-none"
          />
        </label>
        <div className="flex gap-0.5 rounded-lg bg-white/5 p-0.5" role="group" aria-label="Filter">
          {(["all", "changed", "impacted", "tests"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className="h-6 flex-1 rounded-md text-[11px] capitalize text-[#9a90ad] hover:text-white aria-pressed:bg-white/12 aria-pressed:text-white"
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <label className="flex-1">
            <span className="sr-only">Layer</span>
            <select value={layer} onChange={(e) => setLayer(e.target.value)} className="h-7 w-full rounded-md border border-white/10 bg-[#1A1623] px-1.5 text-[11px] text-[#c9c0d8]">
              <option value="all">All layers</option>
              {LAYER_CONFIG.layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
              <option value="unclassified">Unclassified</option>
            </select>
          </label>
          <label className="flex-1">
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-7 w-full rounded-md border border-white/10 bg-[#1A1623] px-1.5 text-[11px] text-[#c9c0d8]">
              <option value="path">Sort by path</option>
              <option value="distance">By impact distance</option>
              <option value="lines">By changed lines</option>
            </select>
          </label>
        </div>
        {filter === "impacted" && center && (
          <p className="text-[11px] text-[#9a90ad]">
            Within {s.depth} hop{s.depth > 1 ? "s" : ""} of <span className="font-mono text-[#FF7AB6]">{r.nodes.find((n) => n.id === center)?.name}</span>
          </p>
        )}
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5" aria-label="Files and symbols">
        {files.length === 0 && <li className="p-3 text-[12px] text-[#9a90ad]">Nothing matches. Clear the search or pick another filter.</li>}
        {files.map(({ f, kids, dist, lines }) => {
          const expanded = open.has(f.id) || !!q || kids.some((k) => k.id === s.selected);
          return (
            <li key={f.id}>
              <div className={`group flex items-center gap-1 rounded-lg ${s.selected === f.id ? "bg-[#7C3AED]/25" : "hover:bg-white/5"}`}>
                <button
                  type="button"
                  onClick={() => toggle(f.id)}
                  aria-expanded={expanded}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${f.path}`}
                  className="grid h-7 w-6 shrink-0 place-items-center text-[#9a90ad]"
                  disabled={!kids.length}
                >
                  {kids.length > 0 && <ChevronRight size={13} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />}
                </button>
                <button type="button" onClick={() => s.select(f.id, { tab: "impact" })} className="flex min-w-0 flex-1 items-center gap-2 py-1 pr-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-white">{f.name}</span>
                    <span className="block truncate font-mono text-[10.5px] text-[#7d748f]">{f.path.split("/").slice(0, -1).join("/") || "/"}</span>
                  </span>
                  {lines && (
                    <span className="font-mono text-[10.5px]">
                      <span className="text-[#3DE0A6]">+{lines.added}</span> <span className="text-[#FF7A90]">−{lines.removed}</span>
                    </span>
                  )}
                  {dist !== 99 && <span className="rounded bg-[#FF007A]/15 px-1 font-mono text-[10px] text-[#FF7AB6]" title="Impact distance">r{dist}</span>}
                  <StatusBadge status={f.changeStatus} short />
                </button>
              </div>
              {expanded && (
                <ul className="mb-1 ml-6 border-l border-white/8 pl-1.5">
                  {kids.map((k) => {
                    const d = radius?.distance.get(k.id);
                    return (
                      <li key={k.id}>
                        <button
                          type="button"
                          onClick={(e) => (e.shiftKey ? s.toggleContext(k.id) : s.select(k.id, { tab: "impact" }))}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left ${s.selected === k.id ? "bg-[#7C3AED]/25" : "hover:bg-white/5"}`}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${k.kind === "test" ? "bg-[#41B27F]" : "bg-[#3FB8D0]"}`} aria-hidden="true" />
                          <span className={`min-w-0 flex-1 truncate font-mono text-[11.5px] ${k.changeStatus === "deleted" ? "text-[#9a90ad] line-through" : "text-[#e6def2]"}`}>
                            {k.kind === "test" ? `“${k.name}”` : `${k.name}()`}
                          </span>
                          {s.lens === 4 && s.context.has(k.id) && <CircleDot size={11} className="text-[#9D7BFF]" aria-label="In review context" />}
                          {d !== undefined && <span className="font-mono text-[10px] text-[#FF7AB6]">r{d}</span>}
                          {k.changeStatus !== "unchanged" && <StatusBadge status={k.changeStatus} short />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {r.cycles.length > 0 && (
        <div className="border-t border-white/8 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#FF7A90]">
            <RefreshCcw size={12} /> Import cycle{r.cycles.length > 1 ? "s" : ""}
          </p>
          {r.cycles.map((c) => (
            <button
              key={c.join()}
              type="button"
              onClick={() => {
                s.setHighlight({ ids: new Set(c), label: "Import cycle" });
                s.setLens(3);
              }}
              className="mt-1 w-full rounded-lg bg-[#FF3B5C]/10 px-2 py-1.5 text-left font-mono text-[11px] text-[#FFB3C0] hover:bg-[#FF3B5C]/18"
            >
              {[...c, c[0]].map((id) => r.nodes.find((n) => n.id === id)?.name).join(" → ")}
            </button>
          ))}
        </div>
      )}
      {s.lens === 4 && <p className="border-t border-white/8 px-3 py-2 text-[11px] text-[#9a90ad]">Shift-click a symbol to add it to or remove it from the review context.</p>}
    </ExplorerShell>
  );
}

function ExplorerShell({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Change explorer" className="hud flex h-full min-h-0 flex-col overflow-hidden">
      <h2 className="flex items-center justify-between border-b border-white/8 px-3 py-2 text-[12px] font-semibold">
        Change explorer <span className="kbd">[</span>
      </h2>
      {children}
    </section>
  );
}
