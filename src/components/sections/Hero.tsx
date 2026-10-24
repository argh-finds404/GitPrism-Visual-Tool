"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import { motion } from "motion/react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useTheme, usePrefersReducedMotion } from "@/lib/theme";

const PrismScene = dynamic(() => import("@/components/three/PrismScene"), {
  ssr: false,
  loading: () => <PrismFallback />,
});

/** Lightweight stand-in shown while WebGL loads (or if it never does). */
function PrismFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
      <div
        className="h-[46%] aspect-[1.15] opacity-70"
        style={{
          clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--lilac) 60%, transparent), color-mix(in oklab, var(--cyan) 35%, transparent) 55%, color-mix(in oklab, var(--magenta) 30%, transparent))",
          filter: "blur(0.5px)",
        }}
      />
    </div>
  );
}

const lines = ["Git makes sense", "when you can", "see it."];

const steps = [
  { n: "01", title: "Inspect", body: "Look inside a Git object", href: "#how" },
  { n: "02", title: "Snapshot", body: "See how versions are saved", href: "#playground" },
  { n: "03", title: "Connect", body: "Trace the history graph", href: "#history" },
];

export function Hero() {
  const theme = useTheme();
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <section ref={ref} id="top" className="relative isolate min-h-[100svh] overflow-hidden pt-28 md:pt-32">
      {/* Prism stage: right side on desktop, top band on mobile. */}
      <div className="pointer-events-none absolute inset-x-0 top-16 h-[52svh] md:left-[34%] md:right-0 md:top-0 md:h-[100svh]">
        <PrismScene
          background={theme === "dark" ? "#08070f" : "#f6f5fb"}
          reducedMotion={reduce}
          scrollTarget={ref}
        />
      </div>

      {/* Fine grid: reads like a lab bench, fades out toward the prism. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(ellipse 70% 60% at 20% 40%, black, transparent 75%)",
        }}
      />

      <div className="shell relative flex min-h-[calc(100svh-8rem)] flex-col">
        <div className="mt-[44svh] max-w-[46rem] md:mt-[9vh]">
          <motion.p
            className="mb-6 flex items-center gap-3 text-[0.9rem] text-ink-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease }}
          >
            <span aria-hidden="true" className="h-px w-10 bg-gradient-to-r from-transparent to-violet" />
            A visual way to understand Git
          </motion.p>

          <h1 className="display text-[clamp(3.4rem,9.2vw,8.6rem)] text-ink">
            {lines.map((line, i) => (
              <span key={line} className="block overflow-hidden pb-[0.08em]">
                <motion.span
                  className={`block ${i === 2 ? "spectrum-text" : ""}`}
                  initial={reduce ? false : { y: "105%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1, delay: 0.15 + i * 0.12, ease }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            className="mt-7 max-w-[34rem] text-[1.12rem] leading-relaxed text-ink-2"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease }}
          >
            Go beyond commands. Explore the objects, snapshots and connections that make Git work, and watch them
            change as you do.
          </motion.p>

          <motion.div
            className="mt-9 flex flex-wrap gap-3"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.72, ease }}
          >
            <a href="#playground" className="btn btn-primary">
              Explore the playground <ArrowUpRight size={17} className="btn-arrow" />
            </a>
            <a href="#how" className="btn btn-ghost">
              See how it works
            </a>
          </motion.div>
        </div>

        <motion.ol
          className="mt-auto grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line pt-0 sm:grid-cols-3"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          style={{ marginTop: "max(3rem, 6vh)" }}
        >
          {steps.map((s) => (
            <li key={s.n} className="bg-[color-mix(in_oklab,var(--paper)_88%,transparent)] backdrop-blur-md">
              <a href={s.href} className="group flex items-baseline gap-4 px-5 py-4 transition-colors hover:bg-violet-wash">
                <span className="font-mono text-[0.78rem] text-violet">{s.n}</span>
                <span>
                  <span className="block text-[0.95rem] font-medium">{s.title}</span>
                  <span className="block text-[0.85rem] text-ink-3">{s.body}</span>
                </span>
              </a>
            </li>
          ))}
        </motion.ol>

        <a
          href="#problem"
          className="mx-auto mt-5 mb-6 flex items-center gap-2 text-[0.8rem] text-ink-3 transition-colors hover:text-ink"
        >
          Scroll to begin <ArrowDown size={14} />
        </a>
      </div>
    </section>
  );
}
