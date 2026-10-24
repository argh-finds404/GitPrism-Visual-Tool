"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Menu, Moon, Sun, X } from "lucide-react";
import { Wordmark } from "@/components/brand/PrismMark";
import { setTheme, useTheme } from "@/lib/theme";

const links = [
  { href: "#playground", label: "Explore" },
  { href: "#how", label: "How it works" },
  { href: "#learn", label: "Learn" },
  { href: "/review/gitprism-demo/acme-shop/pull/42", label: "PR Studio" },
];

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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        className={`mx-auto flex h-14 max-w-[1240px] items-center justify-between rounded-full pl-5 pr-2 transition-[background-color,box-shadow,border-color,backdrop-filter] duration-500 ${
          scrolled
            ? "border border-line bg-[color-mix(in_oklab,var(--paper)_78%,transparent)] shadow-soft backdrop-blur-xl"
            : "border border-transparent bg-transparent"
        }`}
      >
        <a href="#top" aria-label="GitPrism home" className="rounded-full">
          <Wordmark />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="rounded-full px-4 py-2 text-[0.92rem] text-ink-2 transition-colors hover:text-ink">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <span className="hidden md:block">
            <Link href="/lab" className="btn btn-primary btn-sm">
              Open the lab <ArrowUpRight size={16} className="btn-arrow" />
            </Link>
          </span>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full text-ink md:hidden"
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
            className="fixed inset-0 z-50 flex flex-col bg-paper px-5 pt-4 md:hidden"
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
            <Link href="/lab" onClick={() => setOpen(false)} className="btn btn-primary mt-auto mb-8 justify-center">
              Open the lab <ArrowUpRight size={16} />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
