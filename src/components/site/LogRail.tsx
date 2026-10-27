"use client";

import { useEffect, useState } from "react";
import { CHAPTERS } from "@/lib/chapters";

/**
 * A slim commit graph pinned to the right edge on wide screens: one commit per chapter,
 * with HEAD on the chapter in view. Chapters you've passed are filled in.
 */
export function LogRail() {
  const [head, setHead] = useState(-1);

  useEffect(() => {
    const sections = CHAPTERS.map((c) => document.getElementById(c.anchor));
    const update = () => {
      const line = window.innerHeight * 0.45;
      let current = -1;
      sections.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= line) current = i;
      });
      // Past the last chapter's bottom edge, nothing is checked out.
      const last = sections[sections.length - 1];
      if (last && last.getBoundingClientRect().bottom < line) current = -1;
      setHead(current);
    };
    update();
    // Recompute only when a chapter edge crosses the reading line (45% down), not on every scroll.
    const io = new IntersectionObserver(update, { rootMargin: "-45% 0px -55% 0px" });
    sections.forEach((el) => el && io.observe(el));
    window.addEventListener("resize", update);
    return () => {
      io.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <nav
      aria-label="Chapter progress"
      className={`fixed right-3 top-1/2 z-40 hidden -translate-y-1/2 transition-opacity duration-500 xl:block ${head < 0 ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <ol className="relative flex flex-col gap-4">
        <span aria-hidden="true" className="absolute bottom-1 left-1/2 top-1 w-px -translate-x-1/2 bg-line-2" />
        {CHAPTERS.map((c, i) => {
          const passed = i <= head;
          const current = i === head;
          return (
            <li key={c.n} className="group relative flex justify-center">
              <a
                href={`#${c.anchor}`}
                aria-current={current ? "step" : undefined}
                aria-label={`chapter ${c.n}: ${c.name}`}
                className="relative grid h-4 w-4 place-items-center"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={`transition-transform duration-300 ${current ? "scale-125" : ""}`}>
                  <path
                    d="M6 .8 11.2 6 6 11.2.8 6Z"
                    fill={passed ? c.color : "var(--paper)"}
                    stroke={passed ? c.color : "var(--line-2)"}
                    strokeWidth="1.2"
                  />
                </svg>
                {current && <span className="absolute -inset-1 rounded-full border border-dashed border-[color:var(--c-ref)]" aria-hidden="true" />}
              </a>
              <span
                className={`pointer-events-none absolute right-6 top-1/2 flex -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface/95 px-2.5 py-1 font-mono text-[0.72rem] shadow-lg transition-opacity duration-300 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100`}
              >
                {current && <span className="text-[color:var(--c-ref)]">HEAD →</span>}
                <span className="text-amber">{c.id}</span>
                <span className="text-ink-2">{c.name}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
