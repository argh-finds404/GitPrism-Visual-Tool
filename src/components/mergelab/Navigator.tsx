"use client";

import { useState } from "react";
import type { FileStatus } from "@/features/mergelab/merge";
import { M, useMergeLab } from "./store";

const FILE_STATUS: Record<FileStatus, { label: string; color: string }> = {
  unchanged: { label: "unchanged", color: M.ink3 },
  ours: { label: "ours", color: M.ours },
  theirs: { label: "theirs", color: M.theirs },
  same: { label: "same change", color: M.base },
  merged: { label: "auto-merged", color: M.resolved },
  conflict: { label: "conflict", color: M.red },
  "modify-delete": { label: "modify/delete", color: M.red },
  "add-add": { label: "add/add", color: M.red },
};

export function Navigator() {
  const { m, places, resolutions, fileEdits, selection, select } = useMergeLab();
  const [showAll, setShowAll] = useState(false);
  const resolvedCount = m.conflicts.filter((c) => resolutions[c.id] || c.path in fileEdits).length;
  const files = m.files.filter((f) => showAll || f.status !== "unchanged");
  const hidden = m.files.filter((f) => f.status === "unchanged").length;

  return (
    <nav className="hud flex min-h-0 flex-col overflow-hidden" aria-label="Merge navigator">
      <div className="border-b border-white/8 p-3">
        <p className="flex items-baseline justify-between text-[12px] text-[#c9c0d8]">
          <span>Conflicts resolved</span>
          <span className="font-mono text-white">
            {resolvedCount}/{m.conflicts.length}
          </span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8" role="progressbar" aria-valuemin={0} aria-valuemax={m.conflicts.length} aria-valuenow={resolvedCount} aria-label="Conflicts resolved">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(resolvedCount / Math.max(1, m.conflicts.length)) * 100}%`, background: M.resolved }} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-2">
        <p className="px-2 pb-1 pt-1 text-[11px] font-semibold text-[#9a90ad]">Conflicts</p>
        <ul>
          {m.conflicts.map((c, i) => {
            const on = selection.kind === "conflict" && selection.id === c.id;
            const done = !!resolutions[c.id] || c.path in fileEdits;
            const p = places.get(c.id)!;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => select({ kind: "conflict", id: c.id })}
                  aria-current={on ? "true" : undefined}
                  className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${on ? "bg-white/10" : "hover:bg-white/5"}`}
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: done ? M.resolved : M.red }} aria-label={done ? "resolved" : "unresolved"} />
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[12px] text-white">{p.symbols.length ? p.symbols.map((s) => `${s}()`).join(", ") : `conflict ${i + 1}`}</span>
                    <span className="block truncate font-mono text-[10.5px] text-[#9a90ad]">{c.path.replace(/^src\//, "")}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <Constellation />

        <p className="mt-3 flex items-center justify-between px-2 pb-1 text-[11px] font-semibold text-[#9a90ad]">
          Files
          {hidden > 0 && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="font-normal underline decoration-dotted hover:text-white">
              {showAll ? "hide unchanged" : `+${hidden} unchanged`}
            </button>
          )}
        </p>
        <ul>
          {files.map((f) => {
            const on = selection.kind === "file" && selection.path === f.path;
            const st = FILE_STATUS[f.status];
            const deleted = (f.status === "ours" && f.ours === undefined) || (f.status === "theirs" && f.theirs === undefined);
            const added = f.base === undefined && !deleted && f.status !== "add-add";
            return (
              <li key={f.path}>
                <button
                  type="button"
                  onClick={() => select({ kind: "file", path: f.path })}
                  aria-current={on ? "true" : undefined}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors ${on ? "bg-white/10" : "hover:bg-white/5"}`}
                  title={f.path}
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[#e7e1f2]">{f.path.replace(/^src\//, "")}</span>
                  {f.path in fileEdits && <span className="font-mono text-[9.5px] text-[#7ff0c4]">edited</span>}
                  <span className="shrink-0 font-mono text-[9.5px]" style={{ color: st.color }}>
                    {deleted ? `deleted (${f.status})` : added && f.status !== "unchanged" ? `added (${f.status})` : st.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

/** Conflicts and the functions they sit in or call. Every line is evidence from the parser. */
function Constellation() {
  const { m, places, relations, groups, resolutions, fileEdits, selection, select } = useMergeLab();
  if (!groups.length && !relations.length) return null;
  const symbols = [...new Set([...m.conflicts.flatMap((c) => places.get(c.id)!.symbols.map((s) => `${c.path}#${s}`))])];
  const H = Math.max(m.conflicts.length, symbols.length) * 34 + 16;
  const cy = (i: number, n: number) => (n === 1 ? H / 2 : 16 + (i * (H - 32)) / (n - 1));
  const cPos = new Map(m.conflicts.map((c, i) => [c.id, { x: 22, y: cy(i, m.conflicts.length) }]));
  const sPos = new Map(symbols.map((s, i) => [s, { x: 150, y: cy(i, symbols.length) }]));
  const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => `M${a.x + 7} ${a.y}C${(a.x + b.x) / 2} ${a.y} ${(a.x + b.x) / 2} ${b.y} ${b.x - 4} ${b.y}`;

  return (
    <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-2">
      <p className="px-1 text-[11px] font-semibold text-[#9a90ad]">Constellation</p>
      <p className="px-1 text-[10.5px] leading-snug text-[#9a90ad]">
        {groups.length ? `${groups[0].length} conflicts are connected. Resolve them together.` : "No conflicts are connected."}
      </p>
      <svg viewBox={`0 0 240 ${H}`} className="mt-1 w-full" role="img" aria-label="Conflicts and the functions they relate to">
        {m.conflicts.map((c) =>
          places.get(c.id)!.symbols.map((s) => (
            <path key={`${c.id}-${s}`} d={curve(cPos.get(c.id)!, sPos.get(`${c.path}#${s}`)!)} fill="none" stroke="rgb(255 255 255 / 0.3)" strokeWidth={1}>
              <title>{`Inside ${s}()`}</title>
            </path>
          )),
        )}
        {relations
          .filter((r) => r.kind === "calls")
          .map((r, k) => {
            const target = m.conflicts.find((c) => c.id === r.b)!;
            return places.get(r.b)!.symbols.map((s) => (
              <path key={`${k}-${s}`} d={curve(cPos.get(r.a)!, sPos.get(`${target.path}#${s}`)!)} fill="none" stroke={M.theirs} strokeWidth={1.2} strokeDasharray="3 3">
                <title>{`${r.evidence}${r.location ? ` (${r.location.path}:${r.location.line}, ${r.location.side})` : ""}`}</title>
              </path>
            ));
          })}
        {m.conflicts.map((c, i) => {
          const p = cPos.get(c.id)!;
          const on = selection.kind === "conflict" && selection.id === c.id;
          const done = !!resolutions[c.id] || c.path in fileEdits;
          return (
            <g key={c.id} onClick={() => select({ kind: "conflict", id: c.id })} style={{ cursor: "pointer" }}>
              <circle cx={p.x} cy={p.y} r={on ? 8 : 6.5} fill={done ? M.resolved : M.red} stroke={on ? "#fff" : "none"} strokeWidth={1.5} />
              <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize={8} fill="#0b0816" fontFamily="var(--font-mono)">
                {i + 1}
              </text>
            </g>
          );
        })}
        {symbols.map((s) => {
          const p = sPos.get(s)!;
          return (
            <g key={s}>
              <rect x={p.x - 4} y={p.y - 9} width={92} height={18} rx={5} fill="#141022" stroke="rgb(255 255 255 / 0.15)" />
              <text x={p.x + 2} y={p.y + 3.5} fontSize={9.5} fill={M.ink2} fontFamily="var(--font-mono)">
                {s.split("#")[1].slice(0, 15)}()
              </text>
            </g>
          );
        })}
      </svg>
      <p className="flex gap-3 px-1 text-[10px] text-[#9a90ad]">
        <span className="flex items-center gap-1">
          <span className="h-px w-3 bg-white/40" />
          inside
        </span>
        <span className="flex items-center gap-1">
          <span className="h-px w-3 border-t border-dashed" style={{ borderColor: M.theirs }} />
          calls
        </span>
      </p>
    </div>
  );
}
