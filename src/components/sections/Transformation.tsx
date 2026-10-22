"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { Chapter } from "@/components/ui/Chapter";
import { blobHeader, short } from "@/lib/git";
import { blobs, commits, files, tree, treeEntries, treeText } from "@/lib/sample";
import { usePrefersReducedMotion } from "@/lib/theme";

type Id = "file" | "blobHello" | "blobNotes" | "tree" | "c1" | "c2" | "c3";
type Place = { x: number; y: number; s?: number };

/* ------------------------------------------------------------------ */
/* Story data                                                          */
/* ------------------------------------------------------------------ */

const steps: { key: string; title: string; body: ReactNode }[] = [
  {
    key: "Content",
    title: "It starts as plain text.",
    body: (
      <>
        <p>
          Before Git gets involved, <code className="font-mono text-violet-ink">hello.txt</code> is just bytes in your
          working folder. Git doesn&apos;t know about it yet.
        </p>
      </>
    ),
  },
  {
    key: "Identity",
    title: "Git names content by what it is.",
    body: (
      <>
        <p>
          When you add the file, Git writes a <strong className="font-medium text-ink">blob</strong>. It prefixes the
          content with a small header, the object type and size, then hashes both together with SHA-1. That hash
          becomes the blob&apos;s ID.
        </p>
        <div className="mt-4 rounded-xl border border-line bg-surface p-3 font-mono text-[0.75rem] leading-5 text-ink-2 sm:mt-5 sm:p-4 sm:text-[0.8rem] sm:leading-6">
          <div>
            <span className="text-violet-ink">{blobHeader(files.hello.content)}</span>Hello GitPrism!\n
          </div>
          <div className="text-ink-3">↓ sha1</div>
          <div className="break-all text-ink">{blobs.hello}</div>
        </div>
        <p className="mt-4 hidden text-[0.92rem] text-ink-3 sm:block">
          The filename isn&apos;t part of it. Change one byte and you get a completely different ID.
        </p>
      </>
    ),
  },
  {
    key: "Snapshot",
    title: "A tree records the folder.",
    body: (
      <p>
        A <strong className="font-medium text-ink">tree</strong> is a directory listing. Each entry has a mode, a
        type, an object ID and a name. Filenames live here, not in blobs. Together, a tree and the blobs it points to
        describe one complete state of the project.
      </p>
    ),
  },
  {
    key: "History",
    title: "A commit freezes the snapshot and remembers its parent.",
    body: (
      <>
        <p>
          A <strong className="font-medium text-ink">commit</strong> points to one root tree, the commit that came
          before it, and who made it and why. Every new commit points back, and that chain is your history.
        </p>
        <p className="mt-4 hidden text-[0.92rem] text-ink-3 sm:block">
          The commit doesn&apos;t contain your files. It references a tree, and the tree references the blobs.
        </p>
      </>
    ),
  },
];

/** Where each object sits at each step. Missing = hidden. */
function layout(step: number, sub: number): Partial<Record<Id, Place>> {
  switch (step) {
    case 0:
      return { file: { x: 50, y: 48, s: 1.08 } };
    case 1:
      return { file: { x: 30, y: 28, s: 0.9 }, blobHello: { x: 62, y: 68 } };
    case 2:
      return { tree: { x: 50, y: 34 }, blobHello: { x: 27, y: 76 }, blobNotes: { x: 73, y: 76 } };
    default:
      return {
        c2: { x: 50, y: 14 },
        tree: { x: 50, y: 48 },
        blobHello: { x: 27, y: 83 },
        blobNotes: { x: 73, y: 83 },
        c1: { x: 13, y: 14 },
        ...(sub > 0.4 ? { c3: { x: 87, y: 14 } } : {}),
      };
  }
}

const edges: { from: Id; to: Id; label?: string }[] = [
  { from: "file", to: "blobHello", label: "hash" },
  { from: "tree", to: "blobHello" },
  { from: "tree", to: "blobNotes" },
  { from: "c2", to: "tree" },
  { from: "c2", to: "c1" },
  { from: "c3", to: "c2" },
];

const neighbours = (id: Id) => {
  const set = new Set<Id>([id]);
  edges.forEach((e) => {
    if (e.from === id) set.add(e.to);
    if (e.to === id) set.add(e.from);
  });
  return set;
};

