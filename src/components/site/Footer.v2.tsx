"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  Layers,
  Sparkles,
  Terminal,
} from "lucide-react";
import { PrismMark, Wordmark } from "@/components/brand/PrismMark";
import { hashBlob, short } from "@/lib/git";

interface FooterLink {
  label: string;
  href: string;
  badge?: string;
  external?: boolean;
}

interface FooterColumn {
  title: string;
  icon: typeof Terminal;
  links: FooterLink[];
}

const columns: FooterColumn[] = [
  {
    title: "Interactive Lab",
    icon: Layers,
    links: [
      { label: "Lab Workbench", href: "/lab", badge: "Live IDE" },
      { label: "PR Impact Studio", href: "/review/gitprism-demo/acme-shop/pull/42", badge: "3D Review" },
      { label: "Visual Staging & Snapshots", href: "#playground" },
      { label: "State Difference Matrix", href: "#diff" },
      { label: "History Branch DAG", href: "#history" },
    ],
  },
  {
    title: "The Git Story",
    icon: GitBranch,
    links: [
      { label: "The Problem with Blind Git", href: "#problem" },
      { label: "The Reveal: Object Anatomy", href: "#how" },
      { label: "Content Addressing & Hashing", href: "#identity" },
      { label: "Snapshot Deduplication", href: "#identity" },
      { label: "5-Stage Learning Journey", href: "#journey" },
    ],
  },
  {
    title: "Plumbing Reference",
    icon: Terminal,
    links: [
      { label: "Pro Git: Object Storage", href: "https://git-scm.com/book/en/v2/Git-Internals-Git-Objects", external: true },
      { label: "git hash-object Manual", href: "https://git-scm.com/docs/git-hash-object", external: true },
      { label: "git cat-file Inspection", href: "https://git-scm.com/docs/git-cat-file", external: true },
      { label: "Git Internals Glossary", href: "https://git-scm.com/docs/gitglossary", external: true },
      { label: "SHA-1 Content Security", href: "https://git-scm.com/docs/git-fsck", external: true },
    ],
  },
  {
    title: "Optic Architecture",
    icon: Sparkles,
    links: [
      { label: "Bit-Exact SHA-1 Engine", href: "#identity", badge: "Pure JS" },
      { label: "WebGL Prism Shaders", href: "#top", badge: "R3F" },
      { label: "IndexedDB Local Storage", href: "/lab", badge: "Offline" },
      { label: "Turbopack Next.js 16", href: "#top" },
      { label: "Tailwind CSS v4 Design", href: "#top" },
    ],
  },
];

