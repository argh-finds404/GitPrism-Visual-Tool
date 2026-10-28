"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useMotionValueEvent, useScroll } from "motion/react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import { Chapter } from "@/components/ui/Chapter";
import { Aurora } from "@/components/ui/Aurora";
import { blobHeader, short } from "@/lib/git";
import { blobs, commits, files, srcEntries, srcTree, tree, treeEntries, treeText } from "@/lib/sample";
import { usePrefersReducedMotion } from "@/lib/theme";
import { useAutoCycle } from "@/lib/useAutoCycle";

/* ------------------------------------------------------------------ */
/* Story                                                               */
/* ------------------------------------------------------------------ */

const steps: { key: string; title: string; body: ReactNode }[] = [
  {
    key: "Content",
    title: "It starts as plain text.",
    body: (
      <p>
        Before Git gets involved, <code className="font-mono text-violet-ink">hello.txt</code> is just bytes in your
        working folder. Git doesn&apos;t know about it yet.
      </p>
    ),
  },
  {
    key: "Identity",
    title: "Git names content by what it is.",
    body: (
      <>
        <p>
          When you add the file, Git writes a <strong className="font-semibold text-[color:var(--c-blob)]">blob</strong>. It
          puts a small header in front of the content, the type and size, and hashes both together with SHA-1. That hash
          is the blob&apos;s ID.
        </p>
        <div className="mt-4 rounded-xl border border-line bg-surface/80 p-3 font-mono text-[0.75rem] leading-5 text-ink-2 sm:mt-5 sm:p-4 sm:text-[0.8rem] sm:leading-6">
          <div>
            <span className="text-violet-ink">{blobHeader(files.hello.content)}</span>Hello GitPrism!\n
          </div>
          <div className="text-ink-3">↓ sha1</div>
          <div className="break-all text-[color:var(--c-blob)]">{blobs.hello}</div>
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
      <>
        <p>
          A <strong className="font-semibold text-[color:var(--c-tree)]">tree</strong> is a directory listing. Each entry
          pairs a name and mode with the ID of a blob, or of another tree for a subfolder. Filenames live here, on the
          branches, never inside blobs.
        </p>
        <p className="mt-4 hidden text-[0.92rem] text-ink-3 sm:block">
          The root tree and everything under it describe one complete state of the project.
        </p>
      </>
    ),
  },
  {
    key: "History",
    title: "A commit freezes the snapshot and remembers its parent.",
    body: (
      <>
        <p>
          A <strong className="font-semibold text-[color:var(--c-commit)]">commit</strong> points to one root tree and to
          the commit before it, plus who made it and why. Each new commit points back, and that chain is your history.
        </p>
        <p className="mt-4 hidden text-[0.92rem] text-ink-3 sm:block">
          When the next commit changes only hello.txt, its new tree still points at the very same src/ tree. Unchanged
          folders are reused, not copied.
        </p>
      </>
    ),
  },
];

/* ------------------------------------------------------------------ */
/* Objects, layout and edges                                           */
/* ------------------------------------------------------------------ */

type Id = "file" | "blobHello" | "blobNotes" | "blobApp" | "tree" | "src" | "c1" | "c2" | "c3";
type Kind = "file" | "blob" | "tree" | "commit";
type Place = { x: number; y: number; scale?: number };

const KIND: Record<Id, Kind> = {
  file: "file",
  blobHello: "blob",
  blobNotes: "blob",
  blobApp: "blob",
  tree: "tree",
  src: "tree",
  c1: "commit",
  c2: "commit",
  c3: "commit",
};

/** Card width in container-query units, so the diagram scales with its stage. */
const WIDTH: Record<Id, number> = { file: 40, blobHello: 23, blobNotes: 23, blobApp: 23, tree: 27, src: 23, c1: 21, c2: 29, c3: 21 };