const inspect: Record<Id, { type: string; oid?: string; body: string; note: string }> = {
  file: {
    type: "working file",
    body: files.hello.content,
    note: "Not an object yet. `git hash-object hello.txt` would print the blob ID it will get.",
  },
  blobHello: { type: "blob", oid: blobs.hello, body: files.hello.content, note: "Just content. No name, no date." },
  blobNotes: { type: "blob", oid: blobs.notes, body: files.notes.content, note: "Just content. No name, no date." },
  tree: { type: "tree", oid: tree, body: treeText(treeEntries), note: "Names and modes live here, pointing at blobs." },
  c1: { type: "commit", oid: commits.c1.oid, body: commits.c1.text, note: "The first commit has no parent." },
  c2: { type: "commit", oid: commits.c2.oid, body: commits.c2.text, note: "One tree, one parent, plus who and why." },
  c3: { type: "commit", oid: commits.c3.oid, body: commits.c3.text, note: "A newer commit points back to c2." },
};

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

const tone: Record<string, string> = {
  file: "var(--ink-3)",
  blob: "var(--cyan)",
  tree: "var(--lilac)",
  commit: "var(--violet)",
};

function Kind({ k }: { k: keyof typeof tone }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[max(9px,1.6cqw)] text-ink-3">
      <span className="h-[0.6em] w-[0.6em] rounded-full" style={{ background: tone[k] }} />
      {k}
    </span>
  );
}

