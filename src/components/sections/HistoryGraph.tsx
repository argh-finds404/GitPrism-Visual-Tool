"use client";

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { ChevronLeft, ChevronRight, GitBranch, Plus, RotateCcw } from "lucide-react";
import { hashBlob, hashCommit, hashTree, short } from "@/lib/git";
import { BASE_TIME } from "@/lib/sample";
import { usePrefersReducedMotion } from "@/lib/theme";
import { Chapter } from "@/components/ui/Chapter";

/* ------------------------------------------------------------------ */
/* Graph model                                                         */
/* ------------------------------------------------------------------ */

type Branch = "main" | "feature/diff-view" | "fix/short-ids";

const lanes: Record<Branch, { y: number; color: string; glow: string }> = {
  "feature/diff-view": { y: 0, color: "#B6A0FF", glow: "#7654E8" },
  main: { y: 1, color: "#68D9F5", glow: "#2fb8de" },
  "fix/short-ids": { y: 2, color: "#F08AD6", glow: "#E85AC4" },
};

type Node = {
  key: string;
  oid: string;
  tree: string;
  message: string;
  branch: Branch;
  parents: string[]; // keys
  x: number;
  time: number;
};

type Seed = { key: string; message: string; branch: Branch; parents: string[]; x: number };

const seeds: Seed[] = [
  { key: "A", message: "Initial snapshot", branch: "main", parents: [], x: 0 },
  { key: "B", message: "Add hello.txt", branch: "main", parents: ["A"], x: 1 },
  { key: "C", message: "Sketch the diff view", branch: "feature/diff-view", parents: ["B"], x: 2 },
  { key: "D", message: "Fix typo in README", branch: "main", parents: ["B"], x: 3 },
  { key: "E", message: "Highlight changed lines", branch: "feature/diff-view", parents: ["C"], x: 4 },
  { key: "F", message: "Show 7-character IDs", branch: "fix/short-ids", parents: ["D"], x: 5 },
  { key: "G", message: "Merge diff view", branch: "main", parents: ["D", "E"], x: 6 },
  { key: "H", message: "Explain abbreviated IDs", branch: "fix/short-ids", parents: ["F"], x: 7 },
  { key: "I", message: "Merge short IDs", branch: "main", parents: ["G", "H"], x: 8 },
];

function build(list: Seed[]): Node[] {
  const out: Node[] = [];
  const byKey = new Map<string, Node>();
  list.forEach((s, i) => {
    const tree = hashTree([{ mode: "100644", name: "hello.txt", oid: hashBlob(`${s.message}\n`) }]);
    const time = BASE_TIME + i * 5400;
    const oid = hashCommit({ tree, parents: s.parents.map((p) => byKey.get(p)!.oid), message: s.message, time });
    const n = { ...s, oid, tree, time };
    byKey.set(s.key, n);
    out.push(n);
  });
  return out;
}

const initialRefs: Record<Branch, string> = { main: "I", "feature/diff-view": "E", "fix/short-ids": "H" };

const newMessages: Record<Branch, string[]> = {
  main: ["Polish the homepage", "Tidy up notes", "Add a changelog"],
  "feature/diff-view": ["Animate line changes", "Add split view", "Keyboard shortcuts for hunks"],
  "fix/short-ids": ["Handle ID collisions", "Copy full ID on click", "Document ID length"],
};

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

const GAP_X = 92;
const GAP_Y = 96;
const PAD_X = 48;
const PAD_Y = 64;

