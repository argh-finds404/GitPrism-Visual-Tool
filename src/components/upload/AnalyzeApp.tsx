"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  FileCode2,
  FileDown,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  HardDrive,
  Layers,
  Link2Off,
  Loader2,
  Lock,
  Repeat,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { analyze } from "@/features/impact-analysis/analysis-service";
import type { AnalysisResult } from "@/features/impact-analysis/types";
import { collect, LIMITS, type Collected } from "@/features/upload/collect";
import { readLocalGitRepo, type ParsedGitRepo } from "@/features/upload/git-reader";
import { getFilesFromDataTransfer, pickDirectoryNative } from "@/features/upload/drag-drop";
import { useUserAuth } from "@/features/auth/user-auth";
import {
  deleteProjectFromVault,
  downloadProjectBundle,
  getLastActiveProjectId,
  getProjectFromVault,
  listProjectsInVault,
  parseProjectBundle,
  rehydrateGitRepo,
  saveProjectToVault,
  serializeGitRepo,
  setLastActiveProjectId,
  type StoredProjectSummary,
} from "@/features/upload/project-vault";
import { SaveProject } from "./SaveProject";
import { CommitHistoryView } from "./CommitHistoryView";
import { UserIdentityBar } from "./UserIdentityBar";
import { ImportModal } from "./ImportModal";
import { FindingBadge } from "@/components/impact-studio/hud/ui";
import { PrismMark } from "@/components/brand/PrismMark";
import { StudioSwitch } from "@/components/site/StudioSwitch";

/**
 * Analyse a project the user picked from their own machine.
 *
 * The files are read and analysed in this browser; nothing is uploaded. The analyser only ever
 * parses, so no code from the chosen folder is executed — the one thing this application runs is
 * its own bundled fixture.
 */

type State =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "error"; message: string }
  | {
      status: "done";
      picked: Collected;
      result: AnalysisResult;
      name?: string;
      gitRepo?: ParsedGitRepo | null;
    };

/** The picked folder's own name, which collect() strips from the analysed paths. */
function relativeRoot(file: File) {
  const full = (file as File & { webkitRelativePath?: string }).webkitRelativePath || "";
  return full.split("/")[0] || "project";
}

