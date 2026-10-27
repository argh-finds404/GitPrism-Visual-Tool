"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Cloud,
  Copy,
  Download,
  FileDown,
  Globe,
  HardDrive,
  Loader2,
  Share2,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";

type ShareState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; url: string; keepDays: number }
  | { status: "error"; message: string; isDbMissing?: boolean };

export function ShareModal({
  isOpen,
  onClose,
  projectName,
  files,
  fileCount,
  totalBytes,
  onExportBundle,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  files: Record<string, string>;
  fileCount: number;
  totalBytes: number;
  onExportBundle: () => void;
}) {
  const [shareState, setShareState] = useState<ShareState>({ status: "idle" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGenerateLink = async () => {
    setShareState({ status: "saving" });
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName, files }),
      });
      const data = await res.json();
      if (!res.ok) {
        const isDb = res.status === 503 || (data.error && data.error.includes("database"));
        setShareState({
          status: "error",
          message: data.error ?? `Could not save (${res.status}).`,
          isDbMissing: isDb,
        });
        return;
      }
      setShareState({
        status: "saved",
        url: `${window.location.origin}/analyze/${data.id}`,
        keepDays: data.keepDays ?? 7,
      });
    } catch {
      setShareState({
        status: "error",
        message: "Could not reach the server API. Check your network connection.",
        isDbMissing: false,
      });
    }
  };

  const handleCopy = (url: string) => {
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--line-2)] bg-[#101015] p-5 shadow-2xl backdrop-blur-xl sm:p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl border border-[var(--violet)]/30 bg-[var(--violet)]/15 text-[var(--violet)]">
              <Share2 size={16} />
            </div>
            <div>
              <h3 id="share-modal-title" className="text-[15px] font-semibold text-[var(--ink)]">
                Share Project Analysis
              </h3>
              <p className="font-mono text-[11px] text-[var(--ink-3)]">
                Local-first by default &bull; choose how to share
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--ink-3)] transition-colors hover:bg-white/10 hover:text-[var(--ink)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Privacy Guarantee Banner */}
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-[12px] leading-relaxed text-[var(--ink-2)]">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#3DE0A6]" />
            <div>
              <p className="font-medium text-[var(--ink)]">
                Your code is safely stored offline in IndexedDB
              </p>
              <p className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">
                Repository <strong className="text-[var(--ink-2)]">{projectName}</strong> ({fileCount} files,{" "}
                {(totalBytes / 1024).toFixed(1)} KB) is kept 100% on this machine. Generating a link is strictly opt-in.
              </p>
            </div>
          </div>

          {/* Option A: Temporary Cloud Link */}
          <div className="rounded-xl border border-[var(--line)] bg-surface/50 p-4 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe size={15} className="text-[var(--cyan)]" />
                <h4 className="text-[13px] font-semibold text-[var(--ink)]">
                  Temporary Cloud Share Link
                </h4>
              </div>
              <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[9.5px] text-[var(--ink-3)]">
                7-Day TTL Auto-Pruned
              </span>
            </div>

            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
              Uploads a read-only snapshot to this deployment so teammates can open the architecture graph and Git history from any browser without uploading folders.
            </p>

            {shareState.status === "saved" ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-lg border border-[var(--line-2)] bg-black/40 px-2.5 py-1.5 font-mono text-[11px] text-[var(--ink)] select-all">
                    {shareState.url}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(shareState.url)}
                    className="btn btn-ghost btn-sm shrink-0 border border-[var(--violet)]/40 bg-[var(--violet)]/15 text-[var(--violet-ink)] hover:bg-[var(--violet)]/25"
                  >
                    {copied ? <Check size={13} className="text-[#3DE0A6]" /> : <Copy size={13} />}
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="flex items-center justify-between font-mono text-[10.5px] text-[var(--ink-3)]">
                  <span className="text-[#3DE0A6] flex items-center gap-1">
                    <Check size={11} /> Ready to share &bull; expires in {shareState.keepDays} days
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateLink}
                    className="text-[var(--ink-3)] hover:text-[var(--ink)] hover:underline"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                {shareState.status === "error" && (
                  <div className="mb-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11.5px] text-amber-200">
                    <div className="flex items-start gap-1.5">
                      <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-400" />
                      <div>
                        <p className="font-medium text-amber-300">
                          {shareState.isDbMissing ? "No Cloud Database Connected" : "Share Error"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-amber-200/80">
                          {shareState.isDbMissing
                            ? "This deployment has no active PostgreSQL database configured. You can still share this exact analysis offline using the portable bundle below!"
                            : shareState.message}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGenerateLink}
                  disabled={shareState.status === "saving"}
                  className="btn btn-ghost btn-sm flex w-full items-center justify-center gap-2 border border-[var(--violet)]/30 bg-[var(--violet)]/10 text-[var(--violet)] hover:bg-[var(--violet)]/20"
                >
                  {shareState.status === "saving" ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Generating Cloud Link...</span>
                    </>
                  ) : (
                    <>
                      <Cloud size={13} />
                      <span>Generate Cloud Link (7-Day TTL)</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Option B: Offline Portable Bundle */}
          <div className="rounded-xl border border-[var(--line)] bg-surface/50 p-4 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileDown size={15} className="text-[var(--amber)]" />
                <h4 className="text-[13px] font-semibold text-[var(--ink)]">
                  Offline Portable Bundle (.gitprism.json)
                </h4>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[9.5px] text-[#3DE0A6]">
                Zero Cloud Required
              </span>
            </div>

            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
              Export the full workspace (all source files, AST analysis, and Git commit DAG) into a lightweight portable file. Send it over Slack or email; teammates drag & drop it directly into GitPrism.
            </p>

            <button
              type="button"
              onClick={() => {
                onExportBundle();
                onClose();
              }}
              className="mt-3 btn btn-ghost btn-sm flex w-full items-center justify-center gap-2 border border-[var(--amber)]/30 bg-[var(--amber)]/10 text-[var(--amber)] hover:bg-[var(--amber)]/20"
            >
              <Download size={13} />
              <span>Download Workspace Bundle (.gitprism.json)</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-[var(--line)] pt-3 text-[11px] font-mono text-[var(--ink-3)]">
          <span className="flex items-center gap-1.5">
            <HardDrive size={12} className="text-[#3DE0A6]" />
            <span>Local-First Architecture</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--ink-3)] hover:text-[var(--ink)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
