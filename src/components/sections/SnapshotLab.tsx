"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check, GitCommitHorizontal, RotateCcw, Save } from "lucide-react";
import { Chapter } from "@/components/ui/Chapter";
import { Aurora } from "@/components/ui/Aurora";
import { useLab } from "@/components/lab/LabProvider";
import { blobHeader, hashBlob, short, splitLines } from "@/lib/git";

export function SnapshotLab() {
  const { working, setWorking, snapshots, save, reset } = useLab();
  const [message, setMessage] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const gutter = useRef<HTMLDivElement>(null);

  const head = snapshots[snapshots.length - 1];
  const liveBlob = useMemo(() => hashBlob(working), [working]);
  const clean = head && head.blob === liveBlob;
  const existing = snapshots.find((s) => s.blob === liveBlob);
  const lines = splitLines(working).length || 1;
  const previewed = snapshots.find((s) => s.oid === preview);

  const onSave = () => {
    const snap = save(message);
    setMessage("");
    setFlash(snap.oid);
    setTimeout(() => setFlash(null), 1800);
  };

  return (
    <section id="playground" aria-labelledby="lab-title" className="relative overflow-hidden py-28 md:py-36">
      <Aurora tones={["violet", "cyan"]} />
      <div className="shell relative">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <Chapter n={3} name="the lab" id="lab-title" title="Save a snapshot. Watch Git name it.">
              <p>
                Edit the file below. The blob ID updates with every keystroke, because the ID is the content. Save, and
                Git records the whole file, not just what changed.
              </p>
            </Chapter>
          </div>
          <p className="text-[0.88rem] text-ink-3 lg:col-span-5 lg:pb-2 lg:text-right">
            A simulated repository running in your browser. IDs are real SHA-1, computed exactly as Git does.
          </p>
        </div>

        <div className="panel mt-14 grid overflow-hidden rounded-[28px] lg:grid-cols-12">
          {/* Editor */}
          <div className="flex flex-col border-b border-line lg:col-span-7 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-paper-2 px-2.5 py-1 font-mono text-[0.82rem] text-ink">hello.txt</span>
                <span className="hidden text-[0.8rem] text-ink-3 sm:inline">Working file</span>
              </div>
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] ${
                  clean ? "bg-add-bg text-add" : "bg-violet-wash text-violet-ink"
                }`}
                aria-live="polite"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${clean ? "bg-add" : "bg-violet"}`} />
                {clean ? "Matches latest snapshot" : "Unsaved changes"}
              </span>
            </div>

            <div className="relative flex min-h-[260px] flex-1 font-mono text-[0.92rem] leading-7">
              <div
                ref={gutter}
                aria-hidden="true"
                className="select-none overflow-hidden border-r border-line bg-paper-2/60 px-3 py-4 text-right text-ink-3"
              >
                {Array.from({ length: lines }, (_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <label htmlFor="lab-editor" className="sr-only">
                Contents of hello.txt
              </label>
              <textarea
                id="lab-editor"
                value={working}
                onChange={(e) => setWorking(e.target.value)}
                onScroll={(e) => gutter.current && (gutter.current.scrollTop = e.currentTarget.scrollTop)}
                spellCheck={false}
                className="flex-1 resize-none bg-transparent px-4 py-4 text-ink outline-none focus-visible:outline-none"
              />
            </div>

            <div className="border-t border-line bg-paper-2/50 px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.78rem]">
                <span className="text-ink-3">blob ID if saved now</span>
                <motion.span key={liveBlob} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} className="text-ink">
                  {liveBlob}
                </motion.span>
              </div>
              <div className="mt-1 font-mono text-[0.72rem] text-ink-3">
                sha1(&quot;{blobHeader(working)}&quot; + content)
                {existing && !clean && (
                  <span className="ml-2 text-violet-ink">Same content as snapshot {short(existing.oid)}, so Git would reuse that blob.</span>
                )}
              </div>

              <form
                className="mt-4 flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault();
                  onSave();
                }}
              >
                <label htmlFor="lab-message" className="sr-only">
                  Snapshot message
                </label>
                <input
                  id="lab-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe this snapshot"
                  maxLength={72}
                  className="h-11 rounded-full sm:flex-1 border border-line-2 bg-surface px-4 text-[0.92rem] text-ink placeholder:text-ink-3 focus:border-violet focus:outline-none"
                />
                <button type="submit" className="btn btn-primary btn-md justify-center">
                  <Save size={16} /> Save snapshot
                </button>
                <button type="button" onClick={reset} className="btn btn-ghost btn-md justify-center" aria-label="Reset the lab">
                  <RotateCcw size={15} />
                  <span className="sm:hidden">Reset</span>
                </button>
              </form>
            </div>
          </div>

          {/* History */}
          <div className="flex flex-col lg:col-span-5">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="text-[0.9rem] font-medium">Snapshot history</span>
              <span className="text-[0.8rem] text-ink-3">
                {snapshots.length} commit{snapshots.length === 1 ? "" : "s"} on main
              </span>
            </div>

            <ol className="relative max-h-[420px] flex-1 overflow-auto px-5 py-5">
              <span aria-hidden="true" className="absolute bottom-8 left-[33px] top-8 w-px bg-line-2" />
              <AnimatePresence initial={false}>
                {[...snapshots].reverse().map((s, i) => (
                  <motion.li
                    key={s.oid}
                    layout
                    initial={{ opacity: 0, y: -16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 26 }}
                    className="relative mb-3 last:mb-0"
                  >
                    <button
                      type="button"
                      onClick={() => setPreview((p) => (p === s.oid ? null : s.oid))}
                      aria-expanded={preview === s.oid}
                      className={`flex w-full items-start gap-4 rounded-2xl border p-3 text-left transition-colors ${
                        flash === s.oid
                          ? "border-violet bg-violet-wash"
                          : preview === s.oid
                            ? "border-violet/50 bg-paper"
                            : "border-transparent hover:border-line hover:bg-paper"
                      }`}
                    >
                      <span
                        className={`relative z-[1] mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 bg-surface ${
                          i === 0 ? "border-violet text-violet" : "border-line-2 text-ink-3"
                        }`}
                      >
                        {flash === s.oid ? <Check size={13} /> : <GitCommitHorizontal size={14} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[0.95rem] text-ink">{s.message}</span>
                          {i === 0 && (
                            <span className="shrink-0 rounded-full bg-ink px-2 py-0.5 text-[0.68rem] text-paper">HEAD</span>
                          )}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-x-3 font-mono text-[0.72rem] text-ink-3">
                          <span>commit {short(s.oid)}</span>
                          <span>
                            blob {short(s.blob)}
                            {s.reusedBlob && <span className="text-violet-ink"> reused</span>}
                          </span>
                          <span>{s.parent ? `parent ${short(s.parent)}` : "no parent"}</span>
                        </span>
                      </span>
                    </button>
                    <AnimatePresence>
                      {preview === s.oid && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pl-11"
                        >
                          <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-paper-2 p-3 font-mono text-[0.78rem] leading-6 text-ink-2">
                            {s.content}
                          </pre>
                          <button
                            type="button"
                            onClick={() => setWorking(s.content)}
                            className="mt-2 text-[0.8rem] text-violet-ink underline-offset-4 hover:underline"
                          >
                            Load into editor
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>

            <div className="border-t border-line px-5 py-4 text-[0.85rem] text-ink-2">
              {previewed ? (
                <span>
                  Snapshot <span className="font-mono">{short(previewed.oid)}</span> can&apos;t change. Editing creates a new one.
                </span>
              ) : (
                <span>Older snapshots never change. Each save adds a new commit that points to the last.</span>
              )}
              <a href="#diff" className="mt-3 flex items-center gap-1.5 font-medium text-violet-ink hover:underline">
                Compare two snapshots <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
