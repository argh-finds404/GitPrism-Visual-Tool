"use client";

/**
 * Smooth input — adapted from Skiper UI's skiper106.
 *
 * The technique is theirs: measure the text that sits before the caret, then spring a drawn caret
 * to that position while the real one stays hidden. What shipped with it is not kept — the demo was
 * driven by `dialkit`, a developer control panel, and by `framer-motion` alongside the `motion`
 * package this project already uses, and it read `navigator` at module scope, which breaks a
 * prerender. Styling uses this project's tokens rather than shadcn's.
 *
 * Re-running `shadcn add @skiper-ui/skiper106 --overwrite` replaces this file with the demo again.
 */

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/theme";

type Props = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  type?: "text" | "password";
  wrapperClassName?: string;
};

/** Firefox draws a larger bullet for masked characters, so measuring has to match the browser. */
const passwordChar = () => (typeof navigator !== "undefined" && /firefox|fxios/i.test(navigator.userAgent) ? "●" : "•");

export function SmoothInput({ className, wrapperClassName, value, defaultValue, onChange, type = "text", ...props }: Props) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const input = useRef<HTMLInputElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const reduce = usePrefersReducedMotion();

  const caretX = useMotionValue(0);
  const caretOpacity = useMotionValue(0);
  const x = useSpring(caretX, reduce ? { stiffness: 10000, damping: 100, mass: 0.1 } : { stiffness: 500, damping: 30, mass: 0.5 });

  const controlled = value !== undefined;
  const text = controlled ? String(value) : String(internal);

  useEffect(() => {
    const el = input.current;
    const span = measure.current;
    if (!el || !span) return;

    /** Width of the text before the caret, measured in the input's own font. */
    const prefixWidth = (before: string) => {
      const s = getComputedStyle(el);
      span.style.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
      span.style.letterSpacing = s.letterSpacing;
      span.textContent = before;
      const padLeft = parseFloat(s.paddingLeft) || 0;
      return before.length ? span.offsetWidth + padLeft : padLeft;
    };

    const update = () => {
      if (document.activeElement !== el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const index = start === end ? start : el.selectionDirection === "backward" ? start : end;
      const before = el.type === "password" ? passwordChar().repeat(index) : el.value.slice(0, index);

      const absolute = prefixWidth(before);
      const s = getComputedStyle(el);
      const padLeft = parseFloat(s.paddingLeft) || 0;
      const padRight = parseFloat(s.paddingRight) || 0;

      // Keep the caret inside the visible run of a scrolled input.
      const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
      if (absolute > el.scrollLeft + el.clientWidth - padRight) el.scrollLeft = Math.min(absolute - el.clientWidth + padRight, maxScroll);
      else if (absolute < el.scrollLeft + padLeft) el.scrollLeft = Math.max(0, absolute - padLeft);

      const pos = absolute - el.scrollLeft;
      const maxX = el.clientWidth - padRight;
      caretX.set(Math.min(pos, maxX));
      caretOpacity.set(start !== end || pos < padLeft - 1 || pos > maxX + 1 ? 0 : 1);
    };

    const hide = () => caretOpacity.set(0);
    const events = ["input", "click", "keyup", "select", "scroll", "focus"] as const;
    events.forEach((e) => el.addEventListener(e, update));
    el.addEventListener("blur", hide);
    document.addEventListener("selectionchange", update);
    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      events.forEach((e) => el.removeEventListener(e, update));
      el.removeEventListener("blur", hide);
      document.removeEventListener("selectionchange", update);
      ro.disconnect();
    };
  }, [caretX, caretOpacity]);

  return (
    <div
      className={cn(
        "relative rounded-xl border border-line-2 bg-surface transition-[border-color,box-shadow] duration-200",
        "has-[:focus-visible]:border-violet has-[:focus-visible]:shadow-[0_0_0_3px_var(--violet-wash)]",
        wrapperClassName,
      )}
    >
      <input
        ref={input}
        type={type}
        value={controlled ? value : internal}
        onChange={(e) => {
          if (!controlled) setInternal(e.target.value);
          onChange?.(e);
        }}
        className={cn("w-full bg-transparent px-3.5 py-2.5 text-ink caret-transparent outline-none placeholder:text-ink-3", className)}
        {...props}
      />
      {/* The drawn caret, springing to where the real one is. */}
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 h-[1.15em] w-[2px] -translate-y-1/2 rounded-full bg-violet"
        style={{ x, opacity: caretOpacity }}
      />
      {/* Off-screen ruler used to measure the text before the caret. */}
      <span ref={measure} aria-hidden="true" className="invisible absolute left-0 top-0 whitespace-pre" />
      <span className="sr-only">{text.length} characters</span>
    </div>
  );
}