function ObjectCard({ id }: { id: Id }) {
  switch (id) {
    case "file":
      return (
        <div className="w-[min(46cqw,320px)]">
          <div className="flex items-center justify-between border-b border-line px-[3cqw] py-[1.6cqw]">
            <span className="font-mono text-[max(10px,2cqw)] text-ink">hello.txt</span>
            <Kind k="file" />
          </div>
          <pre className="px-[3cqw] py-[3cqw] font-mono text-[max(11px,2.4cqw)] text-ink">
            <span className="mr-3 select-none text-ink-3">1</span>Hello GitPrism!
          </pre>
        </div>
      );
    case "blobHello":
    case "blobNotes": {
      const isHello = id === "blobHello";
      return (
        <div className="w-[min(34cqw,230px)] px-[2.6cqw] py-[2.2cqw]">
          <div className="flex items-center justify-between">
            <Kind k="blob" />
            <span className="font-mono text-[max(10px,1.9cqw)] text-ink">{short(isHello ? blobs.hello : blobs.notes)}</span>
          </div>
          <div className="mt-[1.4cqw] truncate font-mono text-[max(9px,1.7cqw)] text-ink-3">
            {isHello ? "Hello GitPrism!" : "# Notes …"}
          </div>
        </div>
      );
    }
    case "tree":
      return (
        <div className="w-[min(56cqw,380px)] px-[2.6cqw] py-[2.2cqw]">
          <div className="flex items-center justify-between">
            <Kind k="tree" />
            <span className="font-mono text-[max(10px,1.9cqw)] text-ink">{short(tree)}</span>
          </div>
          <div className="mt-[1.4cqw] space-y-[0.6cqw] font-mono text-[max(9px,1.75cqw)] text-ink-2">
            {treeEntries.map((e) => (
              <div key={e.name} className="flex gap-[1.6cqw] whitespace-nowrap">
                <span className="text-ink-3">{e.mode}</span>
                <span className="text-[color:var(--cyan)]">blob</span>
                <span>{short(e.oid)}</span>
                <span className="text-ink">{e.name}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "c2":
      return (
        <div className="w-[min(40cqw,270px)] px-[2.6cqw] py-[2.2cqw]">
          <div className="flex items-center justify-between">
            <Kind k="commit" />
            <span className="font-mono text-[max(10px,1.9cqw)] text-ink">{short(commits.c2.oid)}</span>
          </div>
          <div className="mt-[1.2cqw] text-[max(11px,2.1cqw)] font-medium text-ink">{commits.c2.message}</div>
          <div className="mt-[0.8cqw] space-y-[0.3cqw] font-mono text-[max(9px,1.6cqw)] text-ink-3">
            <div>tree {short(tree)}</div>
            <div>parent {short(commits.c1.oid)}</div>
          </div>
        </div>
      );
    default: {
      const c = commits[id as "c1" | "c3"];
      return (
        <div className="w-[min(21cqw,150px)] px-[2cqw] py-[1.8cqw]">
          <Kind k="commit" />
          <div className="mt-[0.8cqw] font-mono text-[max(10px,1.9cqw)] text-ink">{short(c.oid)}</div>
          <div className="truncate text-[max(9px,1.7cqw)] text-ink-3">{c.message}</div>
        </div>
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function Transformation() {
  const section = useRef<HTMLElement>(null);
  const reduce = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const [sub, setSub] = useState(0);
  const [hover, setHover] = useState<Id | null>(null);
  const [selected, setSelected] = useState<Id | null>(null);
  const [paused, setPaused] = useState(false);

  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const raw = Math.min(3.999, Math.max(0, p * 4.1 - 0.05));
    const s = Math.floor(raw);
    if (s !== step) setStep(s);
    const nextSub = s === 3 ? raw - 3 : 0;
    if (!paused && Math.abs(nextSub - sub) > 0.02) setSub(nextSub);
  });

  const places = layout(step, sub);
  const focus = hover ?? selected;
  const related = useMemo(() => (focus ? neighbours(focus) : null), [focus]);

  const jumpTo = (i: number) => {
    const el = section.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.55) / 4) * travel, behavior: reduce ? "auto" : "smooth" });
  };

  const reset = () => {
    setSelected(null);
    setHover(null);
    setPaused(false);
    jumpTo(-0.55);
  };

  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 120, damping: 20, mass: 0.9 };

  return (
    <section ref={section} id="how" aria-labelledby="how-title" className="relative h-[460vh] bg-paper-2">
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden pt-20 md:pt-24">
        <div className="shell grid h-full grid-rows-[auto_1fr] gap-4 pb-6 lg:grid-cols-12 lg:grid-rows-1 lg:gap-10 lg:pb-10">
          {/* Narrative column */}
          <div className="order-2 flex min-h-0 flex-col lg:order-1 lg:col-span-5 lg:justify-center">
            <div className="hidden lg:block">
              <Chapter n={2} name="the reveal" id="how-title" compact title="A commit is more than a command." />
            </div>
            <h2 className="sr-only lg:hidden">A commit is more than a command.</h2>

            <ol className="mt-2 flex gap-1.5 lg:mt-8" aria-label="Story steps">
              {steps.map((s, i) => (
                <li key={s.key} className="flex-1">
                  <button
                    type="button"
                    onClick={() => jumpTo(i)}
                    aria-current={step === i ? "step" : undefined}
                    className="group w-full pt-2 text-left"
                  >
                    <span className="block h-[3px] overflow-hidden rounded-full bg-line">
                      <motion.span
                        className="block h-full rounded-full bg-violet"
                        animate={{ width: step > i ? "100%" : step === i ? "55%" : "0%" }}
                        transition={{ duration: 0.5 }}
                      />
                    </span>
                    <span
                      className={`mt-2 block text-[0.8rem] transition-colors ${
                        step === i ? "text-ink" : "text-ink-3 group-hover:text-ink-2"
                      }`}
                    >
                      {i + 1}. {s.key}
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            <div className="relative mt-5 min-h-[13rem] lg:mt-6 lg:min-h-[19rem]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="text-[0.94rem] leading-relaxed text-ink-2 lg:text-[1.04rem]"
                >
                  <h3 className="display mb-3 text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[1.05] text-ink lg:mb-4">
                    {steps[step].title}
                  </h3>
                  {steps[step].body}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Stage */}
          <div className="order-1 flex min-h-0 flex-col lg:order-2 lg:col-span-7 lg:justify-center">
            <div
              className={`relative mx-auto aspect-[1/0.92] max-h-[40svh] w-full max-w-[680px] rounded-[28px] border border-line bg-paper @container lg:max-h-[72svh] ${
                paused ? "paused" : ""
              }`}
              style={{ containerType: "inline-size" }}
              onPointerLeave={() => setHover(null)}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-[28px] opacity-70"
                style={{
                  backgroundImage: "radial-gradient(var(--line-2) 1px, transparent 1px)",
                  backgroundSize: "22px 22px",
                  maskImage: "radial-gradient(circle at 50% 50%, black, transparent 80%)",
                }}
              />

              {/* Edges */}
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {edges.map((e) => {
                  const a = places[e.from];
                  const b = places[e.to];
                  const on = !!a && !!b;
                  const lit = related && related.has(e.from) && related.has(e.to);
                  const dim = related && !lit;
                  return (
                    <motion.line
                      key={`${e.from}-${e.to}`}
                      initial={false}
                      animate={{
                        x1: a?.x ?? 50,
                        y1: a?.y ?? 50,
                        x2: b?.x ?? 50,
                        y2: b?.y ?? 50,
                        opacity: on ? (dim ? 0.15 : 1) : 0,
                      }}
                      transition={spring}
                      stroke={lit ? "var(--violet)" : "var(--line-2)"}
                      strokeWidth={lit ? 2 : 1.5}
                      vectorEffect="non-scaling-stroke"
                      className={e.label === "hash" || lit ? "flow" : ""}
                    />
                  );
                })}
              </svg>

              {/* Objects */}
              {(Object.keys(inspect) as Id[]).map((id) => {
                const p = places[id];
                const dim = related && !related.has(id);
                const kind = inspect[id].type;
                return (
                  <AnimatePresence key={id}>
                    {p && (
                      <motion.button
                        type="button"
                        aria-label={`Inspect ${kind}${inspect[id].oid ? " " + short(inspect[id].oid!) : " hello.txt"}`}
                        aria-pressed={selected === id}
                        onPointerEnter={(ev) => ev.pointerType === "mouse" && setHover(id)}
                        onFocus={() => setHover(id)}
                        onBlur={() => setHover(null)}
                        onClick={() => setSelected((cur) => (cur === id ? null : id))}
                        className={`absolute left-0 top-0 overflow-hidden rounded-[14px] border bg-surface text-left shadow-soft transition-[border-color,box-shadow] ${
                          selected === id ? "border-violet ring-4 ring-violet/15" : "border-line hover:border-violet/60"
                        }`}
                        style={{ x: "-50%", y: "-50%" }}
                        initial={reduce ? false : { opacity: 0, scale: 0.7, left: `${p.x}%`, top: `${p.y}%` }}
                        animate={{ opacity: dim ? 0.35 : 1, scale: p.s ?? 1, left: `${p.x}%`, top: `${p.y}%` }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={spring}
                      >
                        <ObjectCard id={id} />
                      </motion.button>
                    )}
                  </AnimatePresence>
                );
              })}

              {/* Inspector */}
              <AnimatePresence>
                {selected && (
                  <motion.div
                    role="dialog"
                    aria-label="Object inspector"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-x-3 bottom-3 z-10 max-h-[62%] overflow-auto rounded-2xl border border-night-line bg-night p-4 text-[#ece9f5] shadow-2xl"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-mono text-[0.75rem] text-white/55">
                        {inspect[selected].oid ? (
                          <>
                            $ git cat-file -p {short(inspect[selected].oid!)}
                            <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-white/80">{inspect[selected].type}</span>
                          </>
                        ) : (
                          <>$ cat hello.txt</>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelected(null)}
                        aria-label="Close inspector"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[0.78rem] leading-6">{inspect[selected].body}</pre>
                    {inspect[selected].oid && (
                      <p className="mt-2 break-all font-mono text-[0.7rem] text-[#b6a0ff]">id {inspect[selected].oid}</p>
                    )}
                    <p className="mt-2 text-[0.8rem] text-white/60">{inspect[selected].note}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mx-auto mt-3 flex w-full max-w-[680px] items-center justify-between gap-2">
              <p className="hidden text-[0.82rem] text-ink-3 sm:block">Hover to trace references. Click any object to open it.</p>
              <p className="text-[0.82rem] text-ink-3 sm:hidden">Tap an object to open it.</p>
              <div className="flex gap-2">
                <button type="button" className="chip" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
                  {paused ? <Play size={13} /> : <Pause size={13} />}
                  {paused ? "Resume" : "Pause animation"}
                </button>
                <button type="button" className="chip" onClick={reset}>
                  <RotateCcw size={13} /> Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
