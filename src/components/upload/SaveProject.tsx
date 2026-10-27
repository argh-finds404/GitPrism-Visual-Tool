"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Share2, TriangleAlert } from "lucide-react";

/**
 * Saving is deliberately a separate, explicit step. Until this is pressed the picked folder has
 * stayed in the browser; pressing it sends the source to this deployment's database, so the
 * trade is stated plainly rather than buried.
 */
type State =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; url: string; keepDays: number }
  | { status: "error"; message: string };

export function SaveProject({
  name,
  files,
  onOpenShareModal,
}: {
  name: string;
  files: Record<string, string>;
  onOpenShareModal?: () => void;
}) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  const save = async () => {
    setState({ status: "saving" });
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, files }),
      });
      const data = await res.json();
      if (!res.ok) return setState({ status: "error", message: data.error ?? `Could not save (${res.status}).` });
      setState({ status: "saved", url: `${location.origin}/analyze/${data.id}`, keepDays: data.keepDays });
    } catch {
      setState({ status: "error", message: "Could not reach the server. Nothing was sent." });
    }
  };

  if (state.status === "saved") {
    return (
      <div className="hud flex flex-wrap items-center gap-3 p-4">
        <Check size={16} className="shrink-0 text-[#3DE0A6]" />
        <span className="text-[13px] text-[var(--ink-2)]">
          Saved for {state.keepDays} days, then deleted.
        </span>
        <code className="min-w-0 flex-1 truncate rounded-lg border border-[var(--line-2)] bg-black/30 px-2.5 py-1.5 font-mono text-[11.5px] text-[var(--ink)]">
          {state.url}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(state.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="btn btn-ghost btn-sm"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    );
  }

  return (
    <div className="hud flex flex-wrap items-center gap-3 p-4">
      <Share2 size={16} className="shrink-0 text-[var(--violet)]" />
      <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
        <strong className="font-semibold text-[var(--ink)]">Nothing has left this browser.</strong> Saving uploads{" "}
        {Object.keys(files).length} source files to this deployment so you can reopen them from a link. Only do that
        with code you are willing to store.
      </p>
      {state.status === "error" && (
        <p className="flex w-full items-start gap-2 text-[12.5px] text-[#FFD166]" role="alert">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      )}
      <button
        type="button"
        onClick={onOpenShareModal ?? save}
        disabled={state.status === "saving"}
        className="btn btn-ghost btn-sm shrink-0 border border-[var(--violet)]/30 bg-[var(--violet)]/10 text-[var(--violet-ink)] hover:bg-[var(--violet)]/20"
      >
        {state.status === "saving" ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
        {state.status === "saving" ? "Saving" : "Share or Save Project"}
      </button>
    </div>
  );
}
