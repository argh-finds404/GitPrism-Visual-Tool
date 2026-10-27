"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, Check, Copy } from "lucide-react";
import { Wordmark } from "@/components/brand/PrismMark";
import { hashBlob } from "@/lib/git";
import { CHAPTERS } from "@/lib/chapters";
import { HashText } from "@/components/ui/HashText";

const STUDIO = "/review/gitprism-demo/acme-shop/pull/42";

const DESTINATIONS = [
  { href: "/lab", title: "Lab workbench", line: "Edit, stage, commit and branch in a repository that lives in your browser.", color: "var(--cyan)" },
  { href: "/timefold/gitprism-demo/acme-shop", title: "TimeFold", line: "Follow one function through history and bisect a regression with real tests.", color: "var(--amber)" },
  { href: STUDIO, title: "PR Impact Studio", line: "See what one pull request touches, in five 3D lenses.", color: "var(--magenta)" },
  { href: "/mergelab/gitprism-demo/acme-shop", title: "MergeLab", line: "Resolve a three-way merge, then validate it before you export it.", color: "var(--add)" },
];

const REFERENCES = [
  { label: "Pro Git: Git objects", href: "https://git-scm.com/book/en/v2/Git-Internals-Git-Objects" },
  { label: "git hash-object", href: "https://git-scm.com/docs/git-hash-object" },
  { label: "git cat-file", href: "https://git-scm.com/docs/git-cat-file" },
  { label: "Git glossary", href: "https://git-scm.com/docs/gitglossary" },
];

/** `echo "<text>" | git hash-object --stdin`, computed live. echo adds the trailing newline. */
function Hasher() {
  const [text, setText] = useState("hello, git");
  const [copied, setCopied] = useState(false);
  const oid = useMemo(() => hashBlob(`${text}\n`), [text]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(oid);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the ID stays selectable.
    }
  };

  return (
    <div className="panel rounded-2xl p-5 md:p-6">
      <p className="font-mono text-[0.78rem] text-ink-3">try it: name anything the way Git would</p>
      <label htmlFor="footer-hash" className="mt-4 flex items-center gap-2 rounded-xl border border-line-2 bg-paper px-3 py-2.5 font-mono text-[0.86rem] focus-within:border-violet">
        <span className="select-none text-violet-ink">$ echo &quot;</span>
        <input
          id="footer-hash"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          maxLength={80}
          className="min-w-0 flex-1 bg-transparent text-ink outline-none"
          aria-label="Text to hash"
        />
        <span className="select-none text-violet-ink">&quot;</span>
      </label>
      <p className="mt-2 font-mono text-[0.78rem] text-ink-3">| git hash-object --stdin</p>
      <div className="mt-4 flex items-center gap-3">
        <output htmlFor="footer-hash" aria-live="polite" className="min-w-0 flex-1 break-all font-mono text-[0.86rem] leading-relaxed text-ink-2">
          <span className="text-amber">{oid.slice(0, 7)}</span>
          {oid.slice(7)}
        </output>
        <button
          type="button"
          onClick={copy}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line-2 text-ink-2 transition-colors hover:border-violet hover:text-violet-ink"
          aria-label={copied ? "Copied" : "Copy object ID"}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
      <p className="mt-4 text-[0.86rem] leading-relaxed text-ink-3">
        Change one character and the whole ID changes. Run the same command in a terminal and you&apos;ll get this exact ID.
      </p>
    </div>
  );
}

