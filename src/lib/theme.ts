"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function useTheme() {
  return useSyncExternalStore(subscribe, read, () => "light" as Theme);
}

/** Switch theme with a circular reveal that starts at the given point. */
export function setTheme(next: Theme, origin?: { x: number; y: number }) {
  const apply = () => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("gp-theme", next);
    } catch {}
  };
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) return apply();

  const x = origin?.x ?? window.innerWidth - 40;
  const y = origin?.y ?? 40;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const t = document.startViewTransition(apply);
  t.ready.then(() => {
    document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 650, easing: "cubic-bezier(0.22, 1, 0.36, 1)", pseudoElement: "::view-transition-new(root)" },
    );
  });
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Live media query match. Only used by client-only views (after the lab has loaded). */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}
