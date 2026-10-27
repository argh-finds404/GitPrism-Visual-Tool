"use client";

import { useEffect, useState } from "react";
import { short } from "@/lib/git";
import { commits } from "@/lib/sample";

/**
 * A working status line, the way a terminal prompt or an editor's status bar reads: the branch,
 * the real HEAD object ID from the sample repository, and a live clock. Nothing invented.
 */
export function StatusChip({ className = "" }: { className?: string }) {
  const [clock, setClock] = useState<string | null>(null);

  // Rendered empty on the server: a clock in markup would hydrate against a different second.
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString(undefined, { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className={`flex items-center gap-2.5 font-mono text-[0.7rem] text-ink-3 ${className}`}>
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-add" aria-hidden="true" />
        main
      </span>
      <span className="text-line-2" aria-hidden="true">
        │
      </span>
      <span className="text-amber">{short(commits.c3.oid)}</span>
      <span className="text-line-2" aria-hidden="true">
        │
      </span>
      <span className="tabular-nums" suppressHydrationWarning>
        {clock ?? "--:--:--"}
      </span>
    </span>
  );
}