export function Footer() {
  const mark = useRef<HTMLDivElement>(null);
  const [testInput, setTestInput] = useState("git commit -m 'visualize'");
  const [copied, setCopied] = useState(false);

  // Computes genuine Git SHA-1 hash for user verification right in the footer
  const liveHash = useMemo(() => {
    try {
      return hashBlob(testInput + "\n");
    } catch {
      return "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
    }
  }, [testInput]);

  const onCopyHash = () => {
    navigator.clipboard.writeText(liveHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = mark.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative overflow-hidden bg-paper pt-20 text-ink">
      {/* Refraction boundary hairline at the top */}
      <div className="relative h-px w-full overflow-hidden">
        <div
          className="absolute inset-0 opacity-80"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, var(--violet) 25%, var(--cyan) 50%, var(--magenta) 75%, transparent 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute -top-3 left-1/4 h-8 w-1/2 rounded-full opacity-20 blur-xl"
          style={{
            background:
              "radial-gradient(ellipse at center, var(--violet) 0%, var(--cyan) 50%, transparent 80%)",
          }}
        />
      </div>

      <div className="shell pt-12 md:pt-16">
        {/* Top Interactive Station: Brand, Live Refractor, and Highlighted Modules */}
        <div className="grid gap-8 lg:grid-cols-12 lg:items-start border-b border-line pb-14">
          {/* Brand Info & Mission */}
          <div className="lg:col-span-5 space-y-5">
            <div className="flex items-center gap-3">
              <Wordmark />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/80 px-2.5 py-0.5 text-[11px] font-mono text-ink-3">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                local-first engine
              </span>
            </div>

            <p className="max-w-[26rem] text-[0.93rem] leading-relaxed text-ink-2">
              GitPrism turns Git&apos;s opaque command-line plumbing into an interactive, visual optical
              laboratory. Every object ID is computed byte-for-byte in real time using true SHA-1 hashing.
            </p>

            {/* Live Interactive SHA-1 Hash Refractor Widget */}
            <div className="rounded-2xl border border-line bg-surface/60 p-4 backdrop-blur-md shadow-soft">
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-ink-3">
                <span className="flex items-center gap-1.5">
                  <Terminal size={12} className="text-violet" />
                  Instant SHA-1 Refractor
                </span>
                <span className="text-[10px] text-ink-3">blob format</span>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Type any message..."
                  aria-label="Input content to hash"
                  className="h-8 flex-1 rounded-lg border border-line bg-paper px-2.5 font-mono text-[12px] text-ink outline-none transition-colors focus:border-violet"
                />
                <button
                  type="button"
                  onClick={onCopyHash}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 text-[11px] font-mono text-ink-2 transition-colors hover:border-violet hover:text-ink"
                  title="Copy full SHA-1 hash"
                >
                  {copied ? (
                    <>
                      <Check size={12} className="text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>{short(liveHash)}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-ink-3 truncate">
                <span className="truncate">hash: {liveHash}</span>
              </div>
            </div>
          </div>

          {/* Quick Launch Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
            {/* Workbench Launcher */}
            <a
              href="/lab"
              className="group relative overflow-hidden rounded-2xl border border-line bg-surface/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-violet/60 hover:bg-surface/80 hover:shadow-soft"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet/10 text-violet">
                  <Layers size={18} />
                </span>
                <span className="rounded-full bg-violet/10 px-2 py-0.5 font-mono text-[10.5px] font-medium text-violet">
                  Interactive IDE
                </span>
              </div>
              <h4 className="mt-4 text-[0.98rem] font-medium text-ink group-hover:text-violet transition-colors">
                Open Lab Workbench
              </h4>
              <p className="mt-1 text-[0.83rem] leading-snug text-ink-3">
                Live sandbox to edit, stage, commit, branch, and inspect Git objects in 3D.
              </p>
              <div className="mt-4 flex items-center gap-1 text-[11.5px] font-medium text-violet">
                <span>Launch workbench</span>
                <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </a>

            {/* Impact Studio Launcher */}
            <a
              href="/review/gitprism-demo/acme-shop/pull/42"
              className="group relative overflow-hidden rounded-2xl border border-line bg-surface/40 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan/60 hover:bg-surface/80 hover:shadow-soft"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
                  <Sparkles size={18} />
                </span>
                <span className="rounded-full bg-cyan/10 px-2 py-0.5 font-mono text-[10.5px] font-medium text-cyan">
                  3D PR Review
                </span>
              </div>
              <h4 className="mt-4 text-[0.98rem] font-medium text-ink group-hover:text-cyan transition-colors">
                Impact Studio Visualizer
              </h4>
              <p className="mt-1 text-[0.83rem] leading-snug text-ink-3">
                5D blast radius mapping, architecture boundary checks, and AI agent context packs.
              </p>
              <div className="mt-4 flex items-center gap-1 text-[11.5px] font-medium text-cyan">
                <span>Inspect demo PR #42</span>
                <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </a>
          </div>
        </div>

        {/* Navigation Grid (Organized, active links with subtle tags) */}
        <nav aria-label="Footer Navigation" className="grid grid-cols-2 gap-8 py-14 sm:grid-cols-4 border-b border-line">
          {columns.map((col) => {
            const Icon = col.icon;
            return (
              <div key={col.title} className="space-y-4">
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-violet-ink" />
                  <h3 className="text-[0.84rem] font-semibold uppercase tracking-wider text-ink">
                    {col.title}
                  </h3>
                </div>

                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        {...(link.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                        className="group flex items-center justify-between gap-1.5 text-[0.86rem] text-ink-2 transition-colors hover:text-violet-ink"
                      >
                        <span className="truncate group-hover:underline underline-offset-4 decoration-violet/40">
                          {link.label}
                        </span>
                        {link.badge ? (
                          <span className="shrink-0 rounded-full border border-line-2 bg-paper-2 px-1.5 py-0.2 text-[9.5px] font-mono text-ink-3">
                            {link.badge}
                          </span>
                        ) : link.external ? (
                          <ExternalLink size={11} className="shrink-0 opacity-40 transition-opacity group-hover:opacity-100" />
                        ) : null}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Giant Interactive Optical Refracting Wordmark */}
      <div
        ref={mark}
        onPointerMove={onMove}
        aria-hidden="true"
        className="relative select-none overflow-hidden px-4 pt-10 pb-4"
        style={{ ["--mx" as string]: "50%", ["--my" as string]: "50%" }}
      >
        <div className="text-center font-mono text-[10px] tracking-[0.35em] uppercase text-ink-3/70 mb-1">
          Light In • Spectral History Out
        </div>
        <div
          className="display text-center text-[clamp(5.2rem,22vw,19rem)] leading-[0.8] tracking-[-0.04em] transition-transform duration-300 hover:scale-[1.01]"
          style={{
            backgroundImage:
              "radial-gradient(32rem circle at var(--mx) var(--my), #e85ac4 0%, #7654e8 30%, #68d9f5 55%, transparent 80%), linear-gradient(var(--line-2), var(--line-2))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          GitPrism
        </div>
      </div>

      {/* Bottom Utility Deck: Attribution, Shortcuts & Back to Top */}
      <div className="border-t border-line/60 bg-paper-2/40 py-5">
        <div className="shell flex flex-col items-center justify-between gap-4 text-[0.8rem] text-ink-3 sm:flex-row">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p>© 2026 GitPrism. Built to make Git visible.</p>
            <span className="hidden text-line-2 sm:inline">•</span>
            <p className="text-[0.76rem]">
              Git® is a trademark of Software Freedom Conservancy.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden rounded-md border border-line bg-surface/80 px-2 py-0.5 font-mono text-[11px] text-ink-3 md:inline-block">
              esc to close • [1-5] lenses
            </span>
            <button
              type="button"
              onClick={scrollToTop}
              className="group flex items-center gap-1.5 rounded-full border border-line-2 bg-surface px-3 py-1 text-[12px] font-medium text-ink-2 shadow-sm transition-all hover:border-violet hover:text-violet-ink hover:shadow"
              aria-label="Scroll back to top"
            >
              <span>Surface</span>
              <ArrowUp size={13} className="transition-transform group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
