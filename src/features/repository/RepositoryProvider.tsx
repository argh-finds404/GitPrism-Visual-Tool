"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apply } from "./engine";
import { buildSteps, type Step } from "./session";
import { indexedDbStorage, memoryStorage, type LabStorage } from "./storage";
import type { RepositoryCommand, RepositoryState } from "./types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

type RepositoryContextValue = {
  status: "loading" | "ready";
  /** The state every panel renders: the latest step, or the replayed one. */
  state: RepositoryState;
  steps: Step[];
  /** Index of the step being shown. Equal to steps.length - 1 unless replaying. */
  cursor: number;
  replaying: boolean;
  setCursor: (i: number) => void;
  /** Run a command. Returns an error message, or null when it succeeded. */
  run: (cmd: RepositoryCommand) => string | null;
  undo: () => void;
  reset: () => Promise<void>;
  canUndo: boolean;
  saveStatus: SaveStatus;
  storageNote: string | null;
  completed: string[];
  complete: (id: string) => void;
};

const Ctx = createContext<RepositoryContextValue | null>(null);

export function RepositoryProvider({ children, storage: given }: { children: ReactNode; storage?: LabStorage }) {
  const storage = useRef<LabStorage>(given ?? indexedDbStorage);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [commands, setCommands] = useState<RepositoryCommand[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [cursorRaw, setCursorRaw] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [storageNote, setStorageNote] = useState<string | null>(null);

  const { steps } = useMemo(() => buildSteps(commands), [commands]);
  const last = steps.length - 1;
  const cursor = cursorRaw === null ? last : Math.min(cursorRaw, last);
  const replaying = cursor < last;

  // Load saved work once.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const saved = await storage.current.load();
        if (!alive) return;
        if (saved) {
          setCommands(buildSteps(saved.commands).valid);
          setCompleted(saved.completedChallenges);
        }
      } catch {
        storage.current = memoryStorage();
        setStorageNote("Your browser blocked local storage, so changes will last only until you close this tab.");
      }
      if (alive) setStatus("ready");
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Save after every change, once loaded.
  useEffect(() => {
    if (status !== "ready") return;
    let alive = true;
    const t = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await storage.current.save({ version: 1, commands, completedChallenges: completed, savedAt: Date.now() });
        if (alive) setSaveStatus("saved");
      } catch {
        if (alive) setSaveStatus("error");
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [commands, completed, status]);

  // The newest state, kept in a ref so several commands in one handler see each other's results.
  const latest = useRef(steps[last].state);
  useEffect(() => {
    latest.current = steps[last].state;
  }, [steps, last]);

  const run = useCallback(
    (cmd: RepositoryCommand) => {
      if (replaying) return "You're viewing an earlier step. Return to the latest step to make changes.";
      const r = apply(latest.current, cmd);
      if (!r.ok) return r.error;
      latest.current = r.state;
      setCommands((c) => {
        // Typing produces many edits to one file; keep them as a single step.
        const prev = c[c.length - 1];
        if (cmd.type === "EDIT_FILE" && prev?.type === "EDIT_FILE" && prev.path === cmd.path) return [...c.slice(0, -1), cmd];
        return [...c, cmd];
      });
      setCursorRaw(null);
      return null;
    },
    [replaying],
  );

  const undo = useCallback(() => {
    setCommands((c) => c.slice(0, -1));
    setCursorRaw(null);
  }, []);

  const reset = useCallback(async () => {
    setCommands([]);
    setCompleted([]);
    setCursorRaw(null);
    try {
      await storage.current.clear();
    } catch {}
  }, []);

  const setCursor = useCallback((i: number) => setCursorRaw(i >= last ? null : Math.max(0, i)), [last]);

  const complete = useCallback((id: string) => setCompleted((c) => (c.includes(id) ? c : [...c, id])), []);

  const value = useMemo<RepositoryContextValue>(
    () => ({
      status,
      state: steps[cursor].state,
      steps,
      cursor,
      replaying,
      setCursor,
      run,
      undo,
      reset,
      canUndo: commands.length > 0 && !replaying,
      saveStatus,
      storageNote,
      completed,
      complete,
    }),
    [status, steps, cursor, replaying, setCursor, run, undo, reset, commands.length, saveStatus, storageNote, completed, complete],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRepository() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRepository must be used inside <RepositoryProvider>");
  return ctx;
}
