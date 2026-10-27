"use client";

// Small shared pieces for the workbench: object glyphs, copyable IDs, dialogs.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

export type GlyphKind = "blob" | "tree" | "commit" | "branch" | "head";

/** Object types are distinguished by shape as well as colour. */
export const kindColor: Record<GlyphKind, string> = {
  blob: "var(--c-blob)",
  tree: "var(--c-tree)",
  commit: "var(--c-commit)",
  branch: "var(--c-ref)",
  head: "var(--c-ref)",
};

export const kindName: Record<GlyphKind, string> = {
  blob: "Blob",
  tree: "Tree",
  commit: "Commit",
  branch: "Branch",
  head: "HEAD",
};

export function Glyph({ kind, size = 12, filled = true }: { kind: GlyphKind; size?: number; filled?: boolean }) {
  const c = kindColor[kind];
  const common = { fill: filled ? c : "none", stroke: c, strokeWidth: 1.6 };
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
      {kind === "blob" && <circle cx="6" cy="6" r="4.6" {...common} />}
      {kind === "tree" && <rect x="1.6" y="1.6" width="8.8" height="8.8" rx="1.2" {...common} />}
      {kind === "commit" && <path d="M6 0.9 L11.1 6 L6 11.1 L0.9 6 Z" {...common} />}
      {(kind === "branch" || kind === "head") && <rect x="0.8" y="3" width="10.4" height="6" rx="3" {...common} />}
    </svg>
  );
}

export function Oid({ oid, full = false, className = "" }: { oid: string; full?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(full);
  return (
    <span className={`inline-flex min-w-0 items-center gap-1 font-mono ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        title={expanded ? "Show short ID" : oid}
        aria-label={expanded ? `Object ID ${oid}, show short form` : `Object ID ${oid.slice(0, 7)}, show full ID`}
        className="min-w-0 break-all rounded px-0.5 text-left hover:bg-violet-wash"
      >
        {expanded ? oid : oid.slice(0, 7)}
      </button>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(oid);
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          } catch {}
        }}
        aria-label="Copy full object ID"
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-ink-3 hover:bg-violet-wash hover:text-violet-ink"
      >
        {copied ? <Check size={11} /> : <Copy size={11} />}
      </button>
    </span>
  );
}

/** Accessible confirm dialog built on <dialog>. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = "danger",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(92vw,440px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-[rgb(18_16_24/0.45)] backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <h2 className="text-[1.05rem] font-semibold">{title}</h2>
        <div className="mt-2 text-[0.9rem] leading-relaxed text-ink-2">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-full border border-line-2 px-4 text-[0.85rem] hover:border-violet">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`h-9 rounded-full px-4 text-[0.85rem] font-medium text-white ${tone === "danger" ? "bg-del hover:opacity-90" : "bg-violet hover:opacity-90"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export function PanelTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
      <h2 className="text-[0.78rem] font-semibold text-ink-2">{children}</h2>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  disabled,
  pressed,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-violet-wash hover:text-violet-ink disabled:pointer-events-none disabled:opacity-35 aria-pressed:bg-violet-wash aria-pressed:text-violet-ink"
    >
      {children}
    </button>
  );
}

const statusTone: Record<string, string> = {
  modified: "text-[color:var(--c-ref)]",
  added: "text-add",
  untracked: "text-add",
  deleted: "text-del",
};
const statusLetter: Record<string, string> = { modified: "M", added: "A", untracked: "U", deleted: "D" };

export function StatusLetter({ kind, staged }: { kind: string; staged?: boolean }) {
  return (
    <span
      title={`${staged ? "Staged" : "Unstaged"}: ${kind}`}
      className={`inline-grid h-4 w-4 place-items-center rounded font-mono text-[0.65rem] font-semibold ${statusTone[kind]} ${
        staged ? "bg-add-bg" : ""
      }`}
    >
      {statusLetter[kind]}
      <span className="sr-only">
        {staged ? "staged" : "unstaged"} {kind}
      </span>
    </span>
  );
}

export function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
