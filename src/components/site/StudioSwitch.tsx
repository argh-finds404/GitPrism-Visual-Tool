"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, FolderOpen, Home } from "lucide-react";
import { STUDIOS, type StudioId } from "./studios";
import { usePrefersReducedMotion } from "@/lib/theme";

/**
 * The way out of a studio. Every tool reads the same repository, so being stuck in one of them
 * with only a link home was the sharpest gap in the product: six tools, no way between them.
 * Styled against the `.studio` tokens, so it belongs to the dark workspaces rather than the site.
 */
export function StudioSwitch({ current }: { current: StudioId }) {
  const reduce = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const here = STUDIOS.find((s) => s.id === current);

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
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line-2)] px-2.5 text-[12px] text-[var(--ink-2)] transition-colors hover:bg-white/5 hover:text-[var(--ink)]"
      >
        {here?.label ?? "Studios"}
        <ChevronDown size={13} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.95 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 24, mass: 0.7, opacity: { duration: 0.14 } }}
            style={{ originY: 0 }}
            className="hud absolute left-0 top-full z-50 mt-2 w-[19rem] p-1.5"
          >
            {STUDIOS.map((s) => (
              <li key={s.id} role="none">
                <Link
                  role="menuitem"
                  href={s.href}
                  aria-current={s.id === current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-2.5 py-2 transition-colors hover:bg-white/8 ${
                    s.id === current ? "bg-[var(--violet-wash)]" : ""
                  }`}
                >
                  <span className="block text-[12.5px] font-medium text-[var(--ink)]">{s.label}</span>
                  <span className="block text-[11px] text-[var(--ink-3)]">{s.blurb}</span>
                </Link>
              </li>
            ))}
            <li role="none" className="mt-1 border-t border-[var(--line)] pt-1">
              <Link
                role="menuitem"
                href="/analyze"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-[var(--ink-2)] transition-colors hover:bg-white/8"
              >
                <FolderOpen size={13} /> Analyse your own project
              </Link>
            </li>
            <li role="none">
              <Link
                role="menuitem"
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] text-[var(--ink-2)] transition-colors hover:bg-white/8"
              >
                <Home size={13} /> Back to GitPrism
              </Link>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
