"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowUp, ArrowUpRight } from "lucide-react";
import { Wordmark } from "@/components/brand/PrismMark";

const STORY_LINKS = [
  { n: "01", label: "The Problem", href: "#problem" },
  { n: "02", label: "The Reveal", href: "#how" },
  { n: "03", label: "The Lab", href: "#playground" },
  { n: "04", label: "The Difference", href: "#diff" },
  { n: "05", label: "History Graph", href: "#history" },
  { n: "06", label: "Content Addressing", href: "#identity" },
];

const PLUMBING_LINKS = [
  { label: "Git Internals (Pro Git)", href: "https://git-scm.com/book/en/v2/Git-Internals-Git-Objects" },
  { label: "git hash-object", href: "https://git-scm.com/docs/git-hash-object" },
  { label: "git cat-file", href: "https://git-scm.com/docs/git-cat-file" },
  { label: "Git Glossary", href: "https://git-scm.com/docs/gitglossary" },
];

const INTERNALS_LINKS = [
  { label: "Bit-Exact SHA-1 Engine", href: "#identity" },
  { label: "Local-First IndexedDB", href: "/lab" },
  { label: "PR Impact Studio", href: "/review/gitprism-demo/acme-shop/pull/42" },
  { label: "Five 3D Analysis Lenses", href: "/review/gitprism-demo/acme-shop/pull/42" },
];

export function Footer() {
  const mark = useRef<HTMLDivElement>(null);

  // The oversized wordmark catches the light spectrum where the pointer moves
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = mark.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const scrollToTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <footer className="relative overflow-hidden pt-20 border-t border-line/70">
      {/* Prismatic hairline refraction glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--violet) 25%, var(--cyan) 50%, var(--magenta) 75%, transparent 100%)",
          opacity: 0.7,
        }}
      />

      <div className="shell">
        {/* Main Clean Asymmetric Grid */}
        <div className="grid gap-12 pb-16 lg:grid-cols-12">
          {/* Brand & Manifesto Column (Left 5 Cols) */}
          <div className="space-y-6 lg:col-span-5">
            <div className="flex items-center gap-3">
              <Wordmark />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-2 px-2.5 py-0.5 font-mono text-[11px] text-ink-3">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-add" />
                local-first
              </span>
            </div>

            <p className="max-w-[24rem] text-[0.95rem] leading-relaxed text-ink-2">
              Git makes sense when you can see it. An interactive exploration of blobs, trees, snapshots, and
              the spacetime of code.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link href="/lab" className="btn btn-primary btn-sm group">
                <span>Open Lab Workbench</span>
                <ArrowUpRight size={15} className="btn-arrow" />
              </Link>

              <Link href="/review/gitprism-demo/acme-shop/pull/42" className="btn btn-ghost btn-sm group">
                <span>PR Review Studio</span>
                <ArrowUpRight size={15} className="btn-arrow" />
              </Link>
            </div>
          </div>

          {/* Navigation Columns (Right 7 Cols) */}
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-7">
            {/* Story Chapters */}
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                The Story
              </h3>
              <ul className="mt-4 space-y-2.5">
                {STORY_LINKS.map((item) => (
                  <li key={item.n}>
                    <a
                      href={item.href}
                      className="group flex items-center gap-2 text-[0.88rem] text-ink-2 transition-colors hover:text-violet-ink"
                    >
                      <span className="font-mono text-[10px] text-ink-3 group-hover:text-violet-ink">
                        {item.n}
                      </span>
                      <span>{item.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Git Plumbing Specs */}
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                Plumbing Specs
              </h3>
              <ul className="mt-4 space-y-2.5">
                {PLUMBING_LINKS.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-1 text-[0.88rem] text-ink-2 transition-colors hover:text-violet-ink"
                    >
                      <span>{item.label}</span>
                      <ArrowUpRight size={12} className="opacity-40 transition-opacity group-hover:opacity-100" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Architecture / Internals */}
            <div>
              <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-3">
                Architecture
              </h3>
              <ul className="mt-4 space-y-2.5">
                {INTERNALS_LINKS.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="text-[0.88rem] text-ink-2 transition-colors hover:text-violet-ink">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
      </div>

      {/* Giant Optical Spectrum Wordmark */}
      <div
        ref={mark}
        onPointerMove={onMove}
        aria-hidden="true"
        className="relative select-none overflow-hidden px-4 pt-10 pb-4 border-t border-line/40"
        style={{ ["--mx" as string]: "50%", ["--my" as string]: "50%" }}
      >
        <div className="text-center font-mono text-[10px] tracking-[0.3em] uppercase text-ink-3/70 mb-2">
          Light in • Spectral history out
        </div>
        <div
          className="display text-center text-[clamp(5.5rem,23vw,21rem)] leading-[0.8] tracking-[-0.04em]"
          style={{
            backgroundImage:
              "radial-gradient(32rem circle at var(--mx) var(--my), var(--magenta) 0%, var(--violet) 32%, var(--cyan) 60%, transparent 82%), linear-gradient(var(--line-2), var(--line-2))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          GitPrism
        </div>
      </div>

      {/* Baseline Utility Strip */}
      <div className="border-t border-line/60 bg-paper-2/40 py-5">
        <div className="shell flex flex-col items-center justify-between gap-4 text-[0.8rem] text-ink-3 sm:flex-row">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p>© 2026 GitPrism. Built to make Git visible.</p>
            <span className="hidden text-line-2 sm:inline">•</span>
            <p className="text-[0.76rem]">
              Git® is a trademark of Software Freedom Conservancy.
            </p>
          </div>

          <button
            type="button"
            onClick={scrollToTop}
            className="group flex items-center gap-1.5 rounded-full border border-line-2 bg-surface px-3 py-1 text-[12px] font-medium text-ink-2 shadow-sm transition-all hover:border-violet hover:text-violet-ink hover:shadow"
            aria-label="Scroll smoothly to the top of the page"
          >
            <span>Back to top</span>
            <ArrowUp size={13} className="transition-transform group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
