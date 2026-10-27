"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/theme";
import { chapterId } from "@/lib/chapters";
import { HashText } from "./HashText";
import { InfoTip } from "./InfoTip";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Chapter heading, written as a line of `git log`: the chapter's real blob ID, then its name.
 * The pieces arrive one after another (log line, headline, then the body) instead of all at once.
 */
export function Chapter({
  n,
  name,
  title,
  children,
  className = "",
  id,
  compact = false,
}: {
  n: number;
  name: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
  id?: string;
  /** Smaller title for headings that share the screen with a sticky stage. */
  compact?: boolean;
}) {
  const reduce = usePrefersReducedMotion();
  // Always keep the reveal props: the reduced-motion preference is only known after hydration,
  // and dropping them then would leave the server-rendered opacity: 0 in place. Reduced motion
  // just makes the reveal instant.
  // Each piece materializes: opacity, a short rise and a 4px blur that comes into focus.
  const step = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: "blur(4px)" },
    whileInView: reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" },
    viewport: { once: true, margin: "-12% 0px" },
    transition: reduce ? { duration: 0 } : { duration: 0.7, delay: i * 0.22, ease },
  });

  return (
    <header className={`max-w-[44rem] ${className}`}>
      <motion.p {...step(0)} className="mb-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[0.82rem] text-ink-3">
        <span className="relative grid shrink-0 place-items-center" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M6 .8 11.2 6 6 11.2.8 6Z" fill="var(--c-commit)" />
          </svg>
          {/* HEAD arriving: one ring, once, as the chapter is checked out. */}
          {!reduce && (
            <motion.span
              className="absolute h-3 w-3 rounded-full border border-[color:var(--c-commit)]"
              initial={{ opacity: 0.9, scale: 0.9 }}
              whileInView={{ opacity: 0, scale: 2.6 }}
              viewport={{ once: true, margin: "-12% 0px" }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
        </span>
        <span className="text-amber">
          <InfoTip label={`The real blob ID of the line "chapter ${n}: ${name}". Run echo "chapter ${n}: ${name}" | git hash-object --stdin and you get this.`}>
            <HashText value={chapterId(n, name)} delay={120} />
          </InfoTip>
        </span>
        <span>
          chapter {n}: <span className="text-ink">{name}</span>
        </span>
      </motion.p>
      <motion.h2
        {...step(1)}
        id={id}
        className={`display text-ink ${compact ? "text-[clamp(2rem,3.3vw,3.2rem)]" : "text-[clamp(2.3rem,5vw,4.4rem)]"}`}
      >
        {title}
      </motion.h2>
      {children && (
        <motion.div {...step(2.4)} className="mt-6 max-w-[38rem] text-[1.08rem] leading-relaxed text-ink-2">
          {children}
        </motion.div>
      )}
    </header>
  );
}
