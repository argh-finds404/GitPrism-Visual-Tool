"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  Layers,
  Radio,
  Search,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { PrismMark, Wordmark } from "@/components/brand/PrismMark";
import { hashBlob, short } from "@/lib/git";

type GitLensKind = "blob" | "tree" | "commit" | "ref";

const LENS_DATA: Record<
  GitLensKind,
  {
    name: string;
    label: string;
    color: string;
    wavelength: string;
    command: string;
    output: string;
    description: string;
  }
> = {
  blob: {
    name: "Blob",
    label: "Content Atom",
    color: "#3ee0ff",
    wavelength: "480nm Cyan",
    command: "git cat-file -p 5b02562",
    output: "Hello GitPrism!\\nImmutable byte payload.",
    description: "Pure immutable file content. Names and folder structures are stripped away.",
  },
  tree: {
    name: "Tree",
    label: "Hierarchy Grating",
    color: "#4be3a6",
    wavelength: "530nm Emerald",
    command: "git cat-file -p 9e8841a",
    output: "100644 blob 5b02562\\thello.txt\\n040000 tree d41d8cd\\tsrc",
    description: "Directory matrix linking file paths and modes directly to blob and sub-tree IDs.",
  },
  commit: {
    name: "Commit",
    label: "Temporal Anchor",
    color: "#a98cff",
    wavelength: "405nm Violet",
    command: "git cat-file -p f3a912c",
    output: "tree 9e8841a\\nparent a1b2c3d\\nauthor You <dev@gitprism.dev>\\n\\nfeat: optical lens",
    description: "Freezes one complete root tree state with author attribution and parent ancestry.",
  },
  ref: {
    name: "Ref / HEAD",
    label: "Observer Focal Point",
    color: "#ffc15c",
    wavelength: "590nm Amber",
    command: "cat .git/HEAD",
    output: "ref: refs/heads/main\\n→ points to commit f3a912c",
    description: "Lightweight, movable pointer designating the active branch or detached HEAD position.",
  },
};

const CHAPTERS = [
  { n: "01", title: "The Problem", href: "#problem", tag: "Blind Git" },
  { n: "02", title: "The Reveal", href: "#how", tag: "Object Anatomy" },
  { n: "03", title: "The Lab", href: "#playground", tag: "Live Sandbox" },
  { n: "04", title: "The Diff", href: "#diff", tag: "Snapshot Delta" },
  { n: "05", title: "History DAG", href: "#history", tag: "Branch Spacetime" },
  { n: "06", title: "Content Addressing", href: "#identity", tag: "Deduplication" },
];

const SPECS = [
  { label: "Git Internals Manual (Pro Git)", href: "https://git-scm.com/book/en/v2/Git-Internals-Git-Objects" },
  { label: "git hash-object Specification", href: "https://git-scm.com/docs/git-hash-object" },
  { label: "git cat-file Plumbing Guide", href: "https://git-scm.com/docs/git-cat-file" },
  { label: "Git Directed Acyclic Graph Glossary", href: "https://git-scm.com/docs/gitglossary" },
  { label: "SHA-1 Merkle Cryptography", href: "https://git-scm.com/docs/git-fsck" },
];