export function AnalyzeApp({ initial }: { initial?: { name: string; files: Record<string, string> } }) {
  const input = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [vaultProjects, setVaultProjects] = useState<StoredProjectSummary[]>([]);
  const { user, updateProfile } = useUserAuth();

  const [state, setState] = useState<State>(() => {
    if (!initial) return { status: "idle" };
    const picked: Collected = {
      files: initial.files,
      skipped: { ignored: 0, notSource: 0, secret: 0, tooBig: 0 },
      truncated: false,
      bytes: Object.values(initial.files).reduce((n, c) => n + c.length, 0),
    };
    return {
      status: "done",
      picked,
      result: analyze(initial.files, initial.files, { base: "upload", head: "upload", layers: [], rules: [] }),
      name: initial.name,
      gitRepo: null,
    };
  });

  const refreshVault = useCallback(async () => {
    const list = await listProjectsInVault(user.id);
    setVaultProjects(list);
    return list;
  }, [user.id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await listProjectsInVault(user.id);
      if (alive) {
        setVaultProjects(list);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user.id]);

  // Auto-restore previously active project on mount
  useEffect(() => {
    if (initial) return;
    let alive = true;
    (async () => {
      const lastId = getLastActiveProjectId();
      if (!lastId) return;
      const project = await getProjectFromVault(lastId);
      if (!alive || !project) return;

      const gitRepo = rehydrateGitRepo(project.gitRepo);
      const picked: Collected = {
        files: project.files,
        skipped: { ignored: 0, notSource: 0, secret: 0, tooBig: 0 },
        truncated: false,
        bytes: project.totalBytes,
      };
      const result = analyze(project.files, project.files, {
        base: "upload",
        head: "upload",
        layers: [],
        rules: [],
      });

      setState({
        status: "done",
        picked,
        result,
        name: project.name,
        gitRepo,
      });
      setCurrentProjectId(project.id);
    })();

    return () => {
      alive = false;
    };
  }, [initial]);

  const handleSelectVaultProject = async (id: string) => {
    setState({ status: "reading" });
    const project = await getProjectFromVault(id);
    if (!project) {
      setState({ status: "error", message: "That project could not be found in your local vault." });
      return;
    }

    const gitRepo = rehydrateGitRepo(project.gitRepo);
    const picked: Collected = {
      files: project.files,
      skipped: { ignored: 0, notSource: 0, secret: 0, tooBig: 0 },
      truncated: false,
      bytes: project.totalBytes,
    };
    const result = analyze(project.files, project.files, {
      base: "upload",
      head: "upload",
      layers: [],
      rules: [],
    });

    setState({
      status: "done",
      picked,
      result,
      name: project.name,
      gitRepo,
    });
    setCurrentProjectId(project.id);
    setLastActiveProjectId(project.id);
    await refreshVault();
  };

  const handleDeleteVaultProject = async (id: string) => {
    await deleteProjectFromVault(id);
    if (currentProjectId === id) {
      setState({ status: "idle" });
      setCurrentProjectId(null);
    }
    await refreshVault();
  };

  const handleImportBundle = async (file: File) => {
    setState({ status: "reading" });
    try {
      const text = await file.text();
      const project = parseProjectBundle(text, user.id);
      await saveProjectToVault(project);
      await refreshVault();
      await handleSelectVaultProject(project.id);
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load project bundle.",
      });
    }
  };

  const handleExportBundle = async (id: string) => {
    const project = await getProjectFromVault(id);
    if (project) {
      downloadProjectBundle(project);
    }
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setState({ status: "reading" });
    try {
      const [picked, gitRepo] = await Promise.all([
        collect(files),
        readLocalGitRepo(files).catch(() => null),
      ]);

      const sourceCount = Object.keys(picked.files).length;
      const hasCommits = !!gitRepo && gitRepo.commits.length > 0;

      if (sourceCount === 0 && !hasCommits) {
        setState({
          status: "error",
          message:
            "No source files or Git repositories found in that folder. GitPrism reads .ts, .tsx, .js and .jsx, and reads your .git folder for commits.",
        });
        return;
      }

      const result = analyze(picked.files, picked.files, {
        base: "upload",
        head: "upload",
        layers: [],
        rules: [],
      });

      const projectName = files[0] ? relativeRoot(files[0]) : "project";
      const projectId = `proj_${Date.now()}_${projectName.replace(/[^a-zA-Z0-9_-]/g, "")}`;

      await saveProjectToVault({
        id: projectId,
        userId: user.id,
        name: projectName,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fileCount: Object.keys(picked.files).length,
        totalBytes: picked.bytes,
        files: picked.files,
        gitRepo: serializeGitRepo(gitRepo),
      });

      if (gitRepo?.contributors?.[0]?.name && user.name === "Developer") {
        updateProfile({
          name: gitRepo.contributors[0].name,
          email: gitRepo.contributors[0].email,
        });
      }

      setState({
        status: "done",
        picked,
        result,
        name: projectName,
        gitRepo,
      });
      setCurrentProjectId(projectId);
      await refreshVault();
    } catch (e) {
      setState({ status: "error", message: (e as Error).message || "That folder could not be read." });
    }
  };

  const onPick = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    await processFiles(Array.from(list));
  };

  const handleOpenPicker = async () => {
    const native = await pickDirectoryNative();
    if (native) {
      if (!native.cancelled && native.files.length > 0) {
        await processFiles(native.files);
      }
      return;
    }
    input.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // If a single file was dropped, check if it's a portable .gitprism.json bundle
    if (e.dataTransfer.files && e.dataTransfer.files.length === 1) {
      const single = e.dataTransfer.files[0];
      if (single.name.endsWith(".gitprism.json") || (single.name.endsWith(".json") && single.size < 50_000_000)) {
        try {
          const text = await single.text();
          const parsed = JSON.parse(text);
          if (parsed.app === "GitPrism" || (parsed.project && parsed.project.files)) {
            await handleImportBundle(single);
            return;
          }
        } catch {
          // not a JSON bundle, fall through to regular processing
        }
      }
    }

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const files = await getFilesFromDataTransfer(e.dataTransfer.items);
      if (files.length > 0) {
        await processFiles(files);
        return;
      }
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <main
      className="studio min-h-[100dvh]"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="border-b border-[var(--line)] px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/" aria-label="GitPrism home">
            <PrismMark className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-[15px] font-semibold leading-tight">Analyse your project</h1>
            <p className="font-mono text-[11px] text-[var(--ink-3)]">
              {state.status === "done"
                ? `${Object.keys(state.result.headFiles).length} files read • ${
                    state.gitRepo ? `${state.gitRepo.totalCommits} Git commits` : "no .git folder"
                  }`
                : "your own folder & Git commits, read locally"}
            </p>
          </div>
          <StudioSwitch current="review" />
          <span className="mr-auto" />
          <div className="flex items-center gap-2">
            {state.status === "done" && (
              <button
                type="button"
                onClick={() => {
                  if (currentProjectId) {
                    handleExportBundle(currentProjectId);
                  } else {
                    downloadProjectBundle({
                      id: "session",
                      userId: user.id,
                      name: state.name ?? "project",
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                      fileCount: Object.keys(state.result.headFiles).length,
                      totalBytes: state.picked.bytes,
                      files: state.result.headFiles,
                      gitRepo: serializeGitRepo(state.gitRepo),
                    });
                  }
                }}
                className="btn btn-ghost btn-sm flex items-center gap-1.5 border border-[var(--line)] bg-surface text-[12px] text-[var(--ink-2)] hover:border-[var(--line-2)] hover:text-[var(--ink)]"
                title="Export current workspace as portable .gitprism.json bundle"
              >
                <FileDown size={14} className="text-[var(--cyan)]" />
                <span className="hidden sm:inline">Export Bundle</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="btn btn-ghost btn-sm flex items-center gap-1.5"
            >
              <FolderOpen size={14} />
              <span>{state.status === "done" ? "Switch project" : "Import project"}</span>
            </button>
            <UserIdentityBar
              user={user}
              projects={vaultProjects}
              currentProjectId={currentProjectId}
              onSelectProject={handleSelectVaultProject}
              onDeleteProject={handleDeleteVaultProject}
              onNewProject={() => setIsModalOpen(true)}
              onUpdateUser={updateProfile}
            />
          </div>
        </div>
      </header>

      {/* webkitdirectory is how a browser offers a folder; it is not a standard attribute name. */}
      <input
        ref={input}
        type="file"
        multiple
        // @ts-expect-error -- directory picking is non-standard but supported where it matters
        webkitdirectory=""
        directory=""
        className="sr-only"
        onChange={(e) => onPick(e.target.files)}
      />

      <ImportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onPickFolder={handleOpenPicker}
        projects={vaultProjects}
        onSelectProject={handleSelectVaultProject}
        onDeleteProject={handleDeleteVaultProject}
        onImportBundle={handleImportBundle}
        onExportBundle={handleExportBundle}
      />

      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6">
        {state.status === "idle" && (
          <Idle
            onPick={handleOpenPicker}
            onOpenModal={() => setIsModalOpen(true)}
            isDragging={isDragging}
            savedProjectsCount={vaultProjects.length}
          />
        )}
        {state.status === "reading" && <Reading />}
        {state.status === "error" && <Failed message={state.message} onRetry={() => setIsModalOpen(true)} />}
        {state.status === "done" && (
          <Report
            picked={state.picked}
            result={state.result}
            name={state.name ?? "project"}
            gitRepo={state.gitRepo}
          />
        )}
      </div>
    </main>
  );
}

function Idle({
  onPick,
  onOpenModal,
  isDragging,
  savedProjectsCount,
}: {
  onPick: () => void;
  onOpenModal: () => void;
  isDragging: boolean;
  savedProjectsCount: number;
}) {
  return (
    <div
      className={`hud relative mx-auto max-w-2xl p-8 text-center transition-all duration-300 ${
        isDragging
          ? "border-[var(--violet)] bg-[var(--violet-wash)]/40 shadow-2xl shadow-[var(--violet)]/20 scale-[1.01]"
          : ""
      }`}
    >
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--violet)]/12 text-[var(--violet)]">
        {isDragging ? <UploadCloud size={30} className="animate-bounce" /> : <FolderOpen size={28} />}
      </div>

      <h2 className="mt-4 text-xl font-semibold text-[var(--ink)]">
        {isDragging ? "Drop your repository folder or bundle here" : "Pick or drop your repository folder"}
      </h2>
      <p className="mx-auto mt-3 max-w-prose text-[13.5px] leading-relaxed text-[var(--ink-2)]">
        Select or drag a local project folder or portable <code className="font-mono text-[12px] text-[var(--cyan)]">.gitprism.json</code> bundle into this window. GitPrism reads your files in the browser,
        extracts your real <strong className="text-[var(--violet-ink)] font-medium">Git commit history</strong>, maps
        branches, and analyzes dependencies and architecture cycles.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={onOpenModal} className="btn btn-primary btn-md">
          <FolderOpen size={16} /> Choose project folder
        </button>
        {savedProjectsCount > 0 && (
          <button
            type="button"
            onClick={onOpenModal}
            className="btn btn-ghost btn-md border border-[var(--violet)]/30 bg-[var(--violet)]/10 text-[var(--violet-ink)] hover:bg-[var(--violet)]/20"
          >
            <HardDrive size={15} /> Resume saved project ({savedProjectsCount})
          </button>
        )}
        <span className="font-mono text-[12px] text-[var(--ink-3)]">
          or drag and drop folder / bundle, or{" "}
          <button
            type="button"
            onClick={onPick}
            className="underline hover:text-[var(--ink)]"
          >
            browse directly
          </button>
        </span>
      </div>

      <div className="mt-8 space-y-2 text-left border-t border-[var(--line)] pt-6">
        <p className="flex items-start gap-2.5 text-[12.5px] text-[var(--ink-2)]">
          <GitCommitHorizontal size={15} className="mt-0.5 shrink-0 text-[var(--violet)]" />
          <span>
            <strong className="font-medium text-[var(--ink)]">Git commits & branches:</strong> Reconstructs your
            real commit DAG and file diffs from your <code className="font-mono text-[11px] text-[var(--violet-ink)]">.git</code> folder.
          </span>
        </p>
        <p className="flex items-start gap-2.5 text-[12.5px] text-[var(--ink-2)]">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#3DE0A6]" />
          <span>
            <strong className="font-medium text-[var(--ink)]">100% Client-Side:</strong> Read and analysed in this
            browser. Your code and Git history are never uploaded to remote servers.
          </span>
        </p>
        <p className="flex items-start gap-2.5 text-[12.5px] text-[var(--ink-2)]">
          <Lock size={15} className="mt-0.5 shrink-0 text-[#3DE0A6]" />
          <span>
            <strong className="font-medium text-[var(--ink)]">Persistent Local Vault:</strong> Projects are safely
            persisted in IndexedDB on your device with portable <code className="font-mono text-[11px] text-[var(--cyan)]">.gitprism.json</code> bundle support.
          </span>
        </p>
        <p className="flex items-start gap-2.5 text-[12.5px] text-[var(--ink-3)]">
          <FileCode2 size={15} className="mt-0.5 shrink-0" />
          <span>
            Up to {LIMITS.files} source files. <code className="font-mono text-[11px]">node_modules</code> and secret
            patterns are automatically excluded.
          </span>
        </p>
      </div>
    </div>
  );
}

