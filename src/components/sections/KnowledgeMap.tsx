"use client";

import { useRef, useState } from "react";
import { useInView } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { Aurora } from "@/components/ui/Aurora";
import { usePrefersReducedMotion } from "@/lib/theme";
import { useAutoCycle } from "@/lib/useAutoCycle";

type TopicKey = "objects" | "history" | "diffs" | "storage";

const topics: {
  key: TopicKey;
  title: string;
  body: string;
  href: string;
  cta: string;
  anchor: { x: number; y: number };
  color: string;
}[] = [
  {
    key: "objects",
    title: "Objects & hashes",
    body: "Blobs, trees, commits and how each one gets its ID.",
    href: "#how",
    cta: "See it in chapter 2",
    anchor: { x: 19, y: 24 },
    color: "var(--violet)",
  },
  {
    key: "history",
    title: "Branches & history",
    body: "References, parents and how history grows.",
    href: "#history",
    cta: "Explore chapter 5",
    anchor: { x: 81, y: 24 },
    color: "var(--cyan)",
  },
  {
    key: "diffs",
    title: "Diffs & snapshots",
    body: "Inspect changes between two project states.",
    href: "#diff",
    cta: "Compare in chapter 4",
    anchor: { x: 19, y: 76 },
    color: "var(--magenta)",
  },
  {
    key: "storage",
    title: "Storage & structure",
    body: "What lives inside .git and how objects connect.",
    href: "#identity",
    cta: "Unseal it in chapter 6",
    anchor: { x: 81, y: 76 },
    color: "var(--amber)",
  },
];

// Concept nodes around each topic, plus the links between ideas.
const concepts: { id: string; label: string; topic: TopicKey; x: number; y: number }[] = [
  { id: "blob", label: "blob", topic: "objects", x: 39, y: 10 },
  { id: "tree", label: "tree", topic: "objects", x: 43, y: 27 },
  { id: "commit", label: "commit", topic: "objects", x: 36, y: 46 },
  { id: "sha", label: "SHA-1", topic: "objects", x: 12, y: 50 },
  { id: "ref", label: "ref", topic: "history", x: 61, y: 10 },
  { id: "head", label: "HEAD", topic: "history", x: 57, y: 27 },
  { id: "parent", label: "parent", topic: "history", x: 64, y: 46 },
  { id: "merge", label: "merge", topic: "history", x: 88, y: 50 },
  { id: "snapshot", label: "snapshot", topic: "diffs", x: 26, y: 55 },
  { id: "diff", label: "diff", topic: "diffs", x: 42, y: 72 },
  { id: "hunk", label: "hunk", topic: "diffs", x: 40, y: 90 },
  { id: "objects", label: ".git/objects", topic: "storage", x: 58, y: 72 },
  { id: "zlib", label: "zlib", topic: "storage", x: 62, y: 90 },
  { id: "pack", label: "packfile", topic: "storage", x: 76, y: 55 },
];

const links: [string, string][] = [
  ["blob", "tree"],
  ["tree", "commit"],
  ["sha", "blob"],
  ["commit", "parent"],
  ["ref", "head"],
  ["parent", "merge"],
  ["ref", "parent"],
  ["commit", "snapshot"],
  ["snapshot", "diff"],
  ["diff", "hunk"],
  ["blob", "objects"],
  ["objects", "zlib"],
  ["objects", "pack"],
  ["tree", "snapshot"],
  ["commit", "ref"],
];

const byId = new Map(concepts.map((c) => [c.id, c]));
const colorOf = (t: TopicKey) => topics.find((x) => x.key === t)!.color;