export function Footer() {
  const mark = useRef<HTMLDivElement>(null);

  // The oversized wordmark catches the spectrum where the pointer moves.
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

  const head = CHAPTERS[CHAPTERS.length - 1];

  return (
    <footer className="relative overflow-hidden border-t border-line/70 pt-20">
      <div aria-hidden="true" className="rule-spectrum pointer-events-none absolute inset-x-0 top-0" />

      <div className="shell">
        <div className="grid gap-12 pb-16 lg:grid-cols-12 lg:gap-10">
          <div className="min-w-0 lg:col-span-7">
            <div className="flex flex-wrap items-center gap-3">
              <Wordmark />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper-2 px-2.5 py-0.5 font-mono text-[11px] text-ink-3">
                <span className="h-1.5 w-1.5 rounded-full bg-add" />
                local-first
              </span>
            </div>
            <p className="mt-5 max-w-[30rem] text-[0.98rem] leading-relaxed text-ink-2">
              Git makes sense when you can see it. Six chapters, one repository, every ID computed for real.
            </p>

            {/* The story, as the log of the page you just read. */}
            <nav aria-label="Chapters" className="mt-10">
              <p className="font-mono text-[0.78rem] text-ink-3">$ git log --oneline --reverse</p>
              <ol className="relative mt-4">
                <span aria-hidden="true" className="absolute bottom-3 left-[5px] top-3 w-px bg-line-2" />
                {CHAPTERS.map((c) => (
                  <li key={c.n}>
                    <a
                      href={`#${c.anchor}`}
                      className="group relative flex items-center gap-3 rounded-lg py-1.5 pr-2 font-mono text-[0.86rem] transition-colors hover:bg-surface/60"
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" className="relative shrink-0 transition-transform group-hover:scale-125">
                        <path d="M6 .8 11.2 6 6 11.2.8 6Z" fill={c.color} />
                      </svg>
                      <HashText value={c.id} delay={c.n * 70} className="text-amber" />
                      {c === head && (
                        <span className="shrink-0 whitespace-nowrap rounded-full border border-[color:var(--c-ref)] px-2 text-[0.72rem] text-[color:var(--c-ref)]">
                          HEAD → main
                        </span>
                      )}
                      <span className="truncate text-ink-2 group-hover:text-ink">
                        chapter {c.n}: {c.name}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </div>

          <div className="min-w-0 space-y-4 lg:col-span-5">
            <Hasher />
            {DESTINATIONS.map((d) => (
              <Link
                key={d.href}
                href={d.href}
                className="group flex items-center gap-4 rounded-2xl border border-line p-4 transition-[border-color,box-shadow] hover:shadow-[0_14px_40px_-22px_var(--dest)]"
                style={{ ["--dest" as string]: d.color }}
              >
                <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: d.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{d.title}</span>
                  <span className="block text-[0.85rem] leading-snug text-ink-3">{d.line}</span>
                </span>
                <ArrowUpRight size={17} className="shrink-0 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            ))}
            <details className="group rounded-2xl border border-line px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[0.8rem] text-ink-3 [&::-webkit-details-marker]:hidden">
                Read the source material
                <span className="transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <ul className="mt-3 space-y-2 pb-1">
                {REFERENCES.map((r) => (
                  <li key={r.href}>
                    <a href={r.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[0.88rem] text-ink-2 hover:text-violet-ink">
                      {r.label}
                      <ArrowUpRight size={12} className="opacity-50" />
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </div>
      </div>

      <div
        ref={mark}
        onPointerMove={onMove}
        aria-hidden="true"
        className="relative select-none overflow-hidden border-t border-line/40 px-4 pb-3 pt-10"
        style={{ ["--mx" as string]: "50%", ["--my" as string]: "50%" }}
      >
        <div
          className="display whitespace-nowrap text-center text-[clamp(3rem,15.5vw,15rem)] leading-[0.85]"
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

      <div className="border-t border-line/60 bg-paper-2/40 py-5">
        <div className="shell flex flex-col items-center justify-between gap-4 text-[0.8rem] text-ink-3 sm:flex-row">
          <p>
            © 2026 GitPrism. Git® is a trademark of the Software Freedom Conservancy.
          </p>
          <button
            type="button"
            onClick={scrollToTop}
            className="group flex items-center gap-1.5 rounded-full border border-line-2 bg-surface px-3 py-1 font-mono text-[12px] text-ink-2 transition-colors hover:border-violet hover:text-violet-ink"
          >
            Back to top
            <ArrowUp size={13} className="transition-transform group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