function Reading() {
  return (
    <div className="hud mx-auto max-w-2xl p-8 text-center" aria-live="polite">
      <Loader2 size={26} className="mx-auto animate-spin text-[var(--violet)]" />
      <h2 className="mt-4 text-lg font-semibold text-[var(--ink)]">Reading your project</h2>
      <p className="mt-2 text-[13.5px] text-[var(--ink-2)]">
        Parsing Git commits, branches, functions, and import dependencies.
      </p>
    </div>
  );
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="hud mx-auto max-w-2xl p-8 text-center" role="alert">
      <AlertTriangle size={26} className="mx-auto text-[#FFD166]" />
      <h2 className="mt-4 text-lg font-semibold text-[var(--ink)]">Nothing to analyse</h2>
      <p className="mx-auto mt-2 max-w-prose text-[13.5px] leading-relaxed text-[var(--ink-2)]">{message}</p>
      <button type="button" onClick={onRetry} className="btn btn-ghost btn-sm mx-auto mt-5">
        Choose another folder
      </button>
    </div>
  );
}

function downloadArchitectureDossier(
  name: string,
  result: AnalysisResult,
  gitRepo: ParsedGitRepo | null | undefined,
  hubs: { path: string; importedBy: number }[]
) {
  const files = result.nodes.filter((n) => n.kind === "file");
  const symbols = result.nodes.filter((n) => n.kind === "symbol");
  const tests = result.nodes.filter((n) => n.kind === "test");
  const importsCount = result.edges.filter((e) => e.kind === "imports").length;
  const cyclesCount = result.cycles.length;
  const dateStr = new Date().toISOString().split("T")[0];

  const lines: string[] = [
    `# Architecture Dossier: ${name}`,
    `Generated by **GitPrism Local-First Architecture Studio** on ${dateStr}.`,
    "",
    "## 1. Executive Summary",
    `- **Analyzed Source Files**: ${files.length}`,
    `- **Functions / Symbols**: ${symbols.length}`,
    `- **Direct Import Relationships**: ${importsCount}`,
    `- **Test Cases Detected**: ${tests.length}`,
    `- **Import Cycles Detected**: ${cyclesCount}`,
    `- **Unresolved References**: ${result.unresolved.length}`,
    "",
    "## 2. Architectural Choke-Points & Inbound Fan-in",
    "Files with the most importers. Changes to these modules produce the widest blast radius across the system:",
    "",
    "| Module Path | Direct Importers | Architectural Risk |",
    "|:---|:---:|:---|",
  ];

  for (const h of hubs) {
    const risk =
      h.importedBy >= 5
        ? "**Critical Hub** (High Blast Radius)"
        : h.importedBy >= 3
        ? "*Choke-Point* (Moderate Blast Radius)"
        : "Standard Utility";
    lines.push(`| \`${h.path}\` | ${h.importedBy} | ${risk} |`);
  }

  lines.push("");
  lines.push("## 3. Structural Cycles & Coupling Hazards");
  if (result.cycles.length === 0) {
    lines.push("No circular dependency cycles detected. Clean acyclic import hierarchy.");
  } else {
    lines.push("The following circular dependency chains were identified. Circular dependencies impede tree-shaking and create initialization order hazards:");
    lines.push("");
    result.cycles.forEach((cycle, i) => {
      lines.push(`### Cycle #${i + 1}`);
      lines.push("```mermaid");
      lines.push("graph LR");
      for (let j = 0; j < cycle.length; j++) {
        const next = cycle[(j + 1) % cycle.length];
        lines.push(`  "${cycle[j]}" --> "${next}"`);
      }
      lines.push("```");
      lines.push(`Path: ${cycle.join(" → ")}`);
      lines.push("");
    });
  }

  if (gitRepo) {
    lines.push("");
    lines.push("## 4. Git Repository & Velocity Profile");
    lines.push(`- **Active Branch**: \`${gitRepo.headBranch}\``);
    lines.push(`- **Total Analyzed Commits**: ${gitRepo.totalCommits}`);
    lines.push(`- **Distinct Contributors**: ${gitRepo.contributors.length}`);
    lines.push("");
    lines.push("### Top Contributors by Commit Volume");
    lines.push("| Contributor | Commits |");
    lines.push("|:---|:---:|");
    gitRepo.contributors.slice(0, 5).forEach((c) => {
      lines.push(`| ${c.name} (\`${c.email}\`) | ${c.commitCount} |`);
    });
  }

  lines.push("");
  lines.push("---");
  lines.push("*Document generated entirely offline inside the browser with GitPrism. No project files were uploaded to external servers.*");

  const mdText = lines.join("\n");
  const blob = new Blob([mdText], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ARCHITECTURE-${name.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function Report({
  picked,
  result,
  name,
  gitRepo,
}: {
  picked: Collected;
  result: AnalysisResult;
  name: string;
  gitRepo?: ParsedGitRepo | null;
}) {
  const hasCommits = !!gitRepo && gitRepo.commits.length > 0;
  const [activeTab, setActiveTab] = useState<"commits" | "architecture">(() =>
    hasCommits ? "commits" : "architecture"
  );

  const files = result.nodes.filter((n) => n.kind === "file");
  const symbols = result.nodes.filter((n) => n.kind === "symbol");
  const tests = result.nodes.filter((n) => n.kind === "test");

  // Who leans on whom: an import edge points from the importer to the imported file.
  const hubs = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of result.edges) if (e.kind === "imports") count.set(e.target, (count.get(e.target) ?? 0) + 1);
    return files
      .map((f) => ({ path: f.path, importedBy: count.get(f.id) ?? 0 }))
      .sort((a, b) => b.importedBy - a.importedBy)
      .slice(0, 8);
  }, [result, files]);

  const skippedTotal = Object.values(picked.skipped).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      {/* Tab Switcher if Git repo is available */}
      {hasCommits ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line-2)] pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("commits")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-all ${
                activeTab === "commits"
                  ? "bg-[var(--violet)] text-white shadow-md shadow-[var(--violet)]/25"
                  : "border border-[var(--line)] bg-surface text-[var(--ink-2)] hover:border-[var(--line-2)] hover:text-[var(--ink)]"
              }`}
            >
              <GitCommitHorizontal size={15} />
              <span>Git Commit History</span>
              <span
                className={`rounded-full px-1.5 py-0.2 font-mono text-[11px] ${
                  activeTab === "commits" ? "bg-white/20 text-white" : "bg-white/5 text-[var(--ink-3)]"
                }`}
              >
                {gitRepo.totalCommits}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("architecture")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-all ${
                activeTab === "architecture"
                  ? "bg-[var(--violet)] text-white shadow-md shadow-[var(--violet)]/25"
                  : "border border-[var(--line)] bg-surface text-[var(--ink-2)] hover:border-[var(--line-2)] hover:text-[var(--ink)]"
              }`}
            >
              <Layers size={15} />
              <span>Architecture & Topology</span>
              {files.length > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 font-mono text-[11px] ${
                    activeTab === "architecture" ? "bg-white/20 text-white" : "bg-white/5 text-[var(--ink-3)]"
                  }`}
                >
                  {files.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadArchitectureDossier(name, result, gitRepo, hubs)}
              className="btn btn-ghost btn-sm flex items-center gap-1.5 border border-[var(--line)] bg-surface text-[12px] text-[var(--ink-2)] hover:border-[var(--line-2)] hover:text-[var(--ink)]"
              title="Download Markdown summary of architecture, choke-points, and Git stats"
            >
              <FileDown size={14} className="text-[var(--violet)]" />
              <span>Export Dossier (.md)</span>
            </button>
            <span className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-surface px-2.5 py-1 font-mono text-[11px] text-[var(--ink-2)]">
              <GitBranch size={12} className="text-[var(--violet)]" /> {gitRepo.headBranch}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between border-b border-[var(--line-2)] pb-4">
          <h3 className="font-semibold text-[var(--ink)] text-[15px]">
            {name} Architecture & Topology
          </h3>
          <button
            type="button"
            onClick={() => downloadArchitectureDossier(name, result, gitRepo, hubs)}
            className="btn btn-ghost btn-sm flex items-center gap-1.5 border border-[var(--line)] bg-surface text-[12px] text-[var(--ink-2)] hover:border-[var(--line-2)] hover:text-[var(--ink)]"
            title="Download Markdown summary of architecture and choke-points"
          >
            <FileDown size={14} className="text-[var(--violet)]" />
            <span>Export Dossier (.md)</span>
          </button>
        </div>
      )}

      {/* Tab 1: Git Commits View */}
      {hasCommits && activeTab === "commits" && (
        <CommitHistoryView
          repo={gitRepo}
          architectureResult={result}
          onSwitchToArchitecture={() => setActiveTab("architecture")}
        />
      )}

      {/* Tab 2: Architecture View */}
      {(!hasCommits || activeTab === "architecture") && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Stat n={files.length} label="source files" />
            <Stat n={symbols.length} label="functions" />
            <Stat n={result.edges.filter((e) => e.kind === "imports").length} label="imports" />
            <Stat n={tests.length} label="test cases" />
            <Stat n={result.cycles.length} label="import cycles" tone={result.cycles.length ? "warn" : undefined} />
            <Stat n={result.unresolved.length} label="unresolved imports" tone={result.unresolved.length ? "warn" : undefined} />
          </div>

          {(picked.truncated || skippedTotal > 0) && (
            <p className="rounded-xl border border-[var(--line-2)] bg-white/[0.02] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              {picked.truncated && (
                <>
                  <strong className="font-semibold text-[#FFD166]">This is a partial read.</strong> The limit of {LIMITS.files} files
                  or {Math.round(LIMITS.bytes / 1000)} KB was reached, so what you see below describes only part of the project.{" "}
                </>
              )}
              Skipped {skippedTotal}: {picked.skipped.ignored} in ignored directories, {picked.skipped.notSource} not source,{" "}
              {picked.skipped.secret} that looked like secrets, {picked.skipped.tooBig} too large.
            </p>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="hud p-4" aria-labelledby="an-findings">
              <h2 id="an-findings" className="border-b border-[var(--line-2)] pb-3 text-[14px] font-semibold text-[var(--ink)]">
                What the analyser found
              </h2>
              {result.findings.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[var(--ink-3)]">
                  No cycles and no unresolved imports. That is what was checked — not a clean bill of health.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {result.findings.slice(0, 12).map((f) => (
                    <li key={f.id} className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-3">
                      <div className="flex flex-wrap items-start gap-2">
                        <FindingBadge kind={f.kind} />
                        <span className="min-w-0 flex-1 text-[12.5px] text-[var(--ink)]">{f.title}</span>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-2)]">{f.detail}</p>
                      {f.locations[0] && (
                        <p className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">
                          {f.locations[0].path}:{f.locations[0].line}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="hud p-4" aria-labelledby="an-hubs">
              <h2 id="an-hubs" className="border-b border-[var(--line-2)] pb-3 text-[14px] font-semibold text-[var(--ink)]">
                What the project leans on
              </h2>
              <p className="mt-1.5 text-[12.5px] text-[var(--ink-3)]">
                Files with the most importers. A change in one of these reaches furthest.
              </p>
              <ul className="mt-3 space-y-1.5">
                {hubs.map((h) => (
                  <li key={h.path} className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-white/[0.02] px-3 py-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--ink)]">{h.path}</span>
                    <span className="shrink-0 flex items-center gap-2">
                      {h.importedBy >= 3 && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-mono font-medium text-amber-300 border border-amber-500/30">
                          Choke-Point
                        </span>
                      )}
                      <span className="font-mono text-[11px] text-[var(--ink-3)]">
                        {h.importedBy} importer{h.importedBy === 1 ? "" : "s"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {Object.keys(result.headFiles).length > 0 && <SaveProject name={name} files={result.headFiles} />}

          <div className="hud p-4">
            <h2 className="text-[11px] font-semibold text-[var(--ink-3)]">What this does not tell you</h2>
            <ul className="mt-2 space-y-1.5">
              {[
                "Relationships come from explicit relative imports and direct calls by name. Package imports, dynamic imports, re-exports and method calls are not followed.",
                "Nothing was executed. No test was run and no behaviour was observed — this is what the code says, not what it does.",
                "Only TypeScript and JavaScript are parsed. Other languages in the project are invisible here.",
              ].map((l) => (
                <li key={l} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
                  <Link2Off size={13} className="mt-0.5 shrink-0 text-[var(--ink-3)]" />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "warn" }) {
  return (
    <span
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
        tone === "warn"
          ? "border-[#FFB800]/35 bg-[#FFB800]/10 text-[#FFD166]"
          : "border-[var(--line-2)] bg-white/[0.02] text-[var(--ink)]"
      }`}
    >
      {tone === "warn" ? <Repeat size={14} /> : null}
      <span className="font-mono text-[17px] leading-none">{n}</span>
      <span className="text-[12px] text-[var(--ink-3)]">{label}</span>
    </span>
  );
}
