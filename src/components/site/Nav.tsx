"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { ArrowUpRight, ChevronDown, Menu, Moon, Sun, X } from "lucide-react";
import { Wordmark } from "@/components/brand/PrismMark";
import { setTheme, useTheme, usePrefersReducedMotion } from "@/lib/theme";
import { STUDIOS as studios } from "./studios";

const links = [
  { href: "#playground", label: "Explore" },
  { href: "#how", label: "How it works" },
  { href: "#learn", label: "Learn" },
];

/** Desktop menu for the studios; closes on outside click, Escape or a choice. */
function StudioMenu() {
  const reduce = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
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
    <li ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-2 text-[0.92rem] text-ink-2 transition-colors hover:text-ink xl:px-4"
      >
        Studios
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            // Arrives on a spring and leaves plainly: entry earns the bounce, exit does not.
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.94 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 520, damping: 24, mass: 0.7, opacity: { duration: 0.14 } }
            }
            style={{ originY: 0 }}
            className="absolute left-1/2 top-full z-50 mt-2 w-[21rem] -translate-x-1/2 rounded-2xl border border-line bg-surface p-1.5 shadow-soft"
          >
            {studios.map((s, i) => (
              <motion.li
                key={s.href}
                role="none"
                initial={reduce ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? { duration: 0 } : { delay: 0.03 * i, type: "spring", stiffness: 600, damping: 26 }}
              >
                <Link
                  role="menuitem"
                  href={s.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2 transition-colors hover:bg-violet-wash"
                >
                  <span className="block text-[0.9rem] font-medium text-ink">{s.label}</span>
                  <span className="block text-[0.78rem] text-ink-3">{s.blurb}</span>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

function ThemeToggle() {
  const theme = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={(e) => setTheme(next, { x: e.clientX, y: e.clientY })}
      aria-label={`Switch to ${next} appearance`}
      className="grid h-10 w-10 place-items-center rounded-full text-ink-2 transition-colors hover:bg-violet-wash hover:text-violet-ink"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
          animate={{ rotate: 0, opacity: 1, scale: 1 }}
          exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  // One shared scroll value: the hairline reads it directly (no re-render), and the
  // solid background flips only when crossing 24px.
  const { scrollY, scrollYProgress } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 24));
  // The page can load already scrolled (restored position, #anchor links); check on the first frame.
  useEffect(() => {
    const id = requestAnimationFrame(() => setScrolled(scrollY.get() > 24));
    return () => cancelAnimationFrame(id);
  }, [scrollY]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-6 md:pt-4">
      <nav
        aria-label="Primary"
        className={`relative mx-auto flex h-14 max-w-[1240px] items-center justify-between rounded-full pl-5 pr-2 transition-[background-color,box-shadow,border-color] duration-500 ${
          scrolled ? "border border-line bg-[color-mix(in_oklab,var(--paper)_95%,transparent)] shadow-soft" : "border border-transparent bg-transparent"
        }`}
      >
        {/* Reading progress, as a beam of the spectrum along the bar's lower edge. */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 bottom-0 h-px origin-left"
          style={{
            scaleX: scrollYProgress,
            opacity: scrolled ? 1 : 0,
            background: "linear-gradient(90deg, var(--violet), var(--magenta), var(--amber), var(--cyan))",
          }}
        />
        <a href="#top" aria-label="GitPrism home" className="rounded-full">
          <Wordmark />
        </a>

        <ul className="hidden items-center gap-0.5 lg:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="whitespace-nowrap rounded-full px-3 py-2 text-[0.92rem] text-ink-2 transition-colors hover:text-ink xl:px-4">
                {l.label}
              </Link>
            </li>
          ))}
          <StudioMenu />
        </ul>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          <span className="hidden md:block">
            <Link href="/lab" className="btn btn-primary btn-sm whitespace-nowrap">
              Open the lab <ArrowUpRight size={16} className="btn-arrow" />
            </Link>
          </span>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full text-ink lg:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(true)}
          >
            <Menu size={20} />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-paper px-5 pt-4 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex h-14 items-center justify-between pl-2">
              <Wordmark />
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-full"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X size={22} />
              </button>
            </div>
            <ul className="mt-10 flex flex-col">
              {links.map((l, i) => (
                <motion.li
                  key={l.href}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 * i + 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link href={l.href} onClick={() => setOpen(false)} className="display block border-b border-line py-5 text-[clamp(2.2rem,11vw,3rem)]">
                    {l.label}
                  </Link>
                </motion.li>
              ))}
            </ul>
            <p className="mt-8 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-ink-3">Studios</p>
            <ul className="mt-2 flex flex-col">
              {studios.map((t) => (
                <li key={t.href}>
                  <Link href={t.href} onClick={() => setOpen(false)} className="block border-b border-line py-3.5">
                    <span className="block text-[1.05rem] text-ink">{t.label}</span>
                    <span className="block text-[0.82rem] text-ink-3">{t.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/lab" onClick={() => setOpen(false)} className="btn btn-primary mb-8 mt-8 justify-center">
              Open the lab <ArrowUpRight size={16} />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
