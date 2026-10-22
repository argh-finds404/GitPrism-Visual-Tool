"use client";

import { motion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

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

const stages = [
  { title: "Foundations", body: "Working files, staging, commits and the states a repository moves through." },
  { title: "Git objects", body: "Blobs, trees and commits, and why Git addresses everything by content." },
  { title: "History", body: "Parent commits, references and how commit graphs branch and merge." },
  { title: "Comparing states", body: "Diffs, inspecting snapshots and reading what actually changed." },
  { title: "Deeper understanding", body: "How objects relate on disk, and selected parts of Git's internals." },
];

export function Journey() {
  return (
    <section id="journey" aria-labelledby="journey-title" className="relative border-t border-line py-28 md:py-36">
      <div className="shell">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 id="journey-title" className="display text-[clamp(2.6rem,5.6vw,4.9rem)] lg:col-span-7">
            Start with what you see. Finish with how it works.
          </h2>
          <p className="max-w-[30rem] text-[1.04rem] leading-relaxed text-ink-2 lg:col-span-5">
            A path from first concepts to real Git internals. Each stage builds on the one before it.
          </p>
        </div>

        <ol className="relative mt-16 grid gap-10 md:grid-cols-5 md:gap-6">
          {/* The beam that runs through every stage */}
          <motion.span
            aria-hidden="true"
            className="absolute left-[23px] top-0 h-full w-px origin-top md:left-0 md:top-[23px] md:h-px md:w-full md:origin-left"
            style={{ background: "linear-gradient(90deg, var(--violet), var(--magenta), #ffb36b, var(--cyan))" }}
            initial={{ scaleX: 0, scaleY: 0 }}
            whileInView={{ scaleX: 1, scaleY: 1 }}
            viewport={{ once: true, margin: "-20% 0px" }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          />
          {stages.map((s, i) => (
            <li key={s.title} className="relative grid grid-cols-[48px_1fr] gap-5 md:block">
              <span className="relative z-[1] grid h-12 w-12 place-items-center rounded-full border border-line-2 bg-paper font-mono text-[0.8rem] text-violet">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="md:mt-7">
                <svg
                  viewBox="0 0 52 52"
                  className="mb-4 h-12 w-12 text-ink-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {glyphs[i]}
                </svg>
                <h3 className="text-[1.1rem] font-medium text-ink">{s.title}</h3>
                <p className="mt-2 text-[0.92rem] leading-relaxed text-ink-2">{s.body}</p>
                {i === 0 && (
                  <a href="#playground" className="mt-4 inline-flex items-center gap-1 text-[0.86rem] font-medium text-violet-ink hover:underline">
                    Start here <ArrowUpRight size={14} />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
