"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SmoothInput } from "@/components/ui/skiper-ui/skiper106";
import { functionDna } from "@/features/timefold/history";
import { C, useTimeFold } from "./store";

/** Every function that ever existed, grouped by file, with how often it changed and when it lived. */
export function SymbolRail() {
  const { h, symbols, lineage, setLineage, index } = useTimeFold();
  const [q, setQ] = useState("");
  const total = h.snapshots.length;

  const rows = useMemo(
    () =>
      symbols.map((s) => {
        const dna = functionDna(h, s.lineage);
        return { ...s, changes: dna.filter((e) => e.events.length).length, alive: dna.map((e) => !!e.id) };
      }),
    [h, symbols],
  );
  const filtered = rows.filter((r) => !q || `${r.name} ${r.path}`.toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(filtered.map((r) => r.path))];

  return (
    <nav className="hud flex min-h-0 flex-col overflow-hidden" aria-label="Functions">
      <div className="border-b border-white/8 p-3">
        <label className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-[#120e20] pl-2.5 focus-within:border-[#9D7BFF]">
          <Search size={14} className="text-[#9a90ad]" />
          <SmoothInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a function"
            aria-label="Find a function"
            wrapperClassName="flex-1 rounded-none border-0 bg-transparent has-[:focus-visible]:border-0 has-[:focus-visible]:shadow-none"
            className="px-0 py-1.5 text-[12.5px] text-white placeholder:text-[#6f6782]"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {groups.map((path) => (
          <div key={path} className="mb-2">
            <p className="truncate px-2 pb-1 pt-1.5 font-mono text-[10.5px] text-[#9a90ad]" title={path}>
              {path.replace(/^src\//, "")}
            </p>
            <ul>
              {filtered
                .filter((r) => r.path === path)
                .map((r) => {
                  const on = r.lineage === lineage;
                  const here = r.alive[index];
                  return (
                    <li key={r.lineage}>
                      <button
                        type="button"
                        onClick={() => setLineage(r.lineage)}
                        aria-current={on ? "true" : undefined}
                        className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors ${on ? "bg-[#9D7BFF]/16" : "hover:bg-white/5"}`}
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={`truncate font-mono text-[12px] ${on ? "text-white" : here ? "text-[#c9c0d8]" : "text-[#6f6782]"}`}>{r.name}()</span>
                          <span className="shrink-0 font-mono text-[10px] text-[#9a90ad]">{r.changes}×</span>
                        </span>
                        {/* Lifespan across the whole history; the amber tick is the playhead. */}
                        <span className="relative mt-1 flex h-1 gap-px" aria-hidden="true">
                          {r.alive.map((a, i) => (
                            <span key={i} className="h-full flex-1 rounded-[1px]" style={{ background: a ? (on ? C.cyan : "rgb(157 123 255 / 0.45)") : "rgb(255 255 255 / 0.06)" }} />
                          ))}
                          <span className="absolute -top-0.5 h-2 w-px" style={{ left: `${((index + 0.5) / total) * 100}%`, background: C.amber }} />
                        </span>
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
        {!groups.length && <p className="p-3 text-[12px] text-[#9a90ad]">No function matches “{q}”.</p>}
      </div>
    </nav>
  );
}
