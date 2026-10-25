"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/theme";

const HEX = "0123456789abcdef";
const DURATION_MS = 560;

/**
 * An object ID that resolves into place the first time it scrolls into view: characters settle
 * left to right out of scrambled hex, as if the hash were being computed. It writes the text node
 * directly on animation frames (no React renders), plays once, and is static with reduced motion.
 * Screen readers always get the real value.
 */
export function HashText({ value, className = "", delay = 0 }: { value: string; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) return;
    let raf = 0;
    let timer = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        timer = window.setTimeout(() => {
          let start = 0;
          const tick = (t: number) => {
            start ||= t;
            const p = Math.min(1, (t - start) / DURATION_MS);
            // Ease out, so the last characters land gently.
            const settled = Math.floor((1 - (1 - p) ** 2) * value.length);
            let s = value.slice(0, settled);
            for (let i = settled; i < value.length; i++) s += HEX[(Math.random() * 16) | 0];
            el.textContent = s;
            if (p < 1) raf = requestAnimationFrame(tick);
            else el.textContent = value;
          };
          raf = requestAnimationFrame(tick);
        }, delay);
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      el.textContent = value;
    };
  }, [value, reduce, delay]);

  return (
    <span className={`tabular-nums ${className}`}>
      <span ref={ref} aria-hidden="true">
        {value}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
