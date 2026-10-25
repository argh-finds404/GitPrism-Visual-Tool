"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Aurora } from "@/components/ui/Aurora";

/* Small line illustrations, one idea per stage. */
const glyphs = [
  // Working file
  <g key="0">
    <path d="M14 8h20l8 8v28H14z" />
    <path d="M34 8v8h8M20 26h16M20 32h12" />
  </g>,
  // Objects: blob -> tree -> commit
  <g key="1">
    <circle cx="12" cy="40" r="4" />
    <circle cx="28" cy="40" r="4" />
    <rect x="16" y="22" width="12" height="8" rx="2" />
    <path d="M22 30l-8 6M22 30l5 6M22 22v-6" />
    <circle cx="22" cy="12" r="4" />
  </g>,
  // History graph
  <g key="2">
    <path d="M6 30h40M16 30c6 0 6-14 14-14h16" />
    <circle cx="16" cy="30" r="3.5" />
    <circle cx="32" cy="30" r="3.5" />
    <circle cx="38" cy="16" r="3.5" />
  </g>,
  // Comparing two states
  <g key="3">
    <rect x="6" y="10" width="16" height="32" rx="2" />
    <rect x="30" y="10" width="16" height="32" rx="2" />
    <path d="M10 18h8M10 24h6M34 18h8M34 24h8M34 30h5" />
  </g>,
  // Deeper: layered internals
  <g key="4">
    <path d="M26 8l18 9-18 9-18-9z" />
    <path d="M8 26l18 9 18-9M8 34l18 9 18-9" />
  </g>,
];

// Each stage takes one colour of the spectrum, in order, like light leaving the prism.
const stages = [
  {
    title: "Foundations",
    body: "Working files, staging, commits and the states a repository moves through.",
    color: "var(--violet)",
    href: "#playground",
    cta: "Start here",
    facts: ["Edit a real file, stage it, commit it", "Watch the states change live"],
  },
  {
    title: "Git objects",
    body: "Blobs, trees and commits, and why Git addresses everything by content.",
    color: "var(--cyan)",
    href: "#how",
    cta: "Chapter 2",
    facts: ["Real SHA-1 IDs, computed as you watch", "Content, not filenames, decides identity"],
  },
  {
    title: "History",
    body: "Parent commits, references and how commit graphs branch and merge.",
    color: "var(--add)",
    href: "#history",
    cta: "Chapter 5",
    facts: ["Branch, merge and follow parents", "See exactly what a merge commit is"],
  },
  {
    title: "Comparing states",
    body: "Diffs, inspecting snapshots and reading what actually changed.",
    color: "var(--magenta)",
    href: "#diff",
    cta: "Chapter 4",
    facts: ["Unified and split diff views", "Step hunk by hunk through a change"],
  },
  {
    title: "Deeper understanding",
    body: "How objects relate on disk, and selected parts of Git's internals.",
    color: "var(--amber)",
    href: "/lab",
    cta: "Open the lab",
    facts: ["A full, guided workbench", "Inspect any object you create"],
  },
];

export function Journey() {
  // One stage at a time: the path is visible, the detail is not, until you step onto it.
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const s = stages[active];
  const next = stages[active + 1];

  const go = (i: number) => {
    const n = (i + stages.length) % stages.length;
    setActive(n);
    tabs.current[n]?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      go(active + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      go(active - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(stages.length - 1);
    }
  };

  return (
    <section id="journey" aria-labelledby="journey-title" className="relative overflow-hidden py-28 md:py-36">
      <Aurora tones={["amber", "violet"]} />
      <div className="shell relative">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 id="journey-title" className="display text-[clamp(2.3rem,5vw,4.4rem)] lg:col-span-7">
            Start with what you see. Finish with how it works.
          </h2>
          <p className="max-w-[30rem] text-[1.04rem] leading-relaxed text-ink-2 lg:col-span-5">
            Five stages, each built on the one before. Step through them in order.
          </p>
        </div>

        <div role="tablist" aria-label="Learning path" onKeyDown={onKey} className="relative mt-16 grid grid-cols-5">
          {/* The beam: lit up to the current stage. */}
          <span aria-hidden="true" className="absolute left-[10%] right-[10%] top-[23px] h-px bg-line-2" />
          <motion.span
            aria-hidden="true"
            className="absolute left-[10%] top-[23px] h-px origin-left"
            style={{ width: "80%", background: "linear-gradient(90deg, var(--violet), var(--cyan), var(--add), var(--magenta), var(--amber))" }}
            initial={false}
            animate={{ scaleX: active / (stages.length - 1) }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
          {stages.map((st, i) => {
            const on = i === active;
            const reached = i <= active;
            return (
              <button
                key={st.title}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`stage-tab-${i}`}
                aria-selected={on}
                aria-controls="stage-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                className="group relative flex flex-col items-center gap-3 text-center"
                style={{ ["--stage" as string]: st.color }}
              >
                <span
                  className={`relative z-[1] grid h-12 w-12 place-items-center rounded-full border font-mono text-[0.8rem] transition-[background-color,color,box-shadow] duration-300 group-hover:shadow-[0_0_24px_-4px_var(--stage)] ${
                    on ? "text-paper shadow-[0_0_30px_-6px_var(--stage)]" : "bg-paper"
                  }`}
                  style={{ borderColor: reached ? st.color : "var(--line-2)", color: on ? undefined : reached ? st.color : "var(--ink-3)", background: on ? st.color : undefined }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={`hidden text-[0.95rem] font-medium transition-colors md:block ${on ? "text-ink" : "text-ink-3 group-hover:text-ink-2"}`}>{st.title}</span>
              </button>
            );
          })}
        </div>

        <div id="stage-panel" role="tabpanel" aria-labelledby={`stage-tab-${active}`} className="panel relative mx-auto mt-10 rounded-3xl max-w-[52rem] overflow-hidden p-6 md:p-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-25 transition-[background] duration-500"
            style={{ background: `radial-gradient(closest-side, ${s.color}, transparent 72%)` }}
          />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="grid gap-6 md:grid-cols-[auto_1fr] md:items-center md:gap-9"
            >
              <svg
                viewBox="0 0 52 52"
                className="h-16 w-16 md:h-24 md:w-24"
                style={{ color: s.color }}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {glyphs[active]}
              </svg>
              <div>
                <p className="font-mono text-[0.78rem]" style={{ color: s.color }}>
                  stage {active + 1} of {stages.length}
                </p>
                <h3 className="display mt-2 text-[clamp(1.6rem,2.6vw,2.2rem)] text-ink">{s.title}</h3>
                <p className="mt-3 max-w-[34rem] leading-relaxed text-ink-2">{s.body}</p>
                <ul className="mt-4 flex flex-col gap-1.5">
                  {s.facts.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[0.85rem] text-ink-2">
                      <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                  {s.href.startsWith("/") ? (
                    <Link href={s.href} className="inline-flex items-center gap-1 text-[0.92rem] font-medium hover:underline" style={{ color: s.color }}>
                      {s.cta} <ArrowUpRight size={15} />
                    </Link>
                  ) : (
                    <a href={s.href} className="inline-flex items-center gap-1 text-[0.92rem] font-medium hover:underline" style={{ color: s.color }}>
                      {s.cta} <ArrowUpRight size={15} />
                    </a>
                  )}
                  {next && (
                    <button type="button" onClick={() => setActive(active + 1)} className="inline-flex items-center gap-1.5 text-[0.92rem] text-ink-3 transition-colors hover:text-ink">
                      Next: {next.title} <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
