"use client";

import { useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform, useMotionValueEvent, type MotionValue } from "motion/react";
import { ArrowDown, ArrowUpRight, Camera, Eye, GitBranch } from "lucide-react";
import { useMediaQuery, useTheme, usePrefersReducedMotion } from "@/lib/theme";
import { LazyPrism } from "@/components/three/LazyPrism";
import { HexField, INTRO } from "@/components/hero/HexField";
import { PrismStage } from "@/components/hero/PrismStage";
import { StatusChip } from "@/components/hero/StatusChip";

/**
 * The banner, as a dive.
 *
 * A pinned stage with the scene spread over depth planes. Scrolling moves the camera forward
 * instead of moving the page: far planes barely shift, near ones rush past and out of frame. The
 * sequence is the product's own thesis — white light enters, the prism splits it, and the three
 * coloured outputs are the three ways into the app.
 *
 * The dive runs only on a wide screen with motion allowed. Otherwise every plane holds at its
 * resting value and the stage is one still screen, which is also what a phone gets: a full-screen
 * parallax is a vestibular trigger and an expensive one.
 */

const lines = ["Git makes sense", "when you can", "see it."];

/** The prism's three outputs, which are also the three ways in. Colours match the refracted fan. */
const steps = [
  { n: "01", title: "Inspect", body: "Look inside a Git object", href: "#how", icon: Eye, color: "var(--cyan)" },
  { n: "02", title: "Snapshot", body: "See how versions are saved", href: "#playground", icon: Camera, color: "var(--violet)" },
  { n: "03", title: "Connect", body: "Trace the history graph", href: "#history", icon: GitBranch, color: "var(--magenta)" },
];

/** Where the prism sits in the stage, shared by the canvas fan, the prism graphic and the spectrum. */
const ORIGIN = { x: 0.63, y: 0.47 };

/** Point in the dive where the camera has passed the headline and the outputs take over. */
const LANDING = 0.58;

const ease = [0.22, 1, 0.36, 1] as const;

/** Light loses itself with distance, so the fan dissolves rather than ending at an edge. */
// Sized past the viewport on purpose. A mask that reaches transparent inside the frame draws a
// visible terminus across the beams; this one runs out beyond the edge, so they simply leave.
const FAN_MASK = `radial-gradient(ellipse 165% 165% at ${ORIGIN.x * 100}% ${ORIGIN.y * 100}%, rgb(0 0 0 / 0.95) 0%, rgb(0 0 0 / 0.62) 28%, rgb(0 0 0 / 0.34) 55%, rgb(0 0 0 / 0.16) 80%, transparent 100%)`;

/**
 * A scroll-driven value, or a fixed resting one when the dive is off. Branching the range rather
 * than the call keeps the hook order identical either way.
 */
function useDive<T extends number | string>(
  p: MotionValue<number>,
  on: boolean,
  input: number[],
  output: T[],
  still: T,
) {
  return useTransform(p, input, on ? output : output.map(() => still));
}

/** A far plane of commits, hand-placed: three lanes, drifting behind everything else. */
const FAR_LANES: readonly (readonly [number, number])[][] = [
  [[8, 22], [19, 22], [31, 19], [31, 28], [44, 28], [56, 25], [56, 34], [69, 34]],
  [[12, 58], [25, 61], [38, 58], [38, 68], [51, 68], [64, 65], [77, 65]],
  [[17, 83], [30, 86], [43, 83], [58, 88], [71, 85]],
];

