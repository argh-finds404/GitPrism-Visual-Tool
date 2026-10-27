"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Compass, Home } from "lucide-react";
import { STUDIOS, type StudioId } from "./studios";
import { usePrefersReducedMotion } from "@/lib/theme";

/**
 * Universal cross-lab navigation switcher.
 * Connects all 8 core workbenches and PR review studios with clear route discovery,
 * active indicators, and zero friction transitions.
 */
export function StudioSwitch({ current }: { current: StudioId }) {
  const reduce = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const here = STUDIOS.find((s) => s.id === current);

  const coreStudios = STUDIOS.filter((s) => s.category === "core");
  const reviewStudios = STUDIOS.filter((s) => s.category === "review");

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line-2)] bg-surface/50 px-2.5 text-[12px] font-medium text-[var(--ink-2)] transition-colors hover:border-violet hover:bg-white/5 hover:text-[var(--ink)]"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-violet" />
        <span>{here?.label ?? "Studios"}</span>
        <ChevronDown size={13} className={`text-ink-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.95 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 24, mass: 0.7, opacity: { duration: 0.14 } }}
            style={{ originY: 0 }}
            className="hud absolute left-0 top-full z-50 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-[var(--line-2)] bg-surface/98 p-2 shadow-2xl backdrop-blur-xl"
          >
            {/* Header / Context indicator */}
            <div className="flex items-center justify-between border-b border-[var(--line)] px-2.5 pb-2 pt-1 font-mono text-[10.5px] uppercase tracking-wider text-[var(--ink-3)]">
              <span className="flex items-center gap-1.5">
                <Compass size={12} className="text-violet" /> Switch Workspace
              </span>
              <span>8 destinations</span>
            </div>

            {/* Core Workbenches & Labs */}
            <div className="pt-2">
              <p className="px-2.5 pb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--ink-3)]">Workspaces &amp; Labs</p>
              <ul className="space-y-0.5">
                {coreStudios.map((s) => {
                  const isActive = s.id === current;
                  return (
                    <li key={s.id} role="none">
                      <Link
                        role="menuitem"
                        href={s.href}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={`group flex items-center justify-between rounded-xl px-2.5 py-2 transition-colors ${
                          isActive
                            ? "bg-[var(--violet-wash)] text-[var(--ink)] font-semibold shadow-sm"
                            : "text-[var(--ink-2)] hover:bg-white/8 hover:text-[var(--ink)]"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[12.5px] font-medium leading-tight">{s.label}</span>
                            {s.badge && (
                              <span className="rounded-full bg-violet/15 px-1.5 py-0.2 font-mono text-[9.5px] font-medium text-violet-ink">
                                {s.badge}
                              </span>
                            )}
                          </div>
                          <span className="block truncate text-[11px] text-[var(--ink-3)] group-hover:text-[var(--ink-2)]">
                            {s.blurb}
                          </span>
                        </div>
                        {isActive && <Check size={14} className="shrink-0 text-violet" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* PR & Architecture Review Studios */}
            <div className="mt-2 border-t border-[var(--line)] pt-2">
              <p className="px-2.5 pb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--ink-3)]">PR Review Studios</p>
              <ul className="space-y-0.5 max-h-[220px] overflow-y-auto pr-0.5">
                {reviewStudios.map((s) => {
                  const isActive = s.id === current;
                  return (
                    <li key={s.id} role="none">
                      <Link
                        role="menuitem"
                        href={s.href}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-colors ${
                          isActive
                            ? "bg-[var(--violet-wash)] text-[var(--ink)] font-semibold shadow-sm"
                            : "text-[var(--ink-2)] hover:bg-white/8 hover:text-[var(--ink)]"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <span className="block text-[12.5px] font-medium leading-tight">{s.label}</span>
                          <span className="block truncate text-[11px] text-[var(--ink-3)] group-hover:text-[var(--ink-2)]">
                            {s.blurb}
                          </span>
                        </div>
                        {isActive && <Check size={14} className="shrink-0 text-violet" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Footer / Home link */}
            <div className="mt-2 border-t border-[var(--line)] pt-1">
              <Link
                role="menuitem"
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[12px] text-[var(--ink-3)] transition-colors hover:bg-white/8 hover:text-[var(--ink)]"
              >
                <Home size={13} /> Return to GitPrism Home
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

