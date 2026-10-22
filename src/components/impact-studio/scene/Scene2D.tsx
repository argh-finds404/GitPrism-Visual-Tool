"use client";

import type { SceneProps } from "./ImpactScene";
import type { Placed } from "../lens-layouts";

const STATUS = { added: "#00D995", modified: "#FF007A", deleted: "#FF5D73", unchanged: "" } as const;
const KIND = { file: "#8F7FE0", symbol: "#3FB8D0", test: "#41B27F" } as const;
const EDGE: Record<string, string> = { import: "#00F0FF", call: "#9D7BFF", test: "#41B27F", violation: "#FF3B5C", allowed: "#00D995", uncertain: "#FFB800" };

/**
 * Flat SVG projection of the same lens layout. Used when WebGL is unavailable
 * or when the reviewer prefers 2D. Every node stays clickable and focusable.
 */
export function Scene2D({ projection, result, hovered, onSelect, onHover, onToggleContext }: SceneProps) {
  const vertical = !!projection.planes || !!projection.prism;
  const pt = (p: Placed) => (vertical ? [p.pos[0] + p.pos[2] * 0.35, -p.pos[1]] : [p.pos[0], p.pos[2]]);
  const pts = [...projection.nodes.values()].map(pt);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = 3;
  const minX = Math.min(...xs, -4) - pad;
  const minY = Math.min(...ys, -4) - pad;
  const w = Math.max(...xs, 4) - minX + pad;
  const h = Math.max(...ys, 4) - minY + pad;
  const byId = new Map(result.nodes.map((n) => [n.id, n]));

  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="h-full w-full bg-[#100E16]" role="group" aria-label="Impact graph (2D view)">
      {projection.rings?.map((r) => (
        <circle key={r.radius} r={r.radius} fill="none" stroke="#FF007A" strokeOpacity={0.4} strokeWidth={0.05} strokeDasharray="0.4 0.25" />
      ))}
      {projection.planes?.map((p) => (
        <g key={p.id}>
          <line x1={minX} x2={minX + w} y1={-p.y + 0.6} y2={-p.y + 0.6} stroke="#00D995" strokeOpacity={0.25} strokeWidth={0.04} />
          <text x={minX + 0.5} y={-p.y - 0.9} fontSize={0.55} fill="#5CE7B5" fontFamily="monospace">
            {p.label}
          </text>
        </g>
      ))}
      {projection.edges.map((e) => {
        const a = projection.nodes.get(e.source);
        const b = projection.nodes.get(e.target);
        if (!a || !b) return null;
        const [x1, y1] = pt(a);
        const [x2, y2] = pt(b);
        return (
          <line
            key={e.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={EDGE[e.tone]}
            strokeOpacity={e.strong || e.source === hovered || e.target === hovered ? 0.9 : 0.25}
            strokeWidth={e.strong ? 0.07 : 0.04}
            strokeDasharray={e.kind === "tests" ? "0.25 0.18" : undefined}
          />
        );
      })}
      {[...projection.nodes.entries()].map(([id, p]) => {
        const n = byId.get(id);
        if (!n) return null;
        const [x, y] = pt(p);
        const c = p.status !== "unchanged" ? STATUS[p.status] : KIND[n.kind];
        const r = n.kind === "file" ? 0.42 : 0.24;
        return (
          <g
            key={id}
            transform={`translate(${x} ${y})`}
            opacity={p.emphasis === "dim" ? 0.25 : 1}
            tabIndex={0}
            role="button"
            aria-label={`${n.kind} ${n.name}, ${p.status}`}
            className="cursor-pointer outline-none"
            onClick={(e) => (e.shiftKey ? onToggleContext(id) : onSelect(id))}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(id))}
            onMouseEnter={() => onHover(id)}
            onMouseLeave={() => onHover(null)}
          >
            {p.emphasis === "selected" && <circle r={r * 1.8} fill="none" stroke="#fff" strokeWidth={0.06} />}
            <circle r={r} fill={c} fillOpacity={p.status === "deleted" ? 0.2 : 0.9} stroke={c} strokeWidth={0.05} />
            {(p.label || hovered === id) && (
              <text y={-r - 0.25} textAnchor="middle" fontSize={0.42} fill="#F3EEF8" fontFamily="monospace">
                {n.kind === "symbol" ? `${n.name}()` : n.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
