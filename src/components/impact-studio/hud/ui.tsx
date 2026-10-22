"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ChangeStatus, FindingKind } from "@/features/impact-analysis/types";

/** Button that opens a small panel; closes on outside click or Escape. */
export function Popover({
  label,
  children,
  panel,
  align = "left",
  className = "",
  panelClassName = "w-80",
}: {
  label: string;
  children: ReactNode;
  panel: (close: () => void) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setOpen(false));
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)} className={className}>
        {children}
      </button>
      {open && (
        <div
          className={`hud absolute top-full z-50 mt-2 p-3 ${panelClassName} ${
            align === "right" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0"
          }`}
        >
          {panel(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export const STATUS_STYLE: Record<ChangeStatus, { label: string; cls: string; letter: string }> = {
  added: { label: "Added", cls: "bg-[#00D995]/15 text-[#3DE0A6]", letter: "A" },
  modified: { label: "Changed", cls: "bg-[#FF007A]/15 text-[#FF7AB6]", letter: "M" },
  deleted: { label: "Deleted", cls: "bg-[#FF5D73]/15 text-[#FF8FA0]", letter: "D" },
  unchanged: { label: "Unchanged", cls: "bg-white/5 text-[#9a90ad]", letter: "·" },
};

export function StatusBadge({ status, short = false }: { status: ChangeStatus; short?: boolean }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-px font-mono text-[10.5px] font-medium ${s.cls}`} title={s.label}>
      {short ? s.letter : s.label}
      {short && <span className="sr-only"> {s.label}</span>}
    </span>
  );
}

export const FINDING_STYLE: Record<FindingKind, { label: string; cls: string }> = {
  fact: { label: "Fact from diff", cls: "border-[#00F0FF]/30 bg-[#00F0FF]/10 text-[#7DF5FF]" },
  "static-warning": { label: "Static warning", cls: "border-[#FFB800]/30 bg-[#FFB800]/10 text-[#FFD166]" },
  hypothesis: { label: "Hypothesis", cls: "border-[#9D7BFF]/30 bg-[#9D7BFF]/10 text-[#C4B3FF]" },
};

export function FindingBadge({ kind }: { kind: FindingKind }) {
  const f = FINDING_STYLE[kind];
  return <span className={`inline-flex shrink-0 rounded-full border px-2 py-px text-[10.5px] ${f.cls}`}>{f.label}</span>;
}

export function HudButton({
  children,
  onClick,
  label,
  pressed,
  disabled,
  className = "",
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  label?: string;
  pressed?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      aria-pressed={pressed}
      disabled={disabled}
      className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] text-[#c9c0d8] transition-colors hover:bg-white/8 hover:text-white disabled:pointer-events-none disabled:opacity-35 aria-pressed:bg-[#7C3AED]/30 aria-pressed:text-white ${className}`}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-1.5 mt-3 flex items-center justify-between first:mt-0">
      <h3 className="text-[11px] font-semibold text-[#9a90ad]">{children}</h3>
      {aside}
    </div>
  );
}
