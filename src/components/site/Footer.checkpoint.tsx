"use client";

import { useRef } from "react";
import { Wordmark } from "@/components/brand/PrismMark";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Lab workbench", href: "/lab" },
      { label: "Snapshot demo", href: "#playground" },
      { label: "Compare snapshots", href: "#diff" },
      { label: "History explorer", href: "#history" },
      { label: "How it works", href: "#how" },
    ],
  },
  {
    title: "Learning map",
    links: [
      { label: "Objects & hashes", href: "/learn/objects" },
      { label: "Branches & history", href: "/learn/history" },
      { label: "Diffs & snapshots", href: "/learn/diffs" },
      { label: "Storage & structure", href: "/learn/storage" },
    ],
  },
  {
    title: "Git references",
    links: [
      { label: "Pro Git, Git internals", href: "https://git-scm.com/book/en/v2/Git-Internals-Git-Objects" },
      { label: "git hash-object", href: "https://git-scm.com/docs/git-hash-object" },
      { label: "git cat-file", href: "https://git-scm.com/docs/git-cat-file" },
      { label: "Git glossary", href: "https://git-scm.com/docs/gitglossary" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "About GitPrism", href: "/about" },
      { label: "Changelog", href: "/changelog" },
      { label: "Accessibility", href: "/accessibility" },
    ],
  },
];

export function Footer() {
  const mark = useRef<HTMLDivElement>(null);

  // The oversized wordmark catches the spectrum where the pointer is.
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = mark.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <footer className="relative overflow-hidden pt-24">
      <div className="shell">
        <div className="grid gap-12 border-b border-line pb-16 md:grid-cols-12">
          <div className="md:col-span-4">
            <Wordmark />
            <p className="mt-5 max-w-[20rem] text-[0.92rem] leading-relaxed text-ink-2">
              An interactive way to see what Git stores, how versions connect, and why it all works.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-4 md:col-span-8">
            {columns.map((c) => (
              <div key={c.title}>
                <h3 className="text-[0.85rem] font-medium text-ink">{c.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {c.links.map((l) => {
                    const external = l.href.startsWith("http");
                    return (
                      <li key={l.label}>
                        <a
                          href={l.href}
                          {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                          className="text-[0.88rem] text-ink-2 transition-colors hover:text-violet-ink"
                        >
                          {l.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>

      <div
        ref={mark}
        onPointerMove={onMove}
        aria-hidden="true"
        className="relative select-none overflow-hidden px-2 pt-6"
        style={{ ["--mx" as string]: "50%", ["--my" as string]: "50%" }}
      >
        <div
          className="display text-center text-[clamp(6rem,24vw,22rem)] leading-[0.8] tracking-[-0.04em]"
          style={{
            backgroundImage:
              "radial-gradient(28rem circle at var(--mx) var(--my), #e85ac4, #7654e8 30%, #68d9f5 55%, transparent 75%), linear-gradient(var(--line-2), var(--line-2))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          GitPrism
        </div>
      </div>

      <div className="shell flex flex-col justify-between gap-2 py-6 text-[0.8rem] text-ink-3 sm:flex-row">
        <p>© 2026 GitPrism. Built to make Git visible.</p>
        <p>Git is a trademark of Software Freedom Conservancy. GitPrism is an independent learning project.</p>
      </div>
    </footer>
  );
}
