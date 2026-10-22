"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Glyph } from "@/components/workbench/bits";
import type { GNodeKind } from "@/lib/graph/build-graph";

export type Emphasis = "selected" | "lit" | "dim" | "normal";

export type ObjNodeData = {
  kind: GNodeKind;
  label: string;
  sub?: string;
  emphasis: Emphasis;
  current?: boolean;
  fresh?: boolean;
  laneColor?: string;
};

export type ObjFlowNode = Node<ObjNodeData, "obj">;

const sides = [
  { pos: Position.Left, id: "left" },
  { pos: Position.Right, id: "right" },
  { pos: Position.Top, id: "top" },
  { pos: Position.Bottom, id: "bottom" },
];

/** Invisible handles on every side; edges choose which to use. */
function Handles() {
  return (
    <>
      {sides.map((s) => (
        <span key={s.id}>
          <Handle
            type="source"
            position={s.pos}
            id={`s-${s.id}`}
            isConnectable={false}
            className="!pointer-events-none !h-1 !w-1 !min-w-0 !border-0 !bg-transparent"
          />
          <Handle
            type="target"
            position={s.pos}
            id={`t-${s.id}`}
            isConnectable={false}
            className="!pointer-events-none !h-1 !w-1 !min-w-0 !border-0 !bg-transparent"
          />
        </span>
      ))}
    </>
  );
}

const ring: Record<Emphasis, string> = {
  selected: "drop-shadow-[0_0_10px_var(--violet)]",
  lit: "drop-shadow-[0_0_6px_color-mix(in_oklab,var(--violet)_70%,transparent)]",
  dim: "opacity-30",
  normal: "",
};

export function ObjNode({ data }: NodeProps<ObjFlowNode>) {
  const { kind, label, sub, emphasis, current, fresh } = data;
  const selected = emphasis === "selected";

  if (kind === "branch" || kind === "head") {
    return (
      <div className={`transition-opacity duration-300 ${emphasis === "dim" ? "opacity-40" : ""}`}>
        <Handles />
        <div
          className={`flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 font-mono text-[11px] ${
            selected ? "border-[color:var(--c-ref)] bg-[color:var(--c-ref)] text-[#191720]" : "border-[color:var(--c-ref)]/70 bg-[#1d1a26] text-[color:var(--c-ref)]"
          } ${kind === "head" ? "border-dashed" : ""}`}
        >
          {kind === "branch" && current && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
          {label}
          {kind === "head" && <span className="opacity-70">{sub}</span>}
        </div>
      </div>
    );
  }

  // The node box is just the shape, so edges meet the shape itself; labels hang below it.
  const shapeSize = kind === "commit" ? 24 : 18;
  return (
    <div
      className={`relative transition-opacity duration-300 ${emphasis === "dim" ? "opacity-30" : ""}`}
      style={{ width: shapeSize, height: shapeSize }}
    >
      <Handles />
      <span className={`relative block transition-[filter] duration-300 ${ring[emphasis]} ${fresh ? "animate-[pop_0.6s_cubic-bezier(.22,1,.36,1)]" : ""}`}>
        <Glyph kind={kind} size={shapeSize} filled={selected || emphasis === "lit" || current} />
        {current && kind === "commit" && (
          <span className="absolute -inset-1.5 rounded-full border border-dashed border-[color:var(--c-ref)]/70" aria-hidden="true" />
        )}
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full mt-1.5 flex w-[150px] -translate-x-1/2 flex-col items-center text-center">
        <span className={`font-mono text-[10.5px] ${selected ? "text-white" : "text-[#9a94ab]"}`}>{sub}</span>
        <span className={`max-w-[150px] truncate text-[11.5px] leading-tight ${selected ? "font-medium text-white" : "text-[#cfcadb]"}`} title={label}>
          {label}
        </span>
      </span>
    </div>
  );
}

export const nodeTypes = { obj: ObjNode };
