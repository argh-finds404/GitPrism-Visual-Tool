"use client";

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Link2, RotateCcw } from "lucide-react";
import { Chapter } from "@/components/ui/Chapter";
import { blobHeader, hashBlob, short } from "@/lib/git";
import { usePrefersReducedMotion } from "@/lib/theme";

const START = "Hello GitPrism!";

function FileCard({
  path,
  value,
  onChange,
  oid,
  tone,
}: {
  path: string;
  value: string;
  onChange: (v: string) => void;
  oid: string;
  tone: string;
}) {
  const id = `ca-${path.replace(/\W/g, "-")}`;
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="font-mono text-[0.82rem] text-ink">
          {path}
        </label>
        <span className="flex items-center gap-1.5 font-mono text-[0.72rem] text-ink-3">
          <span className="h-2 w-2 rounded-full" style={{ background: tone }} />
          blob {short(oid)}
        </span>
      </div>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="mt-3 h-11 w-full rounded-xl border border-line-2 bg-paper px-3 font-mono text-[0.92rem] text-ink focus:border-violet focus:outline-none"
      />
    </div>
  );
}

export function ContentAddressing() {
  const reduce = usePrefersReducedMotion();
  const [a, setA] = useState(START);
  const [b, setB] = useState(START);

  // Files on disk end with a newline, so hash what Git would actually see.
  const oidA = hashBlob(a + "\n");
  const oidB = hashBlob(b + "\n");
  const same = oidA === oidB;

  const blobs = same
    ? [{ oid: oidA, content: a, paths: ["src/hello.txt", "docs/hello.txt"], tone: "var(--violet)" }]
    : [
        { oid: oidA, content: a, paths: ["src/hello.txt"], tone: "var(--violet)" },
        { oid: oidB, content: b, paths: ["docs/hello.txt"], tone: "var(--magenta)" },
      ];

  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 180, damping: 22 };

  return (
    <section id="identity" aria-labelledby="identity-title" className="relative overflow-hidden py-28 md:py-36">
      <div className="shell">
        <Chapter n={6} name="the invisible part" id="identity-title" title="Same content, same object.">
          <p>
            Two files with identical content are stored as one blob, because a blob&apos;s ID comes from its content
            and header, not its name or folder. Change one file and it gets a new blob. The other file keeps pointing
            at the original.
          </p>
        </Chapter>

        <LayoutGroup>
          <div className="mt-16 grid items-center gap-8 lg:grid-cols-[1fr_minmax(120px,0.6fr)_1fr]">
            <div className="space-y-4">
              <FileCard path="src/hello.txt" value={a} onChange={setA} oid={oidA} tone="var(--violet)" />
              <FileCard path="docs/hello.txt" value={b} onChange={setB} oid={oidB} tone={same ? "var(--violet)" : "var(--magenta)"} />
            </div>

            {/* Converging references */}
            <svg viewBox="0 0 200 240" className="mx-auto hidden h-60 w-full lg:block" aria-hidden="true" preserveAspectRatio="none">
              <motion.path
                fill="none"
                stroke="var(--violet)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                className="flow"
                animate={{ d: same ? "M0 64 C 100 64, 100 120, 200 120" : "M0 64 C 100 64, 100 64, 200 64" }}
                transition={spring}
              />
              <motion.path
                fill="none"
                stroke={same ? "var(--violet)" : "var(--magenta)"}
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                className="flow"
                animate={{ d: same ? "M0 176 C 100 176, 100 120, 200 120" : "M0 176 C 100 176, 100 176, 200 176" }}
                transition={spring}
              />
            </svg>

            <div className="flex min-h-[18rem] flex-col justify-center gap-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {blobs.map((blob) => (
                  <motion.div
                    key={blob.oid}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={spring}
                    className="rounded-2xl border bg-surface p-5 shadow-soft"
                    style={{ borderColor: blob.tone }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 font-mono text-[0.78rem] text-ink-3">
                        <span className="h-2 w-2 rounded-full" style={{ background: blob.tone }} />
                        blob
                      </span>
                      <span className="flex items-center gap-1.5 text-[0.75rem] text-ink-3">
                        <Link2 size={13} /> {blob.paths.length} path{blob.paths.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="mt-3 break-all font-mono text-[0.82rem] text-ink">{blob.oid}</div>
                    <div className="mt-2 truncate font-mono text-[0.72rem] text-ink-3">
                      sha1(&quot;{blobHeader(blob.content + "\n")}{blob.content}\n&quot;)
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {blob.paths.map((p) => (
                        <span key={p} className="rounded-md bg-paper-2 px-2 py-0.5 font-mono text-[0.72rem] text-ink-2">
                          {p}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </LayoutGroup>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
          <p className="text-[1rem] text-ink-2" aria-live="polite">
            {same ? (
              <>Identical content and header give one object ID. Git stores it once.</>
            ) : (
              <>Different content, different ID. Each file now references its own blob.</>
            )}
          </p>
          <button
            type="button"
            className="chip"
            onClick={() => {
              setA(START);
              setB(START);
            }}
          >
            <RotateCcw size={13} /> Make them identical again
          </button>
        </div>
      </div>
    </section>
  );
}
