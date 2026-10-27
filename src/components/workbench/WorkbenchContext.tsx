"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useRepository } from "@/features/repository/RepositoryProvider";
import { headCommitId } from "@/features/repository/engine";
import type { ObjectId, RepositoryCommand } from "@/features/repository/types";

// UI and visualization state. Repository data never lives here: selections are
// IDs that panels look up in the one repository state.

export type Selection = { kind: "object"; oid: ObjectId } | { kind: "branch"; name: string } | { kind: "head" } | null;
export type CanvasView = "history" | "objects" | "refraction" | "editor";
export type BottomTab = "history" | "changes" | "compare" | "replay" | "explain";
export type ExplorerTab = "files" | "objects" | "refs";
export type MobileView = "files" | "graph" | "inspect" | "timeline";
export type ChangeRef = { path: string; area: "staged" | "unstaged" } | null;

type Toast = { id: number; message: string; tone: "error" | "info" } | null;

type WorkbenchValue = {
  selection: Selection;
  select: (s: Selection) => void;
  /** Commit whose tree the Objects and Refraction views open up. */
  focusCommit: ObjectId | null;
  setFocusCommit: (oid: ObjectId | null) => void;
  trace: ObjectId[] | null;
  setTrace: (t: ObjectId[] | null) => void;
  view: CanvasView;
  setView: (v: CanvasView) => void;
  openFile: string | null;
  open: (path: string) => void;
  closeFile: () => void;
  bottomTab: BottomTab;
  bottomOpen: boolean;
  showBottom: (tab: BottomTab) => void;
  setBottomOpen: (o: boolean) => void;
  explorerTab: ExplorerTab;
  setExplorerTab: (t: ExplorerTab) => void;
  explorerOpen: boolean;
  setExplorerOpen: (o: boolean) => void;
  inspectorOpen: boolean;
  setInspectorOpen: (o: boolean) => void;
  mobileView: MobileView;
  setMobileView: (v: MobileView) => void;
  compare: { base: ObjectId | null; target: ObjectId | null; path: string | null };
  setCompare: (c: Partial<WorkbenchValue["compare"]>) => void;
  change: ChangeRef;
  setChange: (c: ChangeRef) => void;
  branchFilter: string[] | null;
  setBranchFilter: (b: string[] | null) => void;
  guided: boolean;
  setGuided: (g: boolean) => void;
  toast: Toast;
  notify: (message: string, tone?: "error" | "info") => void;
  /** Run a repository command and surface any error as a message. */
  exec: (cmd: RepositoryCommand) => boolean;
};

const Ctx = createContext<WorkbenchValue | null>(null);

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const repo = useRepository();
  const [selection, setSelection] = useState<Selection>(null);
  const [focusRaw, setFocusCommit] = useState<ObjectId | null>(null);
  const [trace, setTrace] = useState<ObjectId[] | null>(null);
  const [view, setView] = useState<CanvasView>("history");
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<BottomTab>("changes");
  const [bottomOpen, setBottomOpen] = useState(true);
  const [explorerTab, setExplorerTab] = useState<ExplorerTab>("files");
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("graph");
  const [compare, setCompareRaw] = useState<WorkbenchValue["compare"]>({ base: null, target: null, path: null });
  const [change, setChange] = useState<ChangeRef>(null);
  const [branchFilter, setBranchFilter] = useState<string[] | null>(null);
  const [guided, setGuided] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const toastId = useRef(0);

  // Fall back to HEAD when the remembered commit no longer exists (after undo or reset).
  const focusCommit = focusRaw && repo.state.objects[focusRaw] ? focusRaw : headCommitId(repo.state);

  const notify = useCallback((message: string, tone: "error" | "info" = "info") => {
    const id = ++toastId.current;
    setToast({ id, message, tone });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 5200);
  }, []);

  const select = useCallback(
    (s: Selection) => {
      setSelection(s);
      setTrace(null);
      if (s?.kind === "object" && repo.state.objects[s.oid]?.type === "commit") setFocusCommit(s.oid);
      if (s) setInspectorOpen(true);
    },
    [repo.state.objects],
  );

  const { run } = repo;
  const exec = useCallback(
    (cmd: RepositoryCommand) => {
      const err = run(cmd);
      if (err) notify(err, "error");
      return !err;
    },
    [run, notify],
  );

  const value = useMemo<WorkbenchValue>(
    () => ({
      selection: selection?.kind === "object" && !repo.state.objects[selection.oid] ? null : selection,
      select,
      focusCommit,
      setFocusCommit,
      trace,
      setTrace,
      view,
      setView,
      openFile,
      open: (path) => {
        setOpenFile(path);
        setView("editor");
        setMobileView("graph");
      },
      closeFile: () => {
        setOpenFile(null);
        setView((v) => (v === "editor" ? "history" : v));
      },
      bottomTab,
      bottomOpen,
      showBottom: (tab) => {
        setBottomTab(tab);
        setBottomOpen(true);
        setMobileView((m) => (m === "graph" || m === "timeline" ? "timeline" : m));
      },
      setBottomOpen,
      explorerTab,
      setExplorerTab,
      explorerOpen,
      setExplorerOpen,
      inspectorOpen,
      setInspectorOpen,
      mobileView,
      setMobileView,
      compare,
      setCompare: (c) => setCompareRaw((p) => ({ ...p, ...c })),
      change,
      setChange,
      branchFilter,
      setBranchFilter,
      guided,
      setGuided,
      toast,
      notify,
      exec,
    }),
    [selection, repo.state.objects, select, focusCommit, trace, view, openFile, bottomTab, bottomOpen, explorerTab, explorerOpen, inspectorOpen, mobileView, compare, change, branchFilter, guided, toast, notify, exec],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkbench() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkbench must be used inside <WorkbenchProvider>");
  return ctx;
}