const pos = (n: Node) => ({ x: PAD_X + n.x * GAP_X, y: PAD_Y + lanes[n.branch].y * GAP_Y });

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  if (a.y === b.y) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const mx = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function HistoryGraph() {
  const reduce = usePrefersReducedMotion();
  const graphRef = useRef<HTMLDivElement>(null);
  const shown = useInView(graphRef, { once: true, margin: "-15% 0px" }) || reduce;
  const [list, setList] = useState<Seed[]>(seeds);
  const [refs, setRefs] = useState(initialRefs);
  const [selected, setSelected] = useState("G");
  const [technical, setTechnical] = useState(false);
  const [counter, setCounter] = useState({ main: 0, "feature/diff-view": 0, "fix/short-ids": 0 } as Record<Branch, number>);
  const [fresh, setFresh] = useState<string | null>(null);

  const nodes = useMemo(() => build(list), [list]);
  const byKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);
  const sel = byKey.get(selected)!;

  // Every commit reachable by following parents from the selection.
  const ancestry = useMemo(() => {
    const seen = new Set<string>();
    const walk = (k: string) => {
      if (seen.has(k)) return;
      seen.add(k);
      byKey.get(k)?.parents.forEach(walk);
    };
    walk(selected);
    return seen;
  }, [selected, byKey]);

  const children = (k: string) => nodes.filter((n) => n.parents.includes(k));
  const earlier = sel.parents[0];
  const later = children(selected).find((c) => c.parents[0] === selected) ?? children(selected)[0];
  const refsAt = (k: string) => (Object.keys(refs) as Branch[]).filter((b) => refs[b] === k);

  const width = PAD_X * 2 + Math.max(...nodes.map((n) => n.x)) * GAP_X + 150;
  const height = PAD_Y * 2 + 2 * GAP_Y;

  const branchOfSelection: Branch = refsAt(selected)[0] ?? sel.branch;

  const createSnapshot = () => {
    const b = branchOfSelection;
    const parent = refs[b];
    const msgs = newMessages[b];
    const message = msgs[counter[b] % msgs.length];
    const key = `N${list.length}`;
    const x = Math.max(...list.map((s) => s.x)) + 1;
    setList([...list, { key, message, branch: b, parents: [parent], x }]);
    setRefs({ ...refs, [b]: key });
    setCounter({ ...counter, [b]: counter[b] + 1 });
    setSelected(key);
    setFresh(key);
  };

  const reset = () => {
    setList(seeds);
    setRefs(initialRefs);
    setSelected("G");
    setFresh(null);
  };

  return (
    <section id="history" aria-labelledby="history-title" className="night relative overflow-hidden py-28 md:py-36">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 50% at 15% 30%, rgb(118 84 232 / 0.35), transparent 70%), radial-gradient(40% 40% at 85% 70%, rgb(104 217 245 / 0.18), transparent 70%)",
        }}
      />

      <div className="shell relative">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <Chapter
            n={5}
            name="history"
            id="history-title"
            className="lg:col-span-7"
            title="History is a chain of snapshots that point backwards."
          />
          <p className="max-w-[30rem] text-[1.04rem] leading-relaxed text-ink-2 lg:col-span-5">
            Select a commit to follow its parents back to the start. Branches are just names that point at a commit,
            and creating a snapshot moves that name forward.
          </p>
        </div>

        <div className="mt-14 grid gap-5 xl:grid-cols-12">
          {/* Graph */}
          <div className="overflow-hidden rounded-[28px] border border-line bg-[#14121b] xl:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Branches">
                {(Object.keys(lanes) as Branch[]).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setSelected(refs[b])}
                    className="flex h-8 items-center gap-1.5 rounded-full border border-line-2 px-3 font-mono text-[0.75rem] text-ink-2 transition-colors hover:text-ink"
                    style={{ borderColor: refsAt(selected).includes(b) ? lanes[b].color : undefined }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: lanes[b].color }} />
                    {b}
                  </button>
                ))}
              </div>
              <div className="flex gap-1" role="group" aria-label="Graph detail">
                <button type="button" className="chip h-8 border-line-2 bg-transparent" aria-pressed={!technical} onClick={() => setTechnical(false)}>
                  Simple
                </button>
                <button type="button" className="chip h-8 border-line-2 bg-transparent" aria-pressed={technical} onClick={() => setTechnical(true)}>
                  Technical
                </button>
              </div>
            </div>

            <div ref={graphRef} className="overflow-x-auto">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="block h-auto w-full min-w-[640px]"
                role="img"
                aria-label="Commit graph"
              >
                <defs>
                  <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
                    <path d="M0 0 L8 4 L0 8 z" fill="#8f89a0" />
                  </marker>
                </defs>

                {/* Lane guides */}
                {(Object.keys(lanes) as Branch[]).map((b) => (
                  <line
                    key={b}
                    x1={0}
                    x2={width}
                    y1={PAD_Y + lanes[b].y * GAP_Y}
                    y2={PAD_Y + lanes[b].y * GAP_Y}
                    stroke={lanes[b].color}
                    strokeOpacity={0.06}
                    strokeWidth={14}
                  />
                ))}

                {/* Edges: drawn from parent to child, with arrowheads pointing to the parent in technical mode. */}
                {nodes.flatMap((n) =>
                  n.parents.map((pk, i) => {
                    const p = byKey.get(pk)!;
                    const a = pos(p);
                    const b = pos(n);
                    const lit = ancestry.has(n.key) && ancestry.has(pk);
                    const color = lanes[i === 0 ? n.branch : p.branch].color;
                    const d = edgePath(a, b);
                    return (
                      <g key={`${pk}-${n.key}`}>
                        {lit && (
                          <path
                            d={d}
                            fill="none"
                            stroke={color}
                            strokeWidth={8}
                            strokeOpacity={0.18}
                            strokeLinecap="round"
                          />
                        )}
                        <motion.path
                          d={d}
                          fill="none"
                          stroke={color}
                          strokeWidth={lit ? 3 : 2}
                          strokeOpacity={lit ? 1 : 0.28}
                          markerStart={technical ? "url(#arrow)" : undefined}
                          initial={reduce ? false : { pathLength: 0 }}
                          animate={{ pathLength: shown ? 1 : 0 }}
                          transition={{ duration: 0.9, delay: reduce ? 0 : n.x * 0.09, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </g>
                    );
                  }),
                )}

                {/* Nodes */}
                {nodes.map((n) => {
                  const { x, y } = pos(n);
                  const lane = lanes[n.branch];
                  const isSel = n.key === selected;
                  const inPath = ancestry.has(n.key);
                  const tips = refsAt(n.key);
                  return (
                    <g key={n.key}>
                      <motion.g
                        initial={reduce ? false : { opacity: 0, scale: n.key === fresh ? 0 : 0.6 }}
                        animate={shown ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }}
                        transition={{ delay: reduce || n.key === fresh ? 0 : 0.2 + n.x * 0.09, type: "spring", stiffness: 260, damping: 18 }}
                        style={{ originX: `${x}px`, originY: `${y}px` }}
                      >
                        <circle
                          cx={x}
                          cy={y}
                          r={isSel ? 16 : 12}
                          fill={lane.glow}
                          opacity={inPath ? 0.28 : 0.08}
                        />
                        <circle
                          cx={x}
                          cy={y}
                          r={isSel ? 8.5 : 6.5}
                          fill={inPath ? "#fff" : "#2a2636"}
                          stroke={lane.color}
                          strokeWidth={2}
                          className="cursor-pointer"
                          tabIndex={0}
                          role="button"
                          aria-label={`Commit ${short(n.oid)}: ${n.message}`}
                          aria-pressed={isSel}
                          onClick={() => setSelected(n.key)}
                          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelected(n.key))}
                        />
                        {isSel && (
                          <circle cx={x} cy={y} r={20} fill="none" stroke={lane.color} strokeOpacity={0.5} strokeDasharray="3 5" />
                        )}
                      </motion.g>

                      {technical && (
                        <text x={x} y={y + 30} textAnchor="middle" className="fill-[#8f89a0] font-mono text-[10px]">
                          {short(n.oid)}
                        </text>
                      )}

                      {tips.map((b, i) => (
                        <motion.g
                          key={`${b}-${n.key}`}
                          initial={reduce ? false : { opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35, delay: n.key === fresh ? 0.25 : 0 }}
                        >
                          <rect
                            x={x + 18}
                            y={y - 30 - i * 22}
                            rx={9}
                            height={19}
                            width={b.length * 6.6 + (b === "main" && technical ? 64 : 18)}
                            fill="#191720"
                            stroke={lanes[b].color}
                            strokeOpacity={0.7}
                          />
                          <text x={x + 27} y={y - 17 - i * 22} className="font-mono text-[10.5px]" fill={lanes[b].color}>
                            {b}
                            {b === "main" && technical ? "  ← HEAD" : ""}
                          </text>
                        </motion.g>
                      ))}
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="chip h-9 border-line-2 bg-transparent disabled:opacity-40"
                  disabled={!earlier}
                  onClick={() => earlier && setSelected(earlier)}
                >
                  <ChevronLeft size={15} /> Earlier
                </button>
                <button
                  type="button"
                  className="chip h-9 border-line-2 bg-transparent disabled:opacity-40"
                  disabled={!later}
                  onClick={() => later && setSelected(later.key)}
                >
                  Later <ChevronRight size={15} />
                </button>
              </div>
              <div className="flex gap-1.5">
                <button type="button" className="chip h-9 border-line-2 bg-transparent" onClick={reset}>
                  <RotateCcw size={13} /> Reset
                </button>
                <button
                  type="button"
                  onClick={createSnapshot}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-[#f3f1f8] px-3.5 text-[0.82rem] font-medium text-[#191720] transition-transform hover:-translate-y-0.5"
                >
                  <Plus size={15} /> Snapshot on {branchOfSelection}
                </button>
              </div>
            </div>
          </div>

          {/* Details */}
          <aside className="rounded-[28px] border border-line bg-[#14121b] p-6 xl:col-span-4" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={sel.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <div className="flex items-center gap-2 text-[0.8rem] text-ink-3">
                  <GitBranch size={14} style={{ color: lanes[sel.branch].color }} />
                  made on <span className="font-mono text-ink-2">{sel.branch}</span>
                </div>
                <h3 className="display mt-3 text-[2rem] leading-[1.05]">{sel.message}</h3>

                <dl className="mt-6 space-y-4 text-[0.85rem]">
                  <div>
                    <dt className="text-ink-3">Commit ID</dt>
                    <dd className="mt-1 break-all font-mono text-[0.78rem] text-ink">{technical ? sel.oid : short(sel.oid)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-3">{sel.parents.length > 1 ? "Parents (a merge)" : "Parent"}</dt>
                    <dd className="mt-1 flex flex-wrap gap-1.5">
                      {sel.parents.length === 0 && <span className="text-ink-2">None. This is where history begins.</span>}
                      {sel.parents.map((pk) => {
                        const p = byKey.get(pk)!;
                        return (
                          <button
                            key={pk}
                            type="button"
                            onClick={() => setSelected(pk)}
                            className="rounded-md border border-line-2 px-2 py-1 font-mono text-[0.75rem] text-ink-2 transition-colors hover:border-lilac hover:text-ink"
                          >
                            {short(p.oid)}
                          </button>
                        );
                      })}
                    </dd>
                  </div>
                  {technical && (
                    <div>
                      <dt className="text-ink-3">Root tree</dt>
                      <dd className="mt-1 break-all font-mono text-[0.78rem] text-ink-2">{sel.tree}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-ink-3">Reachable history</dt>
                    <dd className="mt-1 text-ink-2">
                      {ancestry.size} commit{ancestry.size === 1 ? "" : "s"}, including this one
                    </dd>
                  </div>
                  {refsAt(sel.key).length > 0 && (
                    <div>
                      <dt className="text-ink-3">Branches pointing here</dt>
                      <dd className="mt-1 font-mono text-[0.78rem] text-ink-2">{refsAt(sel.key).join(", ")}</dd>
                    </div>
                  )}
                </dl>

                <p className="mt-6 border-t border-line pt-5 text-[0.85rem] leading-relaxed text-ink-3">
                  {sel.parents.length > 1
                    ? "A merge commit has two parents. Both lines of history become reachable from here."
                    : "Commits can't be edited. Changing anything here would produce a different ID and a different commit."}
                </p>
              </motion.div>
            </AnimatePresence>
          </aside>
        </div>
      </div>
    </section>
  );
}
