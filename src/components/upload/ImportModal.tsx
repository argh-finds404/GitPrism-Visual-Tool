"use client";

import { useEffect, useState } from "react";
import {
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  HardDrive,
  Layers,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import type { StoredProjectSummary } from "@/features/upload/project-vault";

export function ImportModal({
  isOpen,
  onClose,
  onPickFolder,
  projects,
  onSelectProject,
  onDeleteProject,
}: {
  isOpen: boolean;
  onClose: () => void;
  onPickFolder: () => void;
  projects: StoredProjectSummary[];
  onSelectProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}) {
  const [tab, setTab] = useState<"import" | "vault">("import");

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--line-2)] bg-[#0d0d12] p-6 shadow-2xl shadow-black/80"
      >
        {/* Glow */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-[var(--violet)]/20 blur-3xl"
        />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--violet)]/15 text-[var(--violet-ink)]">
              <FolderOpen size={20} />
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-semibold text-[var(--ink)]">
                Import Repository or Project
              </h2>
              <p className="font-mono text-[11px] text-[var(--ink-3)]">
                Local-first • Uncompressed client storage • Persistent vault
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--ink-3)] hover:bg-white/[0.06] hover:text-[var(--ink)]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switchers if saved projects exist */}
        {projects.length > 0 && (
          <div className="mt-4 flex items-center gap-2 border-b border-[var(--line)] pb-3">
            <button
              type="button"
              onClick={() => setTab("import")}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                tab === "import"
                  ? "bg-[var(--violet)] text-white"
                  : "text-[var(--ink-3)] hover:text-[var(--ink)]"
              }`}
            >
              Upload New Folder
            </button>
            <button
              type="button"
              onClick={() => setTab("vault")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${
                tab === "vault"
                  ? "bg-[var(--violet)] text-white"
                  : "text-[var(--ink-3)] hover:text-[var(--ink)]"
              }`}
            >
              <HardDrive size={13} />
              <span>Saved Projects</span>
              <span className="rounded-full bg-white/20 px-1.5 py-0.2 font-mono text-[10px]">
                {projects.length}
              </span>
            </button>
          </div>
        )}

        {/* Tab 1: Import */}
        {tab === "import" && (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--violet)]/10 text-[var(--violet)]">
                <UploadCloud size={24} />
              </div>
              <h3 className="mt-3 text-[14.5px] font-semibold text-[var(--ink)]">
                Select your project directory
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-[12px] leading-relaxed text-[var(--ink-2)]">
                GitPrism reads your files directly in this browser tab. Heavy dependency folders like{" "}
                <code className="rounded bg-white/5 px-1 font-mono text-[11px] text-[var(--violet-ink)]">
                  node_modules
                </code>{" "}
                are skipped instantly so nothing lags.
              </p>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPickFolder();
                }}
                className="btn btn-primary btn-md mx-auto mt-5"
              >
                <FolderOpen size={16} /> Choose Folder to Open
              </button>
            </div>

            {/* Privacy Guarantee Pill */}
            <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11.5px] text-emerald-300">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" />
              <div>
                <strong className="font-semibold text-emerald-200">100% In-Memory Sandbox:</strong> Files, Git
                commits, and branches are parsed locally on your device and saved into your browser vault. They are
                never sent to remote clouds without your request.
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Vault */}
        {tab === "vault" && (
          <div className="mt-4 space-y-2">
            <p className="text-[12px] text-[var(--ink-3)]">
              Your previous projects are saved uncompressed in your browser vault. Pick one to resume instantly:
            </p>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 transition-colors hover:border-[var(--line-2)] hover:bg-white/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-[13.5px] font-medium text-[var(--ink)]">{p.name}</h4>
                    <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-[var(--ink-3)]">
                      <span className="flex items-center gap-1">
                        <Layers size={11} />
                        {p.fileCount} files
                      </span>
                      {p.commitCount > 0 && (
                        <span className="flex items-center gap-1">
                          <GitCommitHorizontal size={11} />
                          {p.commitCount} commits
                        </span>
                      )}
                      {p.headBranch && (
                        <span className="flex items-center gap-1 text-[var(--violet-ink)]">
                          <GitBranch size={11} />
                          {p.headBranch}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectProject(p.id);
                      }}
                      className="btn btn-ghost btn-sm bg-[var(--violet)]/10 text-[var(--violet-ink)] hover:bg-[var(--violet)] hover:text-white"
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProject(p.id)}
                      className="rounded-lg p-1.5 text-[var(--ink-3)] hover:bg-red-500/10 hover:text-red-400"
                      title="Delete project from vault"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