export function Footer() {
  const mark = useRef<HTMLDivElement>(null);
  const [activeLens, setActiveLens] = useState<GitLensKind>("commit");
  const [hashInput, setHashInput] = useState("Hello GitPrism!");
  const [copied, setCopied] = useState(false);

  // Compute bit-exact Git blob SHA-1 hash in real-time
  const computedHash = useMemo(() => {
    try {
      return hashBlob(hashInput + "\n");
    } catch {
      return "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
    }
  }, [hashInput]);

  const onCopyHash = () => {
    navigator.clipboard.writeText(computedHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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

  const currentLens = LENS_DATA[activeLens];

  return (
    <footer className="relative overflow-hidden bg-[#06050c] text-[#f5f2ff] selection:bg-violet-500/30">
      {/* 1. Chromatic Prismatic Boundary Header */}
      <div className="relative h-1 w-full overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, #3ee0ff 0%, #4be3a6 25%, #a98cff 50%, #ff5cb8 75%, #ffc15c 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute -top-4 left-1/4 h-10 w-1/2 rounded-full opacity-40 blur-2xl"
          style={{
            background:
              "radial-gradient(ellipse at center, #a98cff 0%, #3ee0ff 60%, transparent 80%)",
          }}
        />
      </div>

      {/* Ambient background optics */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 20%, rgba(169, 140, 255, 0.22) 0%, transparent 45%), radial-gradient(circle at 82% 65%, rgba(62, 224, 255, 0.18) 0%, transparent 50%)",
        }}
      />

      <div className="shell relative z-10 pt-16 md:pt-24 pb-14">
        {/* 2. Primary Bento Command Deck */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Card A: Brand & Mission with Holographic Telemetry (Col 1-5) */}
          <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.03] p-7 md:p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] lg:col-span-5">
            <div>
              <div className="flex items-center justify-between">
                <Wordmark />
                <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-[#4be3a6]">
                  <span className="h-2 w-2 rounded-full bg-[#4be3a6] animate-pulse" />
                  SHA-1 SYNCHRONIZED
                </span>
              </div>

              <p className="mt-6 text-[1.02rem] leading-relaxed text-[#c4b5ff]/90">
                GitPrism demystifies Git&apos;s internal architecture through interactive optical physics, 3D
                spatial models, and real-time content-addressed cryptography.
              </p>
            </div>

            {/* Live SHA-1 Plumbing Calculator */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-[#0d0a1a] p-4.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#8c84ab]">
                <span className="flex items-center gap-1.5 text-[#3ee0ff]">
                  <Terminal size={13} />
                  Live SHA-1 Plumbing
                </span>
                <span>blob &lt;bytes&gt;\0</span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={hashInput}
                  onChange={(e) => setHashInput(e.target.value)}
                  placeholder="Type any text to refract hash..."
                  aria-label="Input content to calculate genuine Git SHA-1"
                  className="h-9 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-[12.5px] text-[#f5f2ff] outline-none transition-colors focus:border-[#a98cff]"
                />
                <button
                  type="button"
                  onClick={onCopyHash}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 font-mono text-[11px] text-[#f5f2ff] transition-all hover:bg-white/10 hover:border-[#a98cff]"
                  title="Copy full 40-character SHA-1 hash"
                >
                  {copied ? (
                    <>
                      <Check size={13} className="text-[#4be3a6]" />
                      <span className="text-[#4be3a6]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>{short(computedHash)}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-2.5 flex items-center justify-between font-mono text-[10.5px] text-[#8c84ab] truncate">
                <span className="truncate">oid: {computedHash}</span>
              </div>
            </div>
          </div>

          {/* Card B: Interactive Optical Prism Refraction Simulator (Col 6-12) */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 md:p-8 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[#a98cff]" />
                <h3 className="font-mono text-[13px] uppercase tracking-wider text-[#f5f2ff]">
                  Optic Refraction Simulator
                </h3>
              </div>
              <span className="font-mono text-[11px] text-[#8c84ab]">
                Select object wavelength to diffract
              </span>
            </div>

            {/* Prism Lens Selector Buttons */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(LENS_DATA) as GitLensKind[]).map((k) => {
                const item = LENS_DATA[k];
                const active = activeLens === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setActiveLens(k)}
                    className={`flex flex-col items-start rounded-2xl border p-3 text-left transition-all duration-200 ${
                      active
                        ? "border-current bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.06)]"
                        : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5"
                    }`}
                    style={{ color: active ? item.color : "#bdb5da" }}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">
                        {item.name}
                      </span>
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: item.color, boxShadow: active ? `0 0 10px ${item.color}` : "none" }}
                      />
                    </div>
                    <span className="mt-1 font-semibold text-[13px] text-[#f5f2ff]">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Refracted Object Preview Box */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-[#0d0a1a] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: currentLens.color, boxShadow: `0 0 12px ${currentLens.color}` }}
                  />
                  <span className="font-mono text-[12px] font-semibold" style={{ color: currentLens.color }}>
                    {currentLens.name} Object
                  </span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-[#8c84ab]">
                    {currentLens.wavelength}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[#8c84ab]">POSIX Object Anatomy</span>
              </div>

              <p className="mt-3 text-[0.88rem] leading-relaxed text-[#c4b5ff]">
                {currentLens.description}
              </p>

              {/* Terminal snippet */}
              <div className="mt-3.5 rounded-xl border border-white/10 bg-black/60 p-3 font-mono text-[11.5px] leading-relaxed">
                <div className="flex items-center gap-1.5 text-[#3ee0ff]">
                  <span>$</span>
                  <span className="text-[#f5f2ff]">{currentLens.command}</span>
                </div>
                <div className="mt-1.5 whitespace-pre-wrap text-[#8c84ab]">
                  {currentLens.output}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Flagship Interactive 3D Destinations (Cards) */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Destination 1: Workbench */}
          <a
            href="/lab"
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#151126] to-[#0c0917] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#a98cff]/70 hover:shadow-[0_20px_50px_rgba(169,140,255,0.2)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#a98cff]/30 bg-[#a98cff]/10 text-[#a98cff]">
                <Layers size={22} />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a98cff]/30 bg-[#a98cff]/10 px-3 py-1 font-mono text-[11px] font-medium text-[#a98cff]">
                <Radio size={12} className="animate-pulse" />
                Live 3D Workbench
              </span>
            </div>
            <h4 className="mt-5 text-[1.25rem] font-semibold text-[#f5f2ff] group-hover:text-[#a98cff] transition-colors">
              Launch Lab Workbench IDE
            </h4>
            <p className="mt-2 max-w-[28rem] text-[0.9rem] leading-relaxed text-[#bdb5da]">
              Edit code, stage diffs, generate real commits, switch branches, and inspect SHA-1 Git objects
              through an interactive 3D crystal lens.
            </p>
            <div className="mt-6 flex items-center gap-2 font-mono text-[12px] font-medium text-[#a98cff]">
              <span>ENTER WORKBENCH</span>
              <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            </div>
          </a>

          {/* Destination 2: Impact Studio */}
          <a
            href="/review/gitprism-demo/acme-shop/pull/42"
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0e1626] to-[#080d19] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#3ee0ff]/70 hover:shadow-[0_20px_50px_rgba(62,224,255,0.2)]"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#3ee0ff]/30 bg-[#3ee0ff]/10 text-[#3ee0ff]">
                <Sparkles size={22} />
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#3ee0ff]/30 bg-[#3ee0ff]/10 px-3 py-1 font-mono text-[11px] font-medium text-[#3ee0ff]">
                <Radio size={12} className="animate-pulse" />
                3D PR Review Galaxy
              </span>
            </div>
            <h4 className="mt-5 text-[1.25rem] font-semibold text-[#f5f2ff] group-hover:text-[#3ee0ff] transition-colors">
              Impact Studio Visualizer
            </h4>
            <p className="mt-2 max-w-[28rem] text-[0.9rem] leading-relaxed text-[#bdb5da]">
              Inspect Pull Request #42 in full 3D force-directed space. Trace blast radius, architecture
              boundary violations, and test coverage before merging.
            </p>
            <div className="mt-6 flex items-center gap-2 font-mono text-[12px] font-medium text-[#3ee0ff]">
              <span>EXPLORE PR #42</span>
              <ArrowUpRight size={15} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            </div>
          </a>
        </div>

        {/* 4. Complete Story Chapter Matrix & Plumbing Reference */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          {/* The Story Matrix (6 Chapters) */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 md:p-8 backdrop-blur-2xl lg:col-span-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-[#a98cff]" />
                <h4 className="font-mono text-[13px] uppercase tracking-wider text-[#f5f2ff]">
                  Story Chapter Navigation
                </h4>
              </div>
              <span className="font-mono text-[11px] text-[#8c84ab]">Chapters 01 - 06</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {CHAPTERS.map((ch) => (
                <a
                  key={ch.n}
                  href={ch.href}
                  className="group flex items-center justify-between rounded-2xl border border-white/5 bg-black/20 p-3.5 transition-all hover:border-[#a98cff]/50 hover:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-[#a98cff] font-bold">{ch.n}</span>
                    <div>
                      <span className="block text-[13.5px] font-medium text-[#f5f2ff] group-hover:text-[#a98cff] transition-colors">
                        {ch.title}
                      </span>
                      <span className="block text-[10.5px] font-mono text-[#8c84ab]">{ch.tag}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[#8c84ab] transition-transform group-hover:translate-x-1 group-hover:text-[#f5f2ff]" />
                </a>
              ))}
            </div>
          </div>

          {/* Plumbing Specs & Stack Standards */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 md:p-8 backdrop-blur-2xl lg:col-span-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                <Code2 size={16} className="text-[#4be3a6]" />
                <h4 className="font-mono text-[13px] uppercase tracking-wider text-[#f5f2ff]">
                  Authoritative Git References
                </h4>
              </div>

              <ul className="mt-5 space-y-3">
                {SPECS.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center justify-between text-[13px] text-[#bdb5da] transition-colors hover:text-[#4be3a6]"
                    >
                      <span className="truncate group-hover:underline underline-offset-4 decoration-[#4be3a6]/40">
                        {s.label}
                      </span>
                      <ExternalLink size={12} className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-3.5 font-mono text-[11px] text-[#8c84ab]">
              <span className="text-[#f5f2ff]">Engine Topology:</span> Content-addressed Merkle DAG with byte-for-byte real Git SHA-1 hashing.
            </div>
          </div>
        </div>
      </div>

      {/* 5. Giant Prismatic Typography Refractor */}
      <div
        ref={mark}
        onPointerMove={onMove}
        aria-hidden="true"
        className="relative select-none overflow-hidden px-4 pt-12 pb-6 border-t border-white/10"
        style={{ ["--mx" as string]: "50%", ["--my" as string]: "50%" }}
      >
        <div className="text-center font-mono text-[11px] tracking-[0.4em] uppercase text-[#a98cff]/70 mb-2">
          Light In • Spectral History Out
        </div>
        <div
          className="display text-center text-[clamp(5.5rem,23vw,20rem)] leading-[0.8] tracking-[-0.04em] transition-transform duration-300 hover:scale-[1.01]"
          style={{
            backgroundImage:
              "radial-gradient(36rem circle at var(--mx) var(--my), #ff5cb8 0%, #a98cff 28%, #3ee0ff 56%, #4be3a6 78%, transparent 92%), linear-gradient(#261f3f, #261f3f)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          GitPrism
        </div>
      </div>

      {/* 6. Precision System Telemetry & Control Bar */}
      <div className="border-t border-white/10 bg-black/60 py-6">
        <div className="shell flex flex-col items-center justify-between gap-4 text-[0.82rem] text-[#8c84ab] sm:flex-row">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-[#f5f2ff]">© 2026 GitPrism. Designed to make Git visible.</p>
            <span className="hidden text-white/20 sm:inline">•</span>
            <p className="text-[0.77rem]">
              Git® is a registered trademark of Software Freedom Conservancy.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-[#bdb5da] lg:inline-block">
              [ ⌘K ] Command Palette • [ 1-5 ] Lens Modes
            </span>
            <button
              type="button"
              onClick={scrollToTop}
              className="group flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 font-mono text-[12px] font-medium text-[#f5f2ff] shadow-lg transition-all hover:border-[#a98cff] hover:bg-white/20 hover:text-[#a98cff]"
              aria-label="Scroll smoothly to the top of GitPrism"
            >
              <span>SURFACE</span>
              <ArrowUp size={13} className="transition-transform group-hover:-translate-y-1" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
