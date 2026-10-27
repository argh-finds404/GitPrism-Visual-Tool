"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Lightbulb, Minus, Pause, Play, Plus, SkipBack, SkipForward, Undo2 } from "lucide-react";
import { useRepository } from "@/features/repository/RepositoryProvider";
import { blobContent, commitFiles, currentBranch, fileStatuses, getCommit, headCommitId, reachableCommits } from "@/features/repository/engine";
import { challenges } from "@/features/repository/challenges";
import { DiffLines, ModeSwitch } from "@/components/diff/DiffLines";
import { useWorkbench, type BottomTab } from "@/components/workbench/WorkbenchContext";
import { formatTime, Glyph, StatusLetter } from "@/components/workbench/bits";
import { short } from "@/lib/git";
import { usePrefersReducedMotion } from "@/lib/theme";

const tabs: { id: BottomTab; label: string }[] = [
  { id: "changes", label: "Changes" },
  { id: "history", label: "History" },
  { id: "compare", label: "Compare" },
  { id: "replay", label: "Replay" },
  { id: "explain", label: "Explain" },
];

export function BottomPanel({ mobile = false }: { mobile?: boolean }) {
  const wb = useWorkbench();
  const { state } = useRepository();
  const pending = useMemo(() => fileStatuses(state).filter((s) => s.staged || s.unstaged).length, [state]);
  const open = mobile || wb.bottomOpen;

  return (
    <section aria-label="Timeline and changes" className="flex h-full min-h-0 flex-col border-t border-line bg-paper">
      <div className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-line px-2" role="tablist" aria-label="Bottom panel">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={open && wb.bottomTab === t.id}
            onClick={() => wb.showBottom(t.id)}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] text-ink-3 hover:text-ink aria-selected:bg-surface aria-selected:font-medium aria-selected:text-ink aria-selected:shadow-[0_0_0_1px_var(--line)]"
          >
            {t.label}
            {t.id === "changes" && pending > 0 && (
              <span className="rounded-full bg-violet px-1.5 text-[10px] font-medium text-white">{pending}</span>
            )}
          </button>
        ))}
        {!mobile && (
          <button
            type="button"
            onClick={() => wb.setBottomOpen(!wb.bottomOpen)}
            aria-label={wb.bottomOpen ? "Collapse panel" : "Expand panel"}
            aria-expanded={wb.bottomOpen}
            className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-violet-wash hover:text-violet-ink"
          >
            {wb.bottomOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        )}
      </div>
      {open && (
        <div className="min-h-0 flex-1 overflow-hidden" role="tabpanel">
          {wb.bottomTab === "changes" && <ChangesTab />}
          {wb.bottomTab === "history" && <HistoryTab />}
          {wb.bottomTab === "compare" && <CompareTab />}
          {wb.bottomTab === "replay" && <ReplayTab />}
          {wb.bottomTab === "explain" && <ExplainTab />}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Changes: stage, review, commit                                      */
/* ------------------------------------------------------------------ */

function ChangeRow({ path, kind, area, selected }: { path: string; kind: string; area: "staged" | "unstaged"; selected: boolean }) {
const { replaying } = useRepository();
const wb = useWorkbench();
return (
  <li className="group flex items-center gap-1 rounded-lg hover:bg-surface">
    <button
      type="button"
      onClick={() => wb.setChange({ path, area })}
      aria-pressed={selected}
      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left aria-pressed:bg-violet-wash"
    >
      <StatusLetter kind={kind} staged={area === "staged"} />
      <span className="truncate font-mono text-[12px]">{path}</span>
    </button>
    <button
      type="button"
      disabled={replaying}
      onClick={() => wb.exec({ type: area === "staged" ? "UNSTAGE_PATHS" : "STAGE_PATHS", paths: [path] })}
      aria-label={`${area === "staged" ? "Unstage" : "Stage"} ${path}`}
      title={area === "staged" ? "Unstage" : "Stage"}
      className="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded text-ink-3 hover:bg-violet-wash hover:text-violet-ink disabled:opacity-40"
    >
      {area === "staged" ? <Minus size={13} /> : <Plus size={13} />}
    </button>
  </li>
);
}

function ChangesTab() {
  const { state, replaying } = useRepository();
  const wb = useWorkbench();
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"unified" | "split">("unified");
  const statuses = useMemo(() => fileStatuses(state), [state]);
  const staged = statuses.filter((s) => s.staged);
  const unstaged = statuses.filter((s) => s.unstaged);
  const headFiles = useMemo(() => commitFiles(state, headCommitId(state)), [state]);
  const sel = wb.change && statuses.some((s) => s.path === wb.change!.path && (wb.change!.area === "staged" ? s.staged : s.unstaged)) ? wb.change : staged[0] ? { path: staged[0].path, area: "staged" as const } : unstaged[0] ? { path: unstaged[0].path, area: "unstaged" as const } : null;

  const before = sel ? (sel.area === "staged" ? blobContent(state, headFiles[sel.path]) : blobContent(state, state.index[sel.path])) ?? "" : "";
  const after = sel ? (sel.area === "staged" ? blobContent(state, state.index[sel.path]) : state.worktree[sel.path]) ?? "" : "";


  return (
    <div className="grid h-full min-h-0 md:grid-cols-[300px_1fr]">
      <div className="flex min-h-0 flex-col border-b border-line md:border-b-0 md:border-r">
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <h3 className="flex items-center justify-between px-2 py-1 text-[11.5px] font-semibold text-ink-2">
            Staged, ready to commit <span className="font-normal text-ink-3">{staged.length}</span>
          </h3>
          {staged.length ? (
            <ul>{staged.map((s) => <ChangeRow key={`s${s.path}`} path={s.path} kind={s.staged!} area="staged" selected={sel?.path === s.path && sel.area === "staged"} />)}</ul>
          ) : (
            <p className="px-2 pb-2 text-[12px] text-ink-3">Nothing staged. Stage a change to include it in the next commit.</p>
          )}
          <h3 className="mt-2 flex items-center justify-between px-2 py-1 text-[11.5px] font-semibold text-ink-2">
            Not staged
            <span className="flex items-center gap-2 font-normal text-ink-3">
              {unstaged.length > 0 && (
                <button
                  type="button"
                  disabled={replaying}
                  onClick={() => wb.exec({ type: "STAGE_PATHS", paths: unstaged.map((s) => s.path) })}
                  className="text-violet-ink hover:underline disabled:opacity-40"
                >
                  Stage all
                </button>
              )}
              {unstaged.length}
            </span>
          </h3>
          {unstaged.length ? (
            <ul>{unstaged.map((s) => <ChangeRow key={`u${s.path}`} path={s.path} kind={s.unstaged!} area="unstaged" selected={sel?.path === s.path && sel.area === "unstaged"} />)}</ul>
          ) : (
            <p className="px-2 text-[12px] text-ink-3">The working tree matches the index.</p>
          )}
        </div>
        <form
          className="border-t border-line p-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (wb.exec({ type: "COMMIT", message, timestamp: Math.floor(Date.now() / 1000) })) {
              setMessage("");
              wb.setView("history");
              wb.notify("Commit created. The new node is highlighted on the canvas.", "info");
            }
          }}
        >
          <label htmlFor="commit-msg" className="sr-only">
            Commit message
          </label>
          <div className="flex gap-1.5">
            <input
              id="commit-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Message for ${currentBranch(state) ?? "HEAD"}`}
              maxLength={100}
              disabled={replaying}
              className="h-8 min-w-0 flex-1 rounded-lg border border-line-2 bg-surface px-2.5 text-[12.5px] outline-none focus:border-violet"
            />
            <button type="submit" disabled={replaying} className="h-8 shrink-0 rounded-lg bg-ink px-3 text-[12px] font-medium text-paper disabled:opacity-40">
              Commit
            </button>
          </div>
        </form>
      </div>
      <div className="flex min-h-0 flex-col">
        <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line px-3 text-[11.5px] text-ink-3">
          <span className="truncate">
            {sel ? (
              sel.area === "staged" ? (
                <>
                  <span className="font-mono text-ink">{sel.path}</span>: last commit → index (what the next commit records)
                </>
              ) : (
                <>
                  <span className="font-mono text-ink">{sel.path}</span>: index → working tree (not staged yet)
                </>
              )
            ) : (
              "Select a change to review it"
            )}
          </span>
          <ModeSwitch mode={mode} setMode={setMode} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto py-1">
          {sel ? (
            <DiffLines before={before} after={after} mode={mode} emptyText="Only the file's presence changed." />
          ) : (
            <p className="px-4 py-6 text-[12.5px] text-ink-3">No changes yet. Open a file from the explorer and edit it.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* History list                                                        */
/* ------------------------------------------------------------------ */

function HistoryTab() {
  const { state } = useRepository();
  const wb = useWorkbench();
  const commits = useMemo(() => reachableCommits(state).reverse(), [state]);
  const head = headCommitId(state);
  const sel = wb.selection?.kind === "object" ? wb.selection.oid : null;
  return (
    <ol className="h-full overflow-y-auto p-2">
      {commits.map((c) => {
        const refs = Object.entries(state.branches).filter(([, t]) => t === c.oid).map(([b]) => b);
        return (
          <li key={c.oid}>
            <button
              type="button"
              onClick={() => wb.select({ kind: "object", oid: c.oid })}
              aria-pressed={sel === c.oid}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface aria-pressed:bg-violet-wash"
            >
              <Glyph kind="commit" size={11} filled={c.oid === head} />
              <span className="font-mono text-[11.5px] text-ink-2">{short(c.oid)}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px]">{c.message}</span>
              {refs.map((r) => (
                <span key={r} className="hidden rounded-full border border-[color:var(--c-ref)] px-1.5 font-mono text-[10.5px] text-[color:var(--c-ref)] sm:inline">
                  {r}
                </span>
              ))}
              <span className="hidden text-[11px] text-ink-3 md:inline">{formatTime(c.timestamp)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Compare two commits                                                 */
/* ------------------------------------------------------------------ */

function CommitPicker({ label, value, onChange, commits }: { label: string; value: string | null; onChange: (v: string) => void; commits: { oid: string; message: string }[] }) {
return (
  <label className="flex min-w-0 flex-1 items-center gap-2 text-[11.5px] text-ink-3">
    {label}
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 min-w-0 flex-1 rounded-lg border border-line-2 bg-surface px-1.5 font-mono text-[11.5px] text-ink outline-none focus:border-violet"
    >
      {commits.map((c) => (
        <option key={c.oid} value={c.oid}>
          {short(c.oid)} {c.message}
        </option>
      ))}
    </select>
  </label>
);
}

function CompareTab() {
  const { state } = useRepository();
  const wb = useWorkbench();
  const [mode, setMode] = useState<"unified" | "split">("unified");
  const [line, setLine] = useState<{ old?: string; new?: string } | null>(null);
  const commits = useMemo(() => reachableCommits(state).reverse(), [state]);
  const head = headCommitId(state);
  const base = wb.compare.base && getCommit(state, wb.compare.base) ? wb.compare.base : getCommit(state, head)?.parents[0] ?? head;
  const target = wb.compare.target && getCommit(state, wb.compare.target) ? wb.compare.target : head;

  const a = useMemo(() => commitFiles(state, base), [state, base]);
  const b = useMemo(() => commitFiles(state, target), [state, target]);
  const files = useMemo(() => {
    const paths = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
    return paths
      .map((p) => ({ path: p, kind: !a[p] ? "added" : !b[p] ? "deleted" : a[p] !== b[p] ? "modified" : null, old: a[p], new: b[p] }))
      .filter((f) => f.kind);
  }, [a, b]);
  const path = wb.compare.path && files.some((f) => f.path === wb.compare.path) ? wb.compare.path : files[0]?.path ?? null;
  const file = files.find((f) => f.path === path);


  return (
    <div className="grid h-full min-h-0 md:grid-cols-[300px_1fr]">
      <div className="flex min-h-0 flex-col border-b border-line md:border-b-0 md:border-r">
        <div className="space-y-1.5 border-b border-line p-2">
          <CommitPicker label="Base" value={base} commits={commits} onChange={(v) => { wb.setCompare({ base: v, path: null }); setLine(null); }} />
          <CommitPicker label="Target" value={target} commits={commits} onChange={(v) => { wb.setCompare({ target: v, path: null }); setLine(null); }} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <p className="px-2 pb-1 text-[11.5px] text-ink-3">
            {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} differ. Renames show as a deletion plus an addition.` : "These snapshots have identical trees."}
          </p>
          <ul>
            {files.map((f) => (
              <li key={f.path}>
                <button
                  type="button"
                  onClick={() => {
                    wb.setCompare({ path: f.path });
                    setLine(null);
                  }}
                  aria-pressed={f.path === path}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-surface aria-pressed:bg-violet-wash"
                >
                  <StatusLetter kind={f.kind!} />
                  <span className="truncate font-mono text-[12px]">{f.path}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex min-h-0 flex-col">
        <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-line px-3 text-[11.5px] text-ink-3">
          <span className="truncate">
            {line ? (
              <>
                Old blob {line.old ? <button type="button" className="font-mono text-violet-ink hover:underline" onClick={() => wb.select({ kind: "object", oid: line.old! })}>{short(line.old)}</button> : "none"}
                {" → "}new blob {line.new ? <button type="button" className="font-mono text-violet-ink hover:underline" onClick={() => wb.select({ kind: "object", oid: line.new! })}>{short(line.new)}</button> : "none"}
              </>
            ) : (
              "Click a changed line to see which blobs hold each version."
            )}
          </span>
          <ModeSwitch mode={mode} setMode={setMode} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto py-1">
          {file ? (
            <DiffLines
              before={blobContent(state, file.old) ?? ""}
              after={blobContent(state, file.new) ?? ""}
              mode={mode}
              onLine={() => setLine({ old: file.old, new: file.new })}
            />
          ) : (
            <p className="px-4 py-6 text-[12.5px] text-ink-3">Pick two different commits to compare.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Replay                                                              */
/* ------------------------------------------------------------------ */

function ReplayTab() {
  const repo = useRepository();
  const reduce = usePrefersReducedMotion();
  const [playRequested, setPlaying] = useState(false);
  const last = repo.steps.length - 1;
  // Playback stops by itself at the last step.
  const playing = playRequested && repo.cursor < last;
  const { cursor, setCursor } = repo;

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setCursor(cursor + 1), reduce ? 400 : 1300);
    return () => clearTimeout(t);
  }, [playing, cursor, setCursor, reduce]);

  if (last === 0)
    return (
      <p className="p-4 text-[12.5px] leading-relaxed text-ink-3">
        Replay records what you do in the lab: edits, staging, commits and branches. Make a change, then come back to step through it.
      </p>
    );

  const step = repo.steps[repo.cursor];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <button type="button" onClick={() => repo.setCursor(repo.cursor - 1)} disabled={repo.cursor === 0} aria-label="Previous step" className="grid h-7 w-7 place-items-center rounded-lg text-ink-2 hover:bg-violet-wash disabled:opacity-35">
          <SkipBack size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (repo.cursor >= last) repo.setCursor(0);
            setPlaying(!playing);
          }}
          aria-label={playing ? "Pause replay" : "Play replay"}
          className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-paper"
        >
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
        <button type="button" onClick={() => repo.setCursor(repo.cursor + 1)} disabled={repo.cursor >= last} aria-label="Next step" className="grid h-7 w-7 place-items-center rounded-lg text-ink-2 hover:bg-violet-wash disabled:opacity-35">
          <SkipForward size={14} />
        </button>
        <label htmlFor="replay-scrub" className="sr-only">
          Replay position
        </label>
        <input
          id="replay-scrub"
          type="range"
          min={0}
          max={last}
          value={repo.cursor}
          onChange={(e) => {
            setPlaying(false);
            repo.setCursor(Number(e.target.value));
          }}
          className="min-w-[120px] flex-1 accent-[var(--violet)]"
        />
        <span className="font-mono text-[11.5px] text-ink-3">
          {repo.cursor}/{last}
        </span>
        {repo.replaying && (
          <button type="button" onClick={() => { setPlaying(false); repo.setCursor(last); }} className="h-7 rounded-lg border border-line-2 px-2.5 text-[11.5px] hover:border-violet">
            Back to latest
          </button>
        )}
      </div>
      <div className="grid min-h-0 flex-1 md:grid-cols-[1fr_1.2fr]">
        <ol className="min-h-0 overflow-y-auto border-b border-line p-2 md:border-b-0 md:border-r">
          {repo.steps.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => repo.setCursor(i)}
                aria-current={i === repo.cursor ? "step" : undefined}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[12px] hover:bg-surface aria-[current=step]:bg-violet-wash ${i > repo.cursor ? "text-ink-3" : ""}`}
              >
                <span className="w-5 text-right font-mono text-[10.5px] text-ink-3">{i}</span>
                <span className="truncate">{s.event?.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="overflow-y-auto p-4">
          <p className="text-[11.5px] text-ink-3">Step {repo.cursor}</p>
          <h3 className="mt-0.5 text-[14px] font-semibold">{step.event?.title}</h3>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{step.event?.detail}</p>
          {repo.replaying && <p className="mt-3 text-[11.5px] text-ink-3">The graph, explorer and inspector show the repository as it was at this step. Editing is paused.</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Explain + guided challenges                                         */
/* ------------------------------------------------------------------ */

function ExplainTab() {
  const repo = useRepository();
  const wb = useWorkbench();
  const [hint, setHint] = useState<string | null>(null);
  const step = repo.steps[repo.cursor];
  const head = headCommitId(repo.state);
  const branch = currentBranch(repo.state);

  return (
    <div className="grid h-full min-h-0 md:grid-cols-2">
      <div className="overflow-y-auto border-b border-line p-4 md:border-b-0 md:border-r">
        <p className="text-[11.5px] text-ink-3">What just happened</p>
        <h3 className="mt-0.5 text-[14px] font-semibold">{step.event?.title}</h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{step.event?.detail}</p>
        <p className="mt-4 text-[12px] leading-relaxed text-ink-3">
          Right now HEAD {branch ? <>refers to <span className="font-mono text-ink">{branch}</span>, which points at</> : "points directly at"}{" "}
          <span className="font-mono text-ink">{head ? short(head) : "nothing"}</span>. Commits are immutable; only branch names move.
        </p>
      </div>
      <div className="overflow-y-auto p-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-[12px] font-semibold">Challenges</p>
          <span className="text-[11.5px] text-ink-3">
            {repo.completed.length}/{challenges.length} done
          </span>
        </div>
        <ul className="mt-1.5 space-y-1">
          {challenges.map((c) => {
            const done = repo.completed.includes(c.id);
            return (
              <li key={c.id} className="rounded-lg px-2 py-1.5 hover:bg-surface">
                <div className="flex items-start gap-2">
                  {done ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-add" /> : <Circle size={15} className="mt-0.5 shrink-0 text-ink-3" />}
                  <div className="min-w-0 flex-1">
                    <p className={`text-[12.5px] ${done ? "text-ink-2" : "text-ink"}`}>{c.title}</p>
                    {done ? (
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-3">{c.explain}</p>
                    ) : hint === c.id ? (
                      <p className="mt-0.5 text-[11.5px] leading-relaxed text-violet-ink">{c.hint}</p>
                    ) : null}
                  </div>
                  {!done && (
                    <button type="button" onClick={() => setHint(hint === c.id ? null : c.id)} className="grid h-6 w-6 shrink-0 place-items-center rounded text-ink-3 hover:text-violet-ink" aria-label={`Hint for: ${c.title}`}>
                      <Lightbulb size={13} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {repo.canUndo && (
          <button type="button" onClick={repo.undo} className="mt-3 flex items-center gap-1.5 px-2 text-[11.5px] text-ink-3 hover:text-ink">
            <Undo2 size={12} /> Undo last action
          </button>
        )}
        {!wb.guided && <p className="mt-2 px-2 text-[11px] text-ink-3">Turn on guided mode to see the current challenge on the canvas.</p>}
      </div>
    </div>
  );
}
