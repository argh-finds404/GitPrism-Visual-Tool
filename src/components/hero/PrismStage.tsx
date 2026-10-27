"use client";

import { motion } from "motion/react";
import { INTRO } from "./HexField";

/**
 * The prism itself, drawn as line work: it strokes itself into place when the beam arrives,
 * then holds the frame until the WebGL prism has compiled and crossfades over it.
 */
export function PrismStage({ reduced, handedOff }: { reduced?: boolean; handedOff: boolean }) {
  const t = (s: number) => (reduced ? 0 : s);
  return (
    <motion.svg
      viewBox="0 0 200 200"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
      initial={false}
      animate={{ opacity: handedOff ? 0 : 1 }}
      transition={{ duration: reduced ? 0 : 0.8, ease: "easeOut" }}
    >
      <defs>
        <linearGradient id="hero-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B6A0FF" stopOpacity="0.4" />
          <stop offset="0.5" stopColor="#7654E8" stopOpacity="0.22" />
          <stop offset="1" stopColor="#3EE0FF" stopOpacity="0.18" />
        </linearGradient>
        <radialGradient id="hero-core">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#B6A0FF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* The refraction point, dead centre: where the white beam becomes a spectrum, and where
          the canvas fan has its origin. */}
      <motion.circle
        cx="100"
        cy="100"
        r="42"
        fill="url(#hero-core)"
        initial={reduced ? false : { opacity: 0, scale: 0.4 }}
        animate={{ opacity: 0.75, scale: 1 }}
        transition={{ duration: t(0.9), delay: t(INTRO.prism), ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "100px 100px" }}
      />

      {/* Body, filled after the outline has drawn. */}
      <motion.path
        d="M100 28 L162 140 H38 Z"
        fill="url(#hero-glass)"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: t(0.7), delay: t(INTRO.prism + 0.25) }}
      />

      {/* Outline: strokes itself on, edge by edge. */}
      <motion.path
        d="M100 28 L162 140 H38 Z"
        fill="none"
        stroke="#C4B3FF"
        strokeWidth="1.4"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={reduced ? false : { pathLength: 0, opacity: 0.95 }}
        animate={{ pathLength: 1, opacity: 0.95 }}
        transition={{ duration: t(0.85), delay: t(INTRO.prism), ease: [0.22, 1, 0.36, 1] }}
      />

      {/* Inner facet, so the glass reads as a solid rather than a flat triangle. */}
      <motion.path
        d="M100 28 L123 140"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.26"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        initial={reduced ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: t(0.7), delay: t(INTRO.prism + 0.3), ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.svg>
  );
}