export function KnowledgeMap() {
  const reduce = usePrefersReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const inView = useInView(panelRef, { margin: "-10% 0px" });
  // Real hover/focus always wins; with nobody pointing at anything, the map demonstrates
  // itself by cycling through each area, so the connections are seen without being hovered.
  const [hover, setHover] = useState<TopicKey | null>(null);
  const autoIndex = useAutoCycle(topics.length, inView && !reduce && hover === null, 2600);
  const active = hover ?? (inView && !reduce ? topics[autoIndex].key : null);
  const isLit = (t: TopicKey) => !active || active === t;

  return (
    <section id="learn" aria-labelledby="learn-title" className="relative overflow-hidden bg-paper-2 py-28 md:py-36">
      <Aurora tones={["cyan", "magenta", "amber"]} />
      <div className="shell relative">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 id="learn-title" className="display text-[clamp(2.6rem,5.6vw,4.9rem)] lg:col-span-7">
            Everything in Git connects. Explore it as a map.
          </h2>
          <p className="max-w-[30rem] text-[1.04rem] leading-relaxed text-ink-2 lg:col-span-5">
            Four areas, one model, demonstrating itself below. Hover an area to take over, then open the topic to go deeper.
          </p>
        </div>

        <div
          ref={panelRef}
          className="panel relative mt-8 overflow-hidden rounded-[32px] lg:aspect-[16/9]"
          onPointerLeave={() => setHover(null)}
        >
          {/* Each area glows in its own colour; the active one brightens. */}
          <div aria-hidden="true" className="absolute inset-0 hidden lg:block">
            {topics.map((t) => (
              <span
                key={t.key}
                className="absolute h-[70%] w-[50%] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-500"
                style={{
                  left: `${t.anchor.x}%`,
                  top: `${t.anchor.y}%`,
                  background: `radial-gradient(closest-side, ${t.color}, color-mix(in oklab, ${t.color} 30%, transparent) 45%, transparent)`,
                  opacity: active === t.key ? 0.28 : active ? 0.05 : 0.12,
                }}
              />
            ))}
          </div>
          {/* The map itself */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 hidden h-full w-full lg:block"
            aria-hidden="true"
          >
            {links.map(([a, b]) => {
              const A = byId.get(a)!;
              const B = byId.get(b)!;
              const lit = active && (A.topic === active || B.topic === active);
              const color = lit ? colorOf(active!) : "var(--line-2)";
              return (
                <line
                  key={`${a}-${b}`}
                  x1={A.x}
                  y1={A.y}
                  x2={B.x}
                  y2={B.y}
                  vectorEffect="non-scaling-stroke"
                  stroke={color}
                  strokeWidth={lit ? 1.8 : 1}
                  style={{ filter: lit ? `drop-shadow(0 0 4px ${color})` : undefined }}
                  className={`transition-[stroke] duration-300 ${lit ? "flow" : ""}`}
                />
              );
            })}
          </svg>

          <div className="absolute inset-0 hidden lg:block" aria-hidden="true">
            {concepts.map((c) => (
              <span
                key={c.id}
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.72rem] transition-all duration-300 ${
                  active === c.topic ? "scale-110 text-ink" : isLit(c.topic) ? "text-ink-2" : "text-ink-3 opacity-40"
                }`}
                style={{
                  left: `${c.x}%`,
                  top: `${c.y}%`,
                  borderColor: active === c.topic ? colorOf(c.topic) : "var(--line-2)",
                  background: active === c.topic ? `color-mix(in oklab, ${colorOf(c.topic)} 22%, var(--surface))` : "var(--surface)",
                  boxShadow: active === c.topic ? `0 0 18px -4px ${colorOf(c.topic)}` : undefined,
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: colorOf(c.topic) }} />
                {c.label}
              </span>
            ))}
          </div>

          {/* Topic entry points */}
          <ul className="relative grid gap-px bg-line lg:absolute lg:inset-0 lg:block lg:bg-transparent">
            {topics.map((t) => (
              <li
                key={t.key}
                className="bg-paper lg:absolute lg:w-[min(29%,290px)] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:bg-transparent"
                style={{ left: `${t.anchor.x}%`, top: `${t.anchor.y}%` }}
              >
                <a
                  href={t.href}
                  onPointerEnter={() => setHover(t.key)}
                  onFocus={() => setHover(t.key)}
                  onBlur={() => setHover(null)}
                  className={`group relative block overflow-hidden p-6 transition-[translate,opacity,border-color,box-shadow] duration-300 lg:rounded-2xl lg:border lg:bg-surface lg:p-5 lg:shadow-soft ${
                    active === t.key ? "lg:-translate-y-1" : "lg:border-line"
                  } ${isLit(t.key) ? "" : "lg:opacity-50"}`}
                  style={active === t.key ? { borderColor: t.color, boxShadow: `0 20px 50px -24px ${t.color}` } : undefined}
                >
                  <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px]" style={{ background: t.color }} />
                  <span className="flex items-center justify-between">
                    <span className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rotate-45 rounded-[2px]" style={{ background: t.color }} />
                      <span className="text-[1.05rem] font-medium text-ink">{t.title}</span>
                    </span>
                    <ArrowUpRight
                      size={17}
                      className="text-ink-3 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet"
                    />
                  </span>
                  <span className="mt-2 block text-[0.9rem] leading-relaxed text-ink-2">{t.body}</span>
                  <span className="mt-3 block text-[0.82rem] font-medium" style={{ color: t.color }}>
                    {t.cta}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
