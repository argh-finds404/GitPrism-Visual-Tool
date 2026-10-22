"use client";

import { useMemo, useRef } from "react";
import { Plus, Undo2 } from "lucide-react";
import { useRepository } from "@/features/repository/RepositoryProvider";
import { fileStatuses } from "@/features/repository/engine";
import { useWorkbench } from "@/components/workbench/WorkbenchContext";
import { StatusLetter } from "@/components/workbench/bits";
import { hashBlob, short, splitLines } from "@/lib/git";

export function FileEditor({ path }: { path: string }) {
  const { state, replaying } = useRepository();
  const wb = useWorkbench();
  const gutter = useRef<HTMLDivElement>(null);
  const content = state.worktree[path];
  const status = useMemo(() => fileStatuses(state).find((s) => s.path === path), [state, path]);
  const exists = content !== undefined;
  const liveOid = exists ? hashBlob(content) : null;
  const indexOid = state.index[path];
  const lines = exists ? Math.max(1, splitLines(content).length + (content.endsWith("\n") ? 1 : 0)) : 0;

  if (!exists) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-[13px] text-[#b9b3c8]">
        <div className="max-w-sm">
          <p className="font-mono text-[#e4ddff]">{path}</p>
          <p className="mt-2">This file isn&apos;t in the working tree.{indexOid ? " Git still tracks it, so you can bring it back." : ""}</p>
          {indexOid && (
            <button
              type="button"
              onClick={() => wb.exec({ type: "RESTORE_PATHS", paths: [path] })}
              className="mt-4 h-8 rounded-full bg-[#f3f1f8] px-4 text-[12px] font-medium text-[#191720]"
            >
              Restore from the index
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2b2737] px-4 py-2">
        <div className="flex min-w-0 items-center gap-2 text-[12px]">
          <span className="truncate font-mono text-[#e4ddff]">{path}</span>
          {status?.staged && <StatusLetter kind={status.staged} staged />}
          {status?.unstaged && <StatusLetter kind={status.unstaged} />}
          <span className="hidden text-[#9a94ab] sm:inline">
            {liveOid === indexOid ? "Matches the index" : `If staged: blob ${short(liveOid!)}`}
          </span>
        </div>
        <div className="flex gap-1.5">
          {status?.unstaged && status.unstaged !== "untracked" && (
            <button
              type="button"
              disabled={replaying}
              onClick={() => wb.exec({ type: "RESTORE_PATHS", paths: [path] })}
              className="flex h-7 items-center gap-1.5 rounded-full border border-[#3d384b] px-3 text-[11.5px] text-[#cfcadb] hover:border-[#9579f5] disabled:opacity-40"
            >
              <Undo2 size={12} /> Discard changes
            </button>
          )}
          <button
            type="button"
            disabled={replaying || !status?.unstaged}
            onClick={() => {
              if (wb.exec({ type: "STAGE_PATHS", paths: [path] })) wb.showBottom("changes");
            }}
            className="flex h-7 items-center gap-1.5 rounded-full bg-[#f3f1f8] px-3 text-[11.5px] font-medium text-[#191720] disabled:opacity-40"
          >
            <Plus size={12} /> Stage file
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 font-mono text-[13px] leading-6">
        <div ref={gutter} aria-hidden="true" className="select-none overflow-hidden border-r border-[#2b2737] px-3 py-3 text-right text-[#5f596f]">
          {Array.from({ length: lines }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        <label htmlFor="wb-editor" className="sr-only">
          Contents of {path}
        </label>
        <textarea
          id="wb-editor"
          value={content}
          readOnly={replaying}
          spellCheck={false}
          onChange={(e) => wb.exec({ type: "EDIT_FILE", path, content: e.target.value })}
          onScroll={(e) => gutter.current && (gutter.current.scrollTop = e.currentTarget.scrollTop)}
          onKeyDown={(e) => {
            if (e.key !== "Tab" || e.shiftKey) return;
            e.preventDefault();
            const t = e.currentTarget;
            const v = t.value.slice(0, t.selectionStart) + "  " + t.value.slice(t.selectionEnd);
            const pos = t.selectionStart + 2;
            wb.exec({ type: "EDIT_FILE", path, content: v });
            requestAnimationFrame(() => t.setSelectionRange(pos, pos));
          }}
          className="flex-1 resize-none whitespace-pre bg-transparent px-4 py-3 text-[#ece9f5] caret-[#b6a0ff] outline-none focus-visible:outline-none"
        />
      </div>
      <p className="border-t border-[#2b2737] px-4 py-1.5 text-[11px] text-[#7f7990]">
        {replaying ? "Viewing an earlier step. Editing is paused." : "Edits change the working tree only. Press Tab for spaces; Shift+Tab leaves the editor."}
      </p>
    </div>
  );
}