/** Where each object sits at each step (percent of the stage). Missing means hidden. */
function layout(step: number, third: boolean): Partial<Record<Id, Place>> {
  switch (step) {
    case 0:
      return { file: { x: 50, y: 50, scale: 1.12 } };
    case 1:
      return { file: { x: 23, y: 52, scale: 0.86 }, blobHello: { x: 80, y: 52 } };
    case 2:
      return {
        tree: { x: 50, y: 16 },
        blobHello: { x: 16, y: 50 },
        blobNotes: { x: 50, y: 50 },
        src: { x: 84, y: 50 },
        blobApp: { x: 84, y: 82 },
      };
    default:
      return {
        c1: { x: 13, y: 9 },
        c2: { x: 50, y: 9 },
        ...(third ? { c3: { x: 87, y: 9 } } : {}),
        tree: { x: 50, y: 34 },
        blobHello: { x: 16, y: 60 },
        blobNotes: { x: 50, y: 60 },
        src: { x: 84, y: 60 },
        blobApp: { x: 84, y: 86 },
      };
  }
}

type Edge = { from: Id; to: Id; kind: "entry" | "tree" | "parent"; label?: string };

const EDGES: Edge[] = [
  { from: "tree", to: "blobHello", kind: "entry", label: "100644 hello.txt" },
  { from: "tree", to: "blobNotes", kind: "entry", label: "100644 notes.md" },
  { from: "tree", to: "src", kind: "entry", label: "040000 src/" },
  { from: "src", to: "blobApp", kind: "entry", label: "100644 app.js" },
  { from: "c2", to: "tree", kind: "tree", label: "tree" },
  { from: "c2", to: "c1", kind: "parent", label: "parent" },
  { from: "c3", to: "c2", kind: "parent", label: "parent" },
];

const neighbours = (id: Id) => {
  const set = new Set<Id>([id]);
  EDGES.forEach((e) => {
    if (e.from === id) set.add(e.to);
    if (e.to === id) set.add(e.from);
  });
  return set;
};

const INSPECT: Record<Id, { type: string; oid?: string; body: string; note: string }> = {
  file: {
    type: "working file",
    body: files.hello.content,
    note: "Not an object yet. `git hash-object hello.txt` prints the blob ID it will get.",
  },
  blobHello: { type: "blob", oid: blobs.hello, body: files.hello.content, note: "Just content. The name hello.txt lives in the tree entry that points here." },
  blobNotes: { type: "blob", oid: blobs.notes, body: files.notes.content, note: "Just content. No name, no date." },
  blobApp: { type: "blob", oid: blobs.app, body: files.app.content, note: "Reached through the src/ subtree." },
  tree: { type: "tree", oid: tree, body: treeText(treeEntries), note: "Two blob entries and one tree entry for the src/ folder." },
  src: { type: "tree", oid: srcTree, body: treeText(srcEntries), note: "A folder is a tree inside a tree. Its ID changes only if something inside changes." },
  c1: { type: "commit", oid: commits.c1.oid, body: commits.c1.text, note: "The first commit has no parent." },
  c2: { type: "commit", oid: commits.c2.oid, body: commits.c2.text, note: "One root tree, one parent, plus who and why." },
  c3: { type: "commit", oid: commits.c3.oid, body: commits.c3.text, note: "Its new root tree reuses the same src/ tree as c2." },
};

const COLOR: Record<Kind, string> = { file: "var(--ink-3)", blob: "var(--c-blob)", tree: "var(--c-tree)", commit: "var(--c-commit)" };

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Glyph({ kind, size = 10 }: { kind: Kind; size?: number }) {
  const c = COLOR[kind];
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
      {kind === "blob" && <circle cx="6" cy="6" r="4.8" fill={c} />}
      {kind === "tree" && <rect x="1.4" y="1.4" width="9.2" height="9.2" rx="1.6" fill={c} />}
      {kind === "commit" && <path d="M6 .8 11.2 6 6 11.2.8 6Z" fill={c} />}
      {kind === "file" && <path d="M2.5 1h5L10 3.5V11h-7.5z" fill="none" stroke={c} strokeWidth="1.3" />}
    </svg>
  );
}