export function HeroDive() {
  const theme = useTheme();
  const reduce = usePrefersReducedMotion();
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [landed, setLanded] = useState(false);
  const dark = theme === "dark";
  const wide = useMediaQuery("(min-width: 768px)");
  const dive = wide && !reduce;

  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start start", "end end"] });
  // A light spring takes the stutter out of a trackpad without delaying the camera noticeably.
  const p = useSpring(scrollYProgress, { stiffness: 320, damping: 44, mass: 0.35, restDelta: 0.0005 });

  // One state change per crossing, not one per scroll tick: the half of the stage that is off
  // camera is made inert so it never collects focus while invisible.
  useMotionValueEvent(p, "change", (v) => setLanded(v > LANDING));


  // Depth, in stage heights. Near planes travel furthest; the far field only drifts. Units are
  // svh rather than %, so an offset means the same thing on a plane that is not stage-sized.
  const fieldY = useDive(p, dive, [0, 1], ["0svh", "-6svh"], "0svh");
  const farY = useDive(p, dive, [0, 1], ["0svh", "-17svh"], "0svh");
  const farFade = useDive(p, dive, [0, 0.55, 0.85], [0.75, 0.55, 0], 0.75);
  const prismY = useDive(p, dive, [0, 1], ["0svh", "-16svh"], "0svh");
  const prismScale = useDive(p, dive, [0, 0.62, 1], [1, 1.4, 1.75], 1);
  const prismFade = useDive(p, dive, [0, 0.72, 1], [1, 1, 0.32], 1);
  const fanY = useDive(p, dive, [0, 1], ["0svh", "-46svh"], "0svh");
  const fanFade = useDive(p, dive, [0, 0.3, 0.68, 0.95], [0, 0.35, 0.85, 0], 0.4);
  const fanScale = useDive(p, dive, [0, 1], [1, 2.6], 1);

  // The type sits nearest the camera, so it leaves first and fastest.
  const typeY = useDive(p, dive, [0, LANDING], ["0svh", "-46svh"], "0svh");
  const typeFade = useDive(p, dive, [0, 0.3, 0.5], [1, 1, 0], 1);
  const typeBlur = useTransform(p, [0, 0.3, 0.52], dive ? [0, 0, 7] : [0, 0, 0]);
  const typeFilter = useTransform(typeBlur, (b) => `blur(${b.toFixed(2)}px)`);
  const typeHint = useDive(p, dive, [0, 0.12], [1, 0], 1);

  // The payload arrives rather than passing: the outputs rise out of the prism and settle.
  const outY = useDive(p, dive, [LANDING, 0.92], ["14svh", "0svh"], "0svh");
  const outFade = useDive(p, dive, [LANDING, 0.78], [0, 1], 1);

  const prismPx = "min(46svh, 34vw, 420px)";

  return (
    <section id="top" aria-label="GitPrism" className="relative">
      <div ref={wrap} className="relative">
        {/* The camera. Everything below is pinned to it while the page travels past. */}
        <div
          ref={stage}
          className={`overflow-hidden ${dive ? "sticky top-0 h-[100svh]" : "relative min-h-[100svh]"}`}
        >
          {/* Plane 1 — the field of hex digits, the alphabet every object ID is written in.
              Translate only: the canvas measures itself, and scaling it would force a full
              re-layout on every scroll tick. */}
          <motion.div
            // Taller than the stage: the plane drifts upward, and inset-0 would uncover the floor.
            className="absolute inset-x-0 top-0 -bottom-[20svh]"
            style={{ y: fieldY, willChange: dive ? "transform" : undefined }}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: reduce ? 0 : 1.2, delay: reduce ? 0 : INTRO.field }}
          >
            <HexField dark={dark} reduced={reduce} origin={ORIGIN} showFan={wide} className="h-full w-full" />
          </motion.div>

          {/* Plane 2 — a far constellation of commits, the repository we are falling through. */}
          <motion.svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            // Slice, not stretch: the commit dots have to stay round on a wide stage.
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-x-0 top-0 h-[130svh] w-full"
            style={{ y: farY, opacity: farFade, willChange: dive ? "transform, opacity" : undefined }}
          >
            {FAR_LANES.map((lane, li) => (
              <g key={li}>
                {lane.slice(1).map(([x, y], i) => (
                  <line
                    key={`${x}-${y}`}
                    x1={lane[i][0]}
                    y1={lane[i][1]}
                    x2={x}
                    y2={y}
                    stroke="var(--violet)"
                    strokeWidth="1"
                    opacity="0.45"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {lane.map(([x, y], i) => (
                  <circle key={`${x}-${y}`} cx={x} cy={y} r={i % 3 === 0 ? 0.22 : 0.14} fill="var(--violet)" opacity="0.6" />
                ))}
              </g>
            ))}
          </motion.svg>

          {/* Plane 3 — the refracted fan, spreading as the camera moves into it. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 hidden md:block"
            style={{
              y: fanY,
              scale: fanScale,
              opacity: fanFade,
              willChange: dive ? "transform, opacity" : undefined,
              background: `conic-gradient(from 67deg at ${ORIGIN.x * 100}% ${ORIGIN.y * 100}%, transparent 0deg, var(--cyan) 5deg, #7c9bff 12deg, var(--violet) 19deg, var(--magenta) 28deg, #ffc15c 37deg, #4be3a6 45deg, transparent 51deg)`,
              maskImage: FAN_MASK,
              WebkitMaskImage: FAN_MASK,
            }}
          />

          {/* Plane 4 — the prism itself. Line work first, WebGL once it has compiled.
              The centring lives on the outer box: `y` is one property, so the dive's offset and a
              -50% centre cannot share it. */}
          <div
            className="pointer-events-none absolute hidden -translate-x-1/2 -translate-y-1/2 md:block"
            // Width and height are stated outright: an aspect-ratio box resolves too late for the
            // WebGL canvas to measure itself at mount, and it comes up 300x150.
            style={{
              left: `${ORIGIN.x * 100}%`,
              top: `${ORIGIN.y * 100}%`,
              width: prismPx,
              height: prismPx,
            }}
          >
            <motion.div
              className="h-full w-full"
              style={{
                y: prismY,
                scale: prismScale,
                opacity: prismFade,
                willChange: dive ? "transform, opacity" : undefined,
              }}
            >
              <PrismStage reduced={reduce} handedOff={sceneReady} />
              <div className="absolute inset-[-55%]">
                <LazyPrism
                  background={dark ? "#08070f" : "#f6f5fb"}
                  reducedMotion={reduce}
                  scrollTarget={stage}
                  fadeEdges={false}
                  poster={false}
                  onReady={() => setSceneReady(true)}
                />
              </div>
            </motion.div>
          </div>

          {/* A vignette so type never fights the field. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background: dark
                ? "radial-gradient(105% 88% at -6% 40%, #08070f 18%, rgb(8 7 15 / 0.88) 34%, rgb(8 7 15 / 0.45) 52%, transparent 66%)"
                : "radial-gradient(105% 88% at -6% 40%, #f6f5fb 18%, rgb(246 245 251 / 0.9) 34%, rgb(246 245 251 / 0.5) 52%, transparent 66%)",
            }}
          />

          {/* With the dive off there is nothing to separate the planes, so type and outputs share
              one column instead of stacking on top of each other. */}
          <div className="relative flex h-full flex-col">
          {/* Plane 5 — the type, nearest the camera, so it leaves first. */}
          <motion.div
            inert={dive && landed}
            className={`shell flex flex-col justify-center pt-28 md:pt-32 ${
              dive ? "absolute inset-x-0 top-0 h-full pb-24" : "flex-1"
            }`}
            style={{ y: typeY, opacity: typeFade, filter: typeFilter, willChange: dive ? "transform, opacity" : undefined }}
          >
            <motion.div
              className="flex items-center gap-3"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : INTRO.text - 0.25, ease }}
            >
              <span aria-hidden="true" className="h-px w-8 bg-gradient-to-r from-transparent to-violet" />
              <span className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-ink-3">
                A visual way to understand Git
              </span>
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

            <motion.span
              aria-hidden="true"
              className="mt-8 block h-px w-full max-w-[34rem] origin-left"
              style={{ background: "linear-gradient(90deg, var(--violet), var(--cyan) 42%, transparent)" }}
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: reduce ? 0 : 1.1, delay: reduce ? 0 : INTRO.text + 0.45, ease }}
            />

            <motion.p
              className="mt-6 max-w-[32rem] text-[1.02rem] leading-relaxed text-ink-2"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : INTRO.text + 0.55, ease }}
            >
              Go beyond commands. Explore the objects, snapshots and connections that make Git work, and watch them
              change as you do.
            </motion.p>

            <motion.div
              className="mt-9 flex flex-wrap items-center gap-3"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : INTRO.text + 0.7, ease }}
            >
              <a href="#playground" className="btn btn-primary">
                Explore the playground <ArrowUpRight size={17} className="btn-arrow" />
              </a>
              <a href="#how" className="btn btn-ghost">
                See how it works
              </a>
              <StatusChip className="ml-1 hidden sm:flex" />
            </motion.div>
          </motion.div>

          {/* Plane 6 — what the prism puts out. Arrives rather than passes: this is the landing. */}
          <motion.div
            inert={dive && !landed}
            className={`shell ${dive ? "pointer-events-none absolute inset-x-0 bottom-[9svh]" : ""}`}
            style={{ y: outY, opacity: outFade, willChange: dive ? "transform, opacity" : undefined }}
          >
            {dive && (
              <p className="mb-4 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-ink-3">
                One beam in, three ways through
              </p>
            )}
            <ol className="pointer-events-auto flex flex-col gap-3 sm:flex-row sm:items-stretch">
              {steps.map((s) => (
                <li key={s.n} className="group flex flex-1">
                  <a
                    href={s.href}
                    className="relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border border-line bg-surface/70 px-4 py-3.5 transition-[translate,border-color,box-shadow] duration-300 hover:-translate-y-1"
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
                      style={{
                        boxShadow: `0 16px 40px -22px ${s.color}, inset 0 0 0 1px color-mix(in oklab, ${s.color} 45%, transparent)`,
                      }}
                    />
                  </a>
                </li>
              ))}
            </ol>
          </motion.div>

          {/* The invitation, which withdraws the moment it is taken. */}
          <motion.a
            href="#problem"
            className={`mx-auto flex w-fit items-center gap-2 text-[0.8rem] text-ink-3 transition-colors hover:text-ink ${
              dive ? "absolute inset-x-0 bottom-5" : "mb-6 mt-5"
            }`}
            style={{ opacity: typeHint }}
            inert={dive && landed}
          >
            {dive ? "Scroll to dive in" : "Scroll to begin"} <ArrowDown size={14} />
          </motion.a>
          </div>
        </div>

        {/* The travel: empty height that the camera reads as distance. */}
        {dive && <div aria-hidden="true" className="h-[180svh]" />}
      </div>
    </section>
  );
}
