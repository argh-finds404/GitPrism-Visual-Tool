"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fixtureHistory, FIXTURE } from "@/features/impact-analysis/fixture";
import { buildCandidate, mergeTrees, type Candidate, type MergeResult, type Resolution } from "@/features/mergelab/merge";
import { conflictPlaces, constellation, type Place, type Relation } from "@/features/mergelab/semantic";

/** Side colours: ours violet, theirs cyan, base amber, resolved green. Paired with labels everywhere. */
export const M = {
  ours: "#9D7BFF",
  theirs: "#3EE0FF",
  base: "#FFC15C",
  resolved: "#3DE0A6",
  red: "#FF7A90",
  ink: "#F3EEF8",
  ink2: "#C9C0D8",
  ink3: "#9A90AD",
} as const;

export type Selection = { kind: "conflict"; id: string } | { kind: "file"; path: string };

export type LogEntry = { at: number; target: string; action: string; note?: string };

type Change = { kind: "resolution"; id: string; before?: Resolution; after?: Resolution } | { kind: "file"; path: string; before?: string; after?: string };

type Saved = { resolutions: Record<string, Resolution>; fileEdits: Record<string, string>; log: LogEntry[]; notes: Record<string, string> };

type Store = {
  refs: { ours: string; theirs: string; oursOid: string; theirsOid: string; base: string };
  sides: { base: Record<string, string>; ours: Record<string, string>; theirs: Record<string, string> };
  m: MergeResult;
  places: Map<string, Place>;
  relations: Relation[];
  groups: string[][];
  resolutions: Record<string, Resolution>;
  fileEdits: Record<string, string>;
  notes: Record<string, string>;
  log: LogEntry[];
  candidate: Candidate;
  selection: Selection;
  select: (s: Selection) => void;
  view: "line" | "semantic";
  setView: (v: "line" | "semantic") => void;
  resolve: (id: string, r: Resolution | undefined) => void;
  editFile: (path: string, text: string | undefined) => void;
  setNote: (id: string, note: string) => void;
  undo: () => void;
  canUndo: boolean;
  reset: () => void;
  /** Bumps whenever the candidate changes, so stale check results can be discarded. */
  revision: number;
};

const Ctx = createContext<Store | null>(null);

export function useMergeLab() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useMergeLab outside MergeLabProvider");
  return s;
}

const strategyLabel: Record<Resolution["strategy"], string> = {
  ours: "Used ours",
  theirs: "Used theirs",
  "ours-theirs": "Kept both, ours first",
  "theirs-ours": "Kept both, theirs first",
  edit: "Edited by hand",
};

export function MergeLabProvider({ children }: { children: ReactNode }) {
  const fx = useMemo(() => fixtureHistory(), []);
  const oursTip = fx.commits.at(-1)!;
  const theirsTip = fx.incoming.at(-1)!;
  const sides = useMemo(
    () => ({ base: fx.all.find((c) => c.oid === fx.mergeBase)!.files, ours: oursTip.files, theirs: theirsTip.files }),
    [fx, oursTip, theirsTip],
  );
  const merged = useMemo(() => mergeTrees(sides.base, sides.ours, sides.theirs), [sides]);
  const places = useMemo(() => conflictPlaces(merged, sides), [merged, sides]);
  const { relations, groups } = useMemo(() => constellation(merged, places), [merged, places]);
  // Conflicts that others call into come first: settle the shared function before its callers.
  const m = useMemo(() => {
    const callers = (id: string) => relations.filter((r) => r.kind === "calls" && r.b === id).length;
    return { ...merged, conflicts: [...merged.conflicts].sort((a, b) => callers(b.id) - callers(a.id)) };
  }, [merged, relations]);
  const storageKey = `gitprism:mergelab:${oursTip.oid}..${theirsTip.oid}`;

  const [saved, setSaved] = useState<Saved>(() => {
    const empty: Saved = { resolutions: {}, fileEdits: {}, log: [], notes: {} };
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw ? { ...empty, ...(JSON.parse(raw) as Saved) } : empty;
    } catch {
      return empty;
    }
  });
  const [undoStack, setUndoStack] = useState<Change[]>([]);
  const [selection, select] = useState<Selection>({ kind: "conflict", id: m.conflicts[0]?.id ?? "" });
  const [view, setView] = useState<"line" | "semantic">("line");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      // Storage can be unavailable (private mode); the session still works.
    }
  }, [saved, storageKey]);

  const record = (target: string, action: string, note?: string): LogEntry => ({ at: Date.now(), target, action, note });

  const resolve = (id: string, r: Resolution | undefined) => {
    const before = saved.resolutions[id];
    if (JSON.stringify(before) === JSON.stringify(r)) return;
    const resolutions = { ...saved.resolutions };
    if (r) resolutions[id] = r;
    else delete resolutions[id];
    setSaved({ ...saved, resolutions, log: [...saved.log, record(id, r ? strategyLabel[r.strategy] : "Deferred", saved.notes[id])] });
    setUndoStack([...undoStack, { kind: "resolution", id, before, after: r }]);
    setRevision((v) => v + 1);
  };

  const editFile = (path: string, text: string | undefined) => {
    const before = saved.fileEdits[path];
    if (before === text) return;
    const fileEdits = { ...saved.fileEdits };
    if (text === undefined) delete fileEdits[path];
    else fileEdits[path] = text;
    setSaved({ ...saved, fileEdits, log: [...saved.log, record(path, text === undefined ? "Discarded file edit" : "Edited the whole file")] });
    setUndoStack([...undoStack, { kind: "file", path, before, after: text }]);
    setRevision((v) => v + 1);
  };

  const undo = () => {
    const last = undoStack.at(-1);
    if (!last) return;
    if (last.kind === "resolution") {
      const resolutions = { ...saved.resolutions };
      if (last.before) resolutions[last.id] = last.before;
      else delete resolutions[last.id];
      setSaved({ ...saved, resolutions, log: [...saved.log, record(last.id, "Undid the last change")] });
    } else {
      const fileEdits = { ...saved.fileEdits };
      if (last.before === undefined) delete fileEdits[last.path];
      else fileEdits[last.path] = last.before;
      setSaved({ ...saved, fileEdits, log: [...saved.log, record(last.path, "Undid the last change")] });
    }
    setUndoStack(undoStack.slice(0, -1));
    setRevision((v) => v + 1);
  };

  const reset = useCallback(() => {
    setSaved({ resolutions: {}, fileEdits: {}, log: [], notes: {} });
    setUndoStack([]);
    setRevision((v) => v + 1);
  }, []);

  const setNote = useCallback((id: string, note: string) => setSaved((s) => ({ ...s, notes: { ...s.notes, [id]: note } })), []);

  const candidate = useMemo(() => buildCandidate(m, saved.resolutions, saved.fileEdits), [m, saved.resolutions, saved.fileEdits]);

  const value: Store = {
    refs: { ours: FIXTURE.source, theirs: FIXTURE.incoming, oursOid: oursTip.oid, theirsOid: theirsTip.oid, base: fx.mergeBase },
    sides,
    m,
    places,
    relations,
    groups,
    resolutions: saved.resolutions,
    fileEdits: saved.fileEdits,
    notes: saved.notes,
    log: saved.log,
    candidate,
    selection,
    select,
    view,
    setView,
    resolve,
    editFile,
    setNote,
    undo,
    canUndo: undoStack.length > 0,
    reset,
    revision,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