function Card({ id }: { id: Id }) {
  const kind = KIND[id];
  const head = (label: string, oid?: string) => (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 font-mono text-[max(9px,1.55cqw)] uppercase tracking-[0.08em]" style={{ color: COLOR[kind] }}>
        <Glyph kind={kind} size={9} />
        {label}
      </span>
      {oid && <span className="font-mono text-[max(9.5px,1.75cqw)] text-ink">{short(oid)}</span>}
    </div>
  );
  switch (id) {
    case "file":
      return (
        <div>
          <div className="flex items-center justify-between border-b border-line px-[3cqw] py-[1.6cqw]">
            <span className="font-mono text-[max(10px,1.9cqw)] text-ink">hello.txt</span>
            <span className="font-mono text-[max(9px,1.5cqw)] text-ink-3">working folder</span>
          </div>
          <pre className="px-[3cqw] py-[2.6cqw] font-mono text-[max(11px,2.3cqw)] text-ink">
            <span className="mr-3 select-none text-ink-3">1</span>Hello GitPrism!
          </pre>
        </div>
      );
    case "blobHello":
    case "blobNotes":
    case "blobApp": {
      const map = { blobHello: [blobs.hello, "Hello GitPrism!"], blobNotes: [blobs.notes, "# Notes …"], blobApp: [blobs.app, 'console.log("he…'] } as const;
      const [oid, preview] = map[id];
      return (
        <div className="px-[2.2cqw] py-[1.8cqw]">
          {head("blob", oid)}
          <div className="mt-[1cqw] truncate rounded bg-paper-2/70 px-[1.2cqw] py-[0.6cqw] font-mono text-[max(9px,1.55cqw)] text-ink-2">{preview}</div>
        </div>
      );
    }
    case "tree":
    case "src":
      return (
        <div className="px-[2.2cqw] py-[1.8cqw]">
          {head("tree", id === "tree" ? tree : srcTree)}
          <div className="mt-[0.8cqw] font-mono text-[max(9.5px,1.7cqw)] text-ink">{id === "tree" ? "/ (root)" : "src/"}</div>
          <div className="font-mono text-[max(9px,1.45cqw)] text-ink-3">{id === "tree" ? "3 entries" : "1 entry"}</div>
        </div>
      );
    default: {
      const c = commits[id as "c1" | "c2" | "c3"];
      return (
        <div className="px-[2.2cqw] py-[1.8cqw]">
          {head("commit", c.oid)}
          <div className={`mt-[0.8cqw] truncate text-[max(10px,1.8cqw)] font-medium text-ink ${id === "c2" ? "" : "opacity-90"}`}>{c.message}</div>
          {id === "c2" && <div className="font-mono text-[max(9px,1.45cqw)] text-ink-3">tree {short(tree)}</div>}
        </div>
      );
    }
  }
}

/** Orthogonal tree connector with rounded corners: down, across, down. Same command list every time so it can morph. */
function elbow(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mid = a.y + (b.y - a.y) * 0.5;
  const dx = b.x - a.x;
  const r = Math.min(12, Math.abs(dx) / 2, Math.abs(b.y - a.y) / 4);
  const s = dx === 0 ? 0 : Math.sign(dx);
  return `M ${a.x} ${a.y} L ${a.x} ${mid - r} Q ${a.x} ${mid} ${a.x + s * r} ${mid} L ${b.x - s * r} ${mid} Q ${b.x} ${mid} ${b.x} ${mid + r} L ${b.x} ${b.y}`;
}

