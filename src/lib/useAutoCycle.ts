"use client";

import { useEffect, useState } from "react";

/** Cycles 0..count-1 on an interval while enabled; pauses (keeping its place) when not. */
export function useAutoCycle(count: number, enabled: boolean, intervalMs = 2400) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!enabled || count < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => clearInterval(id);
  }, [enabled, count, intervalMs]);
  return count ? index % count : 0;
}
