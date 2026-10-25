"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowDown, ArrowUpRight, Camera, ChevronRight, Eye, GitBranch } from "lucide-react";
import { useMediaQuery, useTheme, usePrefersReducedMotion } from "@/lib/theme";
import { LazyPrism } from "@/components/three/LazyPrism";
import { HexField, INTRO } from "@/components/hero/HexField";
import { PrismStage } from "@/components/hero/PrismStage";
import { StatusChip } from "@/components/hero/StatusChip";

const lines = ["Git makes sense", "when you can", "see it."];

const steps = [
  { n: "01", title: "Inspect", body: "Look inside a Git object", href: "#how", icon: Eye, color: "var(--violet)" },
  { n: "02", title: "Snapshot", body: "See how versions are saved", href: "#playground", icon: Camera, color: "var(--cyan)" },
  { n: "03", title: "Connect", body: "Trace the history graph", href: "#history", icon: GitBranch, color: "var(--magenta)" },
];

/** Where the prism sits in the stage, shared by the canvas fan and the prism graphic. */
const ORIGIN = { x: 0.63, y: 0.47 };

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const theme = useTheme();
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const dark = theme === "dark";
  // A narrow screen has no room for both the light show and the words, so it keeps the field alone.
  const wide = useMediaQuery("(min-width: 768px)");

  /** Everything in the sequence rises the same way, only later. */
  const cue = (at: number, y = 18) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y, filter: "blur(6px)" },
    animate: reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" },
    transition: reduce ? { duration: 0 } : { duration: 0.9, delay: at, ease },
  });

  return (
    <section ref={ref} id="top" className="relative isolate min-h-[100svh] overflow-hidden">
      {/* Layer 1 — the field: hex digits, the alphabet every object ID is written in. */}
      <motion.div
        className="absolute inset-0"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduce ? 0 : 1.2, delay: reduce ? 0 : INTRO.field }}
      >
        <HexField dark={dark} reduced={reduce} origin={ORIGIN} showFan={wide} className="h-full w-full" />
      </motion.div>

      {/* Layer 2 — the prism the beam strikes. Line work first, WebGL when it has compiled. */}
      <div
        className="pointer-events-none absolute hidden md:block"
        // Width and height are stated outright: an aspect-ratio box resolves too late for the
        // WebGL canvas to measure itself at mount, and it comes up 300x150.
        style={{
          left: `${ORIGIN.x * 100}%`,
          top: `${ORIGIN.y * 100}%`,
          width: "min(46svh, 34vw, 420px)",
          height: "min(46svh, 34vw, 420px)",
          transform: "translate(-50%, -50%)",
        }}
      >
        <PrismStage reduced={reduce} handedOff={sceneReady} />
        <div className="absolute inset-[-55%]">
          <LazyPrism
            background={dark ? "#08070f" : "#f6f5fb"}
            reducedMotion={reduce}
            scrollTarget={ref}
            fadeEdges={false}
            poster={false}
            onReady={() => setSceneReady(true)}
          />
        </div>
      </div>

      {/* Layer 3 — the readable surface: a vignette so type never fights the field. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: dark
            ? "radial-gradient(105% 88% at -6% 40%, #08070f 18%, rgb(8 7 15 / 0.88) 34%, rgb(8 7 15 / 0.45) 52%, transparent 66%)"
            : "radial-gradient(105% 88% at -6% 40%, #f6f5fb 18%, rgb(246 245 251 / 0.9) 34%, rgb(246 245 251 / 0.5) 52%, transparent 66%)",
        }}
      />

      {/* Layer 4 — the type. */}
      <div className="shell relative flex min-h-[100svh] flex-col pt-28 md:pt-32">
        <motion.div {...cue(INTRO.text - 0.25, 10)} className="flex items-center gap-3">
          <span aria-hidden="true" className="h-px w-8 bg-gradient-to-r from-transparent to-violet" />
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-ink-3">A visual way to understand Git</span>
        </motion.div>

        <h1 className="mt-7 max-w-[20ch] text-[clamp(2.25rem,5.7vw,5.3rem)]">
          {lines.map((line, i) => (
            <span key={line} className="block overflow-hidden pb-[0.08em]">
              <motion.span
                className={`display block text-ink ${i === 2 ? "spectrum-text" : ""}`}
                initial={reduce ? false : { y: "105%" }}
                animate={{ y: 0 }}
                transition={{ duration: 1, delay: reduce ? 0 : INTRO.text + i * 0.11, ease }}
              >
                {line}
              </motion.span>
            </span>
          ))}
        </h1>

        {/* A hairline under the headline, the way a title card rules off its title. */}
        <motion.span
          aria-hidden="true"
          className="mt-8 block h-px w-full max-w-[34rem] origin-left"
          style={{ background: "linear-gradient(90deg, var(--violet), var(--cyan) 42%, transparent)" }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : INTRO.text + 0.45, ease }}
        />

        <motion.p {...cue(INTRO.text + 0.55)} className="mt-6 max-w-[32rem] text-[1.02rem] leading-relaxed text-ink-2">
          Go beyond commands. Explore the objects, snapshots and connections that make Git work, and watch them change
          as you do.
        </motion.p>

        <motion.div {...cue(INTRO.text + 0.7)} className="mt-9 flex flex-wrap items-center gap-3">
          <a href="#playground" className="btn btn-primary">
            Explore the playground <ArrowUpRight size={17} className="btn-arrow" />
          </a>
          <a href="#how" className="btn btn-ghost">
            See how it works
          </a>
          <StatusChip className="ml-1 hidden sm:flex" />
        </motion.div>

        {/* Layer 5 — the three ways in. */}
        <motion.ol
          {...cue(INTRO.chrome, 22)}
          className="mt-auto flex flex-col gap-3 sm:flex-row sm:items-stretch"
          style={{ marginTop: "max(3rem, 6vh)" }}
        >
          {steps.map((s, i) => (
            <li key={s.n} className="group relative flex flex-1 items-center">
              <a
                href={s.href}
                className="relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border border-line bg-surface/70 px-4 py-3.5 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1"
                style={{ "--step-color": s.color } as React.CSSProperties}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[2px] opacity-70 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: s.color }}
                />
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[var(--step-color)] transition-transform duration-300 group-hover:scale-110"
                  style={{ background: `color-mix(in oklab, ${s.color} 16%, transparent)` }}
                >
                  <s.icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-mono text-[0.72rem] text-ink-3">{s.n}</span>
                  <span className="block text-[0.95rem] font-medium text-ink">{s.title}</span>
                  <span className="block truncate text-[0.82rem] text-ink-3">{s.body}</span>
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ boxShadow: `0 16px 40px -22px ${s.color}, inset 0 0 0 1px color-mix(in oklab, ${s.color} 45%, transparent)` }}
                />
              </a>
              {i < steps.length - 1 && (
                <ChevronRight size={16} className="mx-1 hidden shrink-0 text-ink-3 sm:block" aria-hidden="true" />
              )}
            </li>
          ))}
        </motion.ol>

        <motion.a
          {...cue(INTRO.chrome + 0.2, 8)}
          href="#problem"
          className="mx-auto mb-6 mt-5 flex items-center gap-2 text-[0.8rem] text-ink-3 transition-colors hover:text-ink"
        >
          Scroll to begin <ArrowDown size={14} />
        </motion.a>
      </div>
    </section>
  );
}
