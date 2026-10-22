"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, CircleAlert, FolderGit2, GitBranch, GraduationCap, Loader2, Moon, RotateCcw, Sun, Undo2 } from "lucide-react";
import { PrismMark } from "@/components/brand/PrismMark";
import { useRepository } from "@/features/repository/RepositoryProvider";
import { commitFiles, currentBranch, headCommitId, reachableCommits } from "@/features/repository/engine";
import { setTheme, useTheme } from "@/lib/theme";
import { short } from "@/lib/git";
import { useWorkbench } from "./WorkbenchContext";
import { ConfirmDialog } from "./bits";

export function Header() {
  const repo = useRepository();
  const wb = useWorkbench();
  const theme = useTheme();
  const [confirmReset, setConfirmReset] = useState(false);
  const { state } = repo;
  const branch = currentBranch(state);
  const head = headCommitId(state);
  const commits = reachableCommits(state).length;
  const files = Object.keys(commitFiles(state, head)).length;
  const userCommits = repo.steps.filter((s) => s.command?.type === "COMMIT").length;
  const actions = repo.steps.length - 1;

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-paper px-3 md:px-4">
      <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg" aria-label="GitPrism home">
        <PrismMark className="h-6 w-6" />
        <span className="hidden text-[14px] font-semibold tracking-[-0.01em] sm:inline">GitPrism</span>
      </Link>
      <span className="hidden text-line-2 sm:inline" aria-hidden="true">
        /
      </span>
      <div className="flex min-w-0 items-center gap-2">
        <FolderGit2 size={16} className="hidden shrink-0 text-violet md:block" />
        <div className="min-w-0">
          <h1 className="truncate text-[13.5px] font-semibold">{state.name}</h1>
          <p className="hidden truncate text-[11.5px] text-ink-3 md:block">
            <GitBranch size={11} className="mr-1 inline -translate-y-px text-[color:var(--c-ref)]" />
            {branch ?? `detached at ${head ? short(head) : "nothing"}`}, {commits} commits, {files} files
          </p>
        </div>
      </div>

      {repo.replaying && (
        <button
          type="button"
          onClick={() => repo.setCursor(repo.steps.length - 1)}
          className="ml-2 hidden h-7 shrink-0 items-center rounded-full bg-[color:var(--c-ref)]/15 px-3 text-[11.5px] font-medium text-[color:var(--c-ref)] md:flex"
        >
          Viewing step {repo.cursor} of {repo.steps.length - 1}. Back to latest
        </button>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <SaveBadge />
        <span
          className="mr-1 hidden rounded-full border border-line-2 px-2.5 py-1 text-[11px] text-ink-2 xl:inline"
          title="Objects are encoded exactly like Git, so IDs match git hash-object. The repository itself is simulated in your browser: no merging, remotes or packing."
        >
          Simulated repository, real object IDs
        </span>
        <button
          type="button"
          onClick={repo.undo}
          disabled={!repo.canUndo}
          aria-label="Undo last action"
          title="Undo last action"
          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] text-ink-2 hover:bg-violet-wash disabled:opacity-35"
        >
          <Undo2 size={15} /> <span className="hidden lg:inline">Undo</span>
        </button>
        <button
          type="button"
          onClick={() => (actions ? setConfirmReset(true) : null)}
          disabled={!actions}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] text-ink-2 hover:bg-violet-wash disabled:opacity-35"
          aria-label="Reset lab"
          title="Reset lab"
        >
          <RotateCcw size={15} /> <span className="hidden lg:inline">Reset lab</span>
        </button>
        <button
          type="button"
          aria-pressed={wb.guided}
          onClick={() => {
            wb.setGuided(!wb.guided);
            if (!wb.guided) wb.showBottom("explain");
          }}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-ink-2 hover:bg-violet-wash aria-pressed:bg-ink aria-pressed:text-paper"
        >
          <GraduationCap size={15} /> <span className="hidden sm:inline">Guided mode</span>
        </button>
        <button
          type="button"
          onClick={(e) => setTheme(theme === "dark" ? "light" : "dark", { x: e.clientX, y: e.clientY })}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} appearance`}
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 hover:bg-violet-wash"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset the lab?"
        confirmLabel="Reset lab"
        onConfirm={() => {
          repo.reset();
          wb.select(null);
          wb.closeFile();
          wb.notify("The sample repository is back to its starting state.", "info");
        }}
        onClose={() => setConfirmReset(false)}
      >
        This removes {actions} recorded action{actions === 1 ? "" : "s"}
        {userCommits ? `, including ${userCommits} commit${userCommits === 1 ? "" : "s"} you made` : ""}, and your challenge progress. The sample
        repository comes back exactly as it started.
      </ConfirmDialog>
    </header>
  );
}

function SaveBadge() {
  const { saveStatus, storageNote } = useRepository();
  if (storageNote)
    return (
      <span className="mr-1 hidden items-center gap-1 text-[11.5px] text-del md:flex" title={storageNote}>
        <CircleAlert size={13} /> Not saved
      </span>
    );
  return (
    <span className="mr-1 hidden items-center gap-1 text-[11.5px] text-ink-3 md:flex" aria-live="polite">
      {saveStatus === "saving" && (
        <>
          <Loader2 size={12} className="animate-spin" /> Saving
        </>
      )}
      {saveStatus === "saved" && (
        <>
          <Check size={13} className="text-add" /> Saved in this browser
        </>
      )}
      {saveStatus === "error" && (
        <>
          <CircleAlert size={13} className="text-del" /> Couldn&apos;t save
        </>
      )}
    </span>
  );
}
