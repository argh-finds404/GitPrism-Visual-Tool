"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { resolveFile, type Origin } from "@/features/mergelab/merge";
import { M, useMergeLab } from "./store";

const ORIGIN: Record<Origin, { label: string; color: string }> = {
  base: { label: "", color: "transparent" },
  ours: { label: "ours", color: M.ours },
  theirs: { label: "theirs", color: M.theirs },
  both: { label: "both", color: M.base },
  resolved: { label: "chosen", color: M.resolved },
  conflict: { label: "conflict", color: M.red },
};

const STATUS_TEXT: Record<string, string> = {
  unchanged: "Neither branch changed this file.",
  ours: "Only our branch changed this file, so the merge takes our version.",
  theirs: "Only their branch changed this file, so the merge takes their version.",
  same: "Both branches made the same change.",
  merged: "Both branches changed this file in different places. Git merges it without conflicts; the gutter shows where each line came from.",
  conflict: "Both branches changed the same lines. Resolve the conflicts, or edit the whole file.",
  "add-add": "Both branches added this file with different content.",
  "modify-delete": "One branch deleted this file and the other changed it.",
};

/** One file of the merge result, line by line, with each line's origin. Editable as a whole. */
export function FileView({ path }: { path: string }) {
  const { m, resolutions, fileEdits, editFile, select } = useMergeLab();
  const fm = m.files.find((f) => f.path === path)!;
  const [draft, setDraft] = useState<string | null>(null);
  const edited = path in fileEdits;
  const lines = resolveFile(fm, resolutions);
  const text = edited ? fileEdits[path] : lines?.map((l) => l.text).join("\n") + "\n";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-[#9a90ad]">merged file</p>
          <h2 className="display truncate text-[clamp(1.25rem,2vw,1.8rem)] text-white">{path.split("/").pop()}</h2>
          <p className="mt-0.5 max-w-[46rem] text-[12.5px] text-[#c9c0d8]">{edited ? "Edited by hand. The text below replaces the merge result for this file." : STATUS_TEXT[fm.status]}</p>
        </div>
        {lines !== null && draft === null && (
          <div className="flex gap-2">
            {edited && (
              <button type="button" onClick={() => editFile(path, undefined)} className="h-8 rounded-full border border-white/15 px-3 text-[12px] text-[#c9c0d8] hover:text-white">
                Discard edit
              </button>
            )}
            <button type="button" onClick={() => setDraft(text)} className="flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[12px] text-[#c9c0d8] hover:border-[#3DE0A6] hover:text-white">
              <Pencil size={13} /> Edit file
            </button>
          </div>
        )}
      </header>

      {draft !== null ? (
        <div className="hud flex min-h-0 flex-1 flex-col p-3">
          {fm.conflicts.length > 0 && (
            <p className="mb-2 text-[11.5px] text-[#FFD99A]">Saving a whole-file edit replaces this file&apos;s conflict resolutions. Its conflicts then count as resolved by hand.</p>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            aria-label={`Edit ${path}`}
            className="min-h-[300px] flex-1 resize-none rounded-lg border border-white/12 bg-[#0e0b19] p-3 font-mono text-[12px] leading-[1.6] text-white outline-none focus:border-[#3DE0A6]"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => (editFile(path, draft), setDraft(null))} className="h-8 rounded-full bg-[#3DE0A6] px-4 text-[12.5px] font-medium text-[#06110c]">
              Save edit
            </button>
            <button type="button" onClick={() => setDraft(null)} className="h-8 rounded-full border border-white/15 px-4 text-[12.5px] text-[#c9c0d8]">
              Cancel
            </button>
          </div>
        </div>
      ) : lines === null ? (
        <p className="hud p-5 text-[13px] text-[#c9c0d8]">The merge result deletes this file.</p>
      ) : (
        <div className="hud min-h-0 flex-1 overflow-auto py-2 font-mono text-[12px] leading-[1.65]">
          {(edited ? fileEdits[path].replace(/\n$/, "").split("\n").map((t) => ({ text: t, origin: "resolved" as Origin, conflict: undefined })) : lines).map((l, k) => {
            const o = ORIGIN[l.origin];
            return (
              <div
                key={k}
                className="grid grid-cols-[3rem_4.2rem_1fr] pr-4"
                style={{ background: l.origin === "conflict" ? "rgb(255 122 144 / 0.1)" : l.origin === "base" ? undefined : `${o.color}12` }}
              >
                <span className="select-none pr-2 text-right text-[#6f6782]">{k + 1}</span>
                <span className="select-none border-l-2 pl-2 text-[10px] leading-[1.95]" style={{ borderColor: o.color, color: o.color }}>
                  {l.conflict && l.origin === "conflict" ? (
                    <button type="button" onClick={() => select({ kind: "conflict", id: l.conflict! })} className="underline decoration-dotted">
                      resolve
                    </button>
                  ) : (
                    o.label
                  )}
                </span>
                <span className="whitespace-pre text-[#e7e1f2]">{l.text || " "}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