/** Horizontal link from a commit to its parent, ending just outside the parent's card. */
function link(a: { x: number; y: number }, b: { x: number; y: number }) {
  return `M ${a.x} ${a.y} L ${(a.x + b.x) / 2} ${a.y} Q ${(a.x + b.x) / 2} ${a.y} ${(a.x + b.x) / 2} ${b.y} L ${b.x} ${b.y}`;
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

export function Transformation() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<Id, HTMLElement>());
  const reduce = usePrefersReducedMotion();
  const inView = useInView(section, { margin: "100px 0px" });
  const [step, setStep] = useState(0);
  // In the history step, the third commit appears a third of the way through. Only the crossing
  // matters, so scrolling sets state twice at most instead of on every frame.
  const [third, setThird] = useState(false);
  const [hover, setHover] = useState<Id | null>(null);
  const [selected, setSelected] = useState<Id | null>(null);
  const [paused, setPaused] = useState(false);
  const [size, setSize] = useState({ w: 680, h: 640 });
  const [heights, setHeights] = useState<Partial<Record<Id, number>>>({});

  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const raw = Math.min(3.999, Math.max(0, p * 4.1 - 0.05));
    const s = Math.floor(raw);
    if (s !== step) setStep(s);
    const nextThird = s === 3 && raw - 3 > 0.35;
    if (!paused && nextThird !== third) setThird(nextThird);
  });

  // Connectors are drawn in pixels, so track the stage size.
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const places = layout(step, third);

  // Unpausing catches up with wherever the scroll went in the meantime.
  const togglePause = () => {
    if (paused) {
      const raw = Math.min(3.999, Math.max(0, scrollYProgress.get() * 4.1 - 0.05));
      setThird(Math.floor(raw) === 3 && raw - 3 > 0.35);
    }
    setPaused(!paused);
  };

  // Card heights, so connectors meet card edges instead of disappearing under them.
  // A ResizeObserver reports them whenever a card mounts or changes size.
  const heightObserver = useRef<ResizeObserver | null>(null);
  const cardRef = (id: Id) => (el: HTMLElement | null) => {
    heightObserver.current ??= new ResizeObserver((entries) =>
      setHeights((prev) => {
        let next = prev;
        for (const e of entries) {
          const el = e.target as HTMLElement;
          const key = el.dataset.card as Id;
          if (prev[key] !== el.offsetHeight) next = { ...next, [key]: el.offsetHeight };
        }
        return next;
      }),
    );
    const before = cards.current.get(id);
    if (before && before !== el) heightObserver.current.unobserve(before);
    if (el) {
      cards.current.set(id, el);
      heightObserver.current.observe(el);
    } else cards.current.delete(id);
  };
  useEffect(() => () => heightObserver.current?.disconnect(), []);

  // When nobody is pointing at anything, trace the diagram on its own, so the relationships
  // are seen without requiring a hover. Any real interaction (hover, select, pause) takes over.
  const visibleIds = useMemo(() => Object.keys(places) as Id[], [places]);
  const autoplayOn = inView && !reduce && !paused && hover === null && selected === null;
  const autoIndex = useAutoCycle(visibleIds.length, autoplayOn, 2200);
  const focus = hover ?? selected ?? (autoplayOn ? visibleIds[autoIndex] : null);
  const related = useMemo(() => (focus ? neighbours(focus) : null), [focus]);

  const px = (p: Place) => ({ x: (p.x / 100) * size.w, y: (p.y / 100) * size.h });
  const halfH = (id: Id) => ((heights[id] ?? 40) * (places[id]?.scale ?? 1)) / 2;
  const halfW = (id: Id) => (((WIDTH[id] / 100) * size.w) * (places[id]?.scale ?? 1)) / 2;

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

  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 110, damping: 20, mass: 0.9 };
  const visibleEdges = EDGES.filter((e) => places[e.from] && places[e.to]);

  // Hashing beam for step 2: file → prism → blob.
  const beam =
    step === 1 && places.file && places.blobHello
      ? { from: { x: px(places.file).x + halfW("file"), y: px(places.file).y }, prism: { x: size.w * 0.545, y: size.h * 0.52 }, to: { x: px(places.blobHello).x - halfW("blobHello"), y: px(places.blobHello).y } }
      : null;

  return (
    <section ref={section} id="how" aria-labelledby="how-title" className="relative h-[310vh] bg-paper-2">
      <div className="sticky top-0 flex h-[100svh] flex-col overflow-hidden pt-20 md:pt-24">
        <Aurora tones={["violet", "cyan"]} />
        <div className="shell relative grid h-full grid-rows-[auto_1fr] gap-4 pb-6 lg:grid-cols-12 lg:grid-rows-1 lg:gap-10 lg:pb-10">
          {/* Narrative */}
          <div className="order-2 flex min-h-0 flex-col lg:order-1 lg:col-span-5 lg:justify-center">
            <div className="hidden lg:block">
              <Chapter n={2} name="the reveal" id="how-title" compact title="A commit is more than a command." />
            </div>
            <h2 className="sr-only lg:hidden">A commit is more than a command.</h2>

            <ol className="mt-2 flex gap-1.5 lg:mt-8" aria-label="Story steps">
              {steps.map((s, i) => (
                <li key={s.key} className="flex-1">
                  <button type="button" onClick={() => jumpTo(i)} aria-current={step === i ? "step" : undefined} className="group w-full pt-2 text-left">
                    <span className="block h-[3px] overflow-hidden rounded-full bg-line">
                      <motion.span
                        className="block h-full rounded-full bg-[linear-gradient(90deg,var(--violet),var(--cyan))]"
                        animate={{ width: step > i ? "100%" : step === i ? "55%" : "0%" }}
                        transition={{ duration: 0.5 }}
                      />
                    </span>
                    <span className={`mt-2 block text-[0.8rem] transition-colors ${step === i ? "text-ink" : "text-ink-3 group-hover:text-ink-2"}`}>
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
                  <h3 className="display mb-3 text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[1.02] text-ink lg:mb-4">{steps[step].title}</h3>
                  {steps[step].body}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Stage */}
          <div className="order-1 flex min-h-0 flex-col lg:order-2 lg:col-span-7 lg:justify-center">
            <div
              ref={stage}
              className={`panel relative mx-auto h-[42svh] min-h-[300px] w-full max-w-[720px] overflow-hidden rounded-[28px] lg:h-[min(72svh,720px)] lg:min-h-[430px] ${paused || !inView ? "paused" : ""}`}
              style={{ containerType: "inline-size" }}
              onPointerLeave={() => setHover(null)}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage: "radial-gradient(var(--line-2) 1px, transparent 1px)",
                  backgroundSize: "22px 22px",
                  maskImage: "radial-gradient(circle at 50% 45%, black, transparent 78%)",
                }}
              />
              <span className="absolute left-4 top-3 font-mono text-[11px] text-ink-3" aria-live="polite">
                {["working folder", "git add hello.txt", "git write-tree", "git commit"][step]}
              </span>

              {/* Connectors */}
              <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
                <defs>
                  <marker id="tx-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                    <path d="M0 0 10 5 0 10z" fill="var(--c-commit)" />
                  </marker>
                  <linearGradient id="tx-spectrum" x1="0" x2="1">
                    <stop offset="0" stopColor="var(--cyan)" />
                    <stop offset=".5" stopColor="var(--magenta)" />
                    <stop offset="1" stopColor="var(--amber)" />
                  </linearGradient>
                </defs>

                {beam && (
                  <g>
                    <motion.line
                      x1={beam.from.x}
                      y1={beam.from.y}
                      x2={beam.prism.x - 16}
                      y2={beam.prism.y}
                      stroke="var(--ink)"
                      strokeOpacity={0.85}
                      strokeWidth={2}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.6 }}
                    />
                    {[-6, -2, 2, 6].map((dy, i) => (
                      <motion.line
                        key={dy}
                        x1={beam.prism.x + 16}
                        y1={beam.prism.y + dy * 0.4}
                        x2={beam.to.x}
                        y2={beam.to.y + dy}
                        stroke={["var(--cyan)", "var(--violet)", "var(--magenta)", "var(--amber)"][i]}
                        strokeWidth={1.6}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.9 }}
                        transition={{ duration: 0.6, delay: 0.45 + i * 0.05 }}
                      />
                    ))}
                    <linearGradient id="tx-glass" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="var(--lilac)" stopOpacity={0.9} />
                      <stop offset=".55" stopColor="var(--violet)" stopOpacity={0.55} />
                      <stop offset="1" stopColor="var(--cyan)" stopOpacity={0.5} />
                    </linearGradient>
                    <path
                      d={`M ${beam.prism.x} ${beam.prism.y - 30} L ${beam.prism.x + 27} ${beam.prism.y + 18} L ${beam.prism.x - 27} ${beam.prism.y + 18} Z`}
                      fill="url(#tx-glass)"
                      stroke="var(--lilac)"
                      strokeWidth={1.5}
                      style={{ filter: "drop-shadow(0 0 14px var(--violet))" }}
                    />
                    <text x={beam.prism.x} y={beam.prism.y - 44} textAnchor="middle" className="fill-[color:var(--ink-3)] font-mono text-[10.5px]">
                      sha1(header + content)
                    </text>
                  </g>
                )}

                {visibleEdges.map((e) => {
                  const a = px(places[e.from]!);
                  const b = px(places[e.to]!);
                  const lit = !!related && related.has(e.from) && related.has(e.to);
                  const dim = !!related && !lit;
                  let d: string;
                  if (e.kind === "parent") {
                    // Arrow from the newer commit to its parent's edge.
                    const start = { x: a.x - halfW(e.from), y: a.y };
                    const end = { x: b.x + halfW(e.to) + 3, y: b.y };
                    d = link(start, end);
                  } else {
                    d = elbow({ x: a.x, y: a.y + halfH(e.from) }, { x: b.x, y: b.y - halfH(e.to) - 2 });
                  }
                  const color = e.kind === "parent" || e.kind === "tree" ? "var(--c-commit)" : KIND[e.to] === "tree" ? "var(--c-tree)" : "var(--c-blob)";
                  return (
                    <g key={`${e.from}-${e.to}`} opacity={dim ? 0.2 : 1} style={{ transition: "opacity .3s" }}>
                      <motion.path
                        d={d}
                        initial={reduce ? false : { pathLength: 0, d }}
                        animate={{ pathLength: 1, d }}
                        transition={{ pathLength: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }, d: spring }}
                        fill="none"
                        stroke={color}
                        strokeWidth={lit ? 2.6 : 1.6}
                        strokeOpacity={lit ? 1 : 0.75}
                        markerEnd={e.kind === "parent" ? "url(#tx-arrow)" : undefined}
                      />
                      {lit && inView && <motion.path d={d} animate={{ d }} transition={{ d: spring }} fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.2} className="flow" />}
                    </g>
                  );
                })}
              </svg>

              {/* Entry and reference labels sit on the connectors, where Git stores names. */}
              {visibleEdges
                .filter((e) => e.label)
                .map((e) => {
                  const a = px(places[e.from]!);
                  const b = px(places[e.to]!);
                  const pos =
                    e.kind === "entry"
                      ? { x: b.x, y: b.y - halfH(e.to) - 14 }
                      : e.kind === "tree"
                        ? { x: a.x, y: (a.y + halfH(e.from) + b.y - halfH(e.to)) / 2 }
                        : { x: (a.x - halfW(e.from) + b.x + halfW(e.to)) / 2, y: a.y - 12 };
                  const dim = !!related && !(related.has(e.from) && related.has(e.to));
                  return (
                    <motion.span
                      key={`l-${e.from}-${e.to}`}
                      className={`pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-md border border-line bg-paper/90 px-1.5 py-px font-mono text-[max(9px,1.45cqw)] backdrop-blur ${
                        e.kind === "entry" ? "text-ink" : "text-ink-3"
                      }`}
                      style={{ x: "-50%", y: "-50%" }}
                      initial={reduce ? false : { opacity: 0, left: pos.x, top: pos.y }}
                      animate={{ opacity: dim ? 0.25 : 1, left: pos.x, top: pos.y }}
                      transition={{ ...spring, opacity: { duration: 0.3, delay: reduce ? 0 : 0.35 } }}
                    >
                      {e.label}
                    </motion.span>
                  );
                })}

              {/* Objects */}
              {(Object.keys(INSPECT) as Id[]).map((id) => {
                const p = places[id];
                const dim = !!related && !related.has(id);
                const kind = KIND[id];
                return (
                  <AnimatePresence key={id}>
                    {p && (
                      <motion.button
                        ref={cardRef(id)}
                        data-card={id}
                        type="button"
                        aria-label={`Inspect ${INSPECT[id].type}${INSPECT[id].oid ? " " + short(INSPECT[id].oid!) : " hello.txt"}`}
                        aria-pressed={selected === id}
                        onPointerEnter={(ev) => ev.pointerType === "mouse" && setHover(id)}
                        onFocus={() => setHover(id)}
                        onBlur={() => setHover(null)}
                        onClick={() => setSelected((cur) => (cur === id ? null : id))}
                        className="absolute left-0 top-0 overflow-hidden rounded-[12px] border bg-surface text-left transition-[border-color,box-shadow] duration-300"
                        style={{
                          x: "-50%",
                          y: "-50%",
                          width: `${WIDTH[id]}cqw`,
                          borderColor: selected === id || hover === id ? COLOR[kind] : "var(--line-2)",
                          boxShadow: selected === id || hover === id ? `0 0 0 3px color-mix(in oklab, ${COLOR[kind]} 22%, transparent), 0 14px 40px -16px ${COLOR[kind]}` : "var(--shadow)",
                        }}
                        initial={reduce ? false : { opacity: 0, scale: 0.6, left: `${p.x}%`, top: `${p.y}%` }}
                        animate={{ opacity: dim ? 0.3 : 1, scale: p.scale ?? 1, left: `${p.x}%`, top: `${p.y}%` }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={spring}
                      >
                        <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: COLOR[kind] }} aria-hidden="true" />
                        <Card id={id} />
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
                    className="absolute inset-x-3 bottom-3 z-10 max-h-[62%] overflow-auto rounded-2xl border border-night-line bg-night/95 p-4 text-[#ece9f5] shadow-2xl backdrop-blur"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-mono text-[0.75rem] text-white/55">
                        {INSPECT[selected].oid ? (
                          <>
                            $ git cat-file -p {short(INSPECT[selected].oid!)}
                            <span className="ml-2 rounded px-1.5 py-0.5 text-[#08070f]" style={{ background: COLOR[KIND[selected]] }}>
                              {INSPECT[selected].type}
                            </span>
                          </>
                        ) : (
                          <>$ cat hello.txt</>
                        )}
                      </div>
                      <button type="button" onClick={() => setSelected(null)} aria-label="Close inspector" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white">
                        <X size={15} />
                      </button>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap break-all font-mono text-[0.78rem] leading-6">{INSPECT[selected].body}</pre>
                    {INSPECT[selected].oid && <p className="mt-2 break-all font-mono text-[0.7rem] text-[#c4b5ff]">id {INSPECT[selected].oid}</p>}
                    <p className="mt-2 text-[0.8rem] text-white/60">{INSPECT[selected].note}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mx-auto mt-3 flex w-full max-w-[720px] flex-wrap items-center justify-between gap-2">
              <ul className="flex flex-wrap items-center gap-3 text-[0.78rem] text-ink-3" aria-label="Legend">
                {(["commit", "tree", "blob"] as Kind[]).map((k) => (
                  <li key={k} className="flex items-center gap-1.5">
                    <Glyph kind={k} />
                    {k}
                  </li>
                ))}
                <li className="hidden sm:block">{focus && !hover && !selected ? "Tracing on its own — hover or click to take over." : "Hover to trace, click to open."}</li>
              </ul>
              <div className="flex gap-2">
                <button type="button" className="chip" onClick={togglePause} aria-pressed={paused}>
                  {paused ? <Play size={13} /> : <Pause size={13} />}
                  {paused ? "Resume" : "Pause"}
                </button>
                <button type="button" className="chip" onClick={reset}>
                  <RotateCcw size={13} /> Replay
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
