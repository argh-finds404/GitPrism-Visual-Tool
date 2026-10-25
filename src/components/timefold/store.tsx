"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { symbolId } from "@/features/impact-analysis/analysis-service";
import { allTests, fixtureTimeline, functionDna, lineages, type DnaEntry, type History } from "@/features/timefold/history";
import type { BisectState } from "@/features/timefold/bisect";

export type Mode = "dna" | "drift" | "bisect";

/** Workspace colours. TimeFold is a dark workspace, like the Impact Studio. */
export const C = {
  violet: "#9D7BFF",
  cyan: "#3EE0FF",
  green: "#3DE0A6",
  magenta: "#FF5CB8",
  amber: "#FFC15C",
  red: "#FF7A90",
  ink: "#F3EEF8",
  ink2: "#C9C0D8",
  ink3: "#9A90AD",
  line: "rgb(255 255 255 / 0.08)",
} as const;

export const LANE_COLOR: Record<string, string> = { main: C.violet, "feat/auth": C.cyan };

export const EVENT_STYLE: Record<DnaEntry["events"][number]["kind"], { color: string; label: string }> = {
  created: { color: C.green, label: "Created" },
  renamed: { color: C.amber, label: "Renamed" },
  signature: { color: C.magenta, label: "Signature" },
  body: { color: C.violet, label: "Body" },
  calls: { color: C.cyan, label: "Calls" },
  callers: { color: "#8FD8FF", label: "Callers" },
  tests: { color: C.green, label: "Tests" },
  deleted: { color: C.red, label: "Deleted" },
};

type Store = {
  h: History;
  index: number;
  setIndex: (i: number) => void;
  /** Revision under the playhead while dragging; views that are cheap follow it immediately. */
  preview: number | null;
  setPreview: (i: number | null) => void;
  lineage: string;
  setLineage: (l: string) => void;
  dna: DnaEntry[];
  relevant: number[];
  mode: Mode;
  setMode: (m: Mode) => void;
  onlyRelevant: boolean;
  setOnlyRelevant: (v: boolean) => void;
  visible: number[];
  playing: boolean;
  setPlaying: (v: boolean) => void;
  speed: 1 | 2 | 4;
  setSpeed: (s: 1 | 2 | 4) => void;
  bisect: BisectState | null;
  setBisect: (b: BisectState | null) => void;
  tests: ReturnType<typeof allTests>;
  symbols: ReturnType<typeof lineages>;
};

const Ctx = createContext<Store | null>(null);

export function useTimeFold() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useTimeFold outside TimeFoldProvider");
  return s;
}

const DEFAULT_SYMBOL = symbolId("src/auth/session.ts", "checkSession"); // validateSession's lineage

function readUrl(h: History) {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const mode = q.get("mode");
  const at = q.get("at");
  const fn = q.get("fn");
  const index = at ? h.snapshots.findIndex((s) => s.commit.oid.startsWith(at)) : -1;
  return {
    mode: mode === "dna" || mode === "drift" || mode === "bisect" ? (mode as Mode) : undefined,
    index: index >= 0 ? index : undefined,
    lineage: fn && h.lineageOf.has(fn) ? h.lineageOf.get(fn) : undefined,
  };
}

export function TimeFoldProvider({ children }: { children: ReactNode }) {
  const h = useMemo(() => fixtureTimeline(), []);
  const [initial] = useState(() => readUrl(h));
  const [index, setIndexRaw] = useState(initial.index ?? h.snapshots.length - 1);
  const [preview, setPreview] = useState<number | null>(null);
  const [lineage, setLineage] = useState(initial.lineage ?? DEFAULT_SYMBOL);
  const [mode, setMode] = useState<Mode>(initial.mode ?? "dna");
  const [onlyRelevant, setOnlyRelevant] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [bisect, setBisect] = useState<BisectState | null>(null);

  const dna = useMemo(() => functionDna(h, lineage), [h, lineage]);
  const relevant = useMemo(() => dna.filter((e) => e.events.length).map((e) => e.index), [dna]);
  const all = useMemo(() => h.snapshots.map((s) => s.index), [h]);
  // Filtering only applies where it helps: following one function's history.
  const visible = mode === "dna" && onlyRelevant && relevant.length ? relevant : all;

  const setIndex = useCallback((i: number) => setIndexRaw(Math.max(0, Math.min(h.snapshots.length - 1, i))), [h]);

  // Keep the address shareable: mode, function and commit.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set("mode", mode);
    q.set("fn", dna.findLast((e) => e.id)?.id ?? lineage);
    q.set("at", h.snapshots[index].commit.oid.slice(0, 7));
    window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
  }, [mode, lineage, index, dna, h]);

  const value: Store = {
    h,
    index,
    setIndex,
    preview,
    setPreview,
    lineage,
    setLineage,
    dna,
    relevant,
    mode,
    setMode,
    onlyRelevant,
    setOnlyRelevant,
    visible,
    playing,
    setPlaying,
    speed,
    setSpeed,
    bisect,
    setBisect,
    tests: useMemo(() => allTests(h), [h]),
    symbols: useMemo(() => lineages(h), [h]),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
