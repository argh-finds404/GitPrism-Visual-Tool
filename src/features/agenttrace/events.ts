// AgentTrace: a versioned, append-only record of what a coding agent did.
//
// Only observable things are recorded: files it read, edits it wrote, commands it ran and the
// results those produced. A `note` is text the agent itself stated, never an inference about why
// it acted — nothing here claims access to a model's internal reasoning, because nothing exposes
// it. Any field that would need such access simply does not exist in this schema.
//
// The log is the source of truth. File contents at any point are derived by replaying the edits
// from the base revision, so the timeline and the diff can never disagree with each other.

import { diffLines, splitLines } from "@/lib/git";
import type { TestStatus } from "@/features/testing/harness";

/** Bump when the shape below changes. `replay` refuses a log it was not written to understand. */
export const SCHEMA_VERSION = 1;

type Base = { v: number; id: string; seq: number; at: number };

export type AgentEvent =
  | (Base & { kind: "session-start"; agent: string; task: string; baseCommit: string })
  | (Base & { kind: "read"; path: string; lines?: [number, number] })
  | (Base & { kind: "edit"; path: string; content: string; summary: string })
  | (Base & { kind: "command"; command: string; exitCode: number; summary: string })
  | (Base & { kind: "validation"; test: string; path: string; status: TestStatus; detail: string; ms: number })
  | (Base & { kind: "note"; text: string })
  | (Base & { kind: "session-end"; outcome: "completed" | "abandoned"; headCommit: string | null });

export type EventKind = AgentEvent["kind"];

/** Omit that distributes over the union, so each variant keeps its own fields. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An event as a caller writes it; the recorder stamps version, id, sequence and time. */
export type NewEvent = DistributiveOmit<AgentEvent, "v" | "id" | "seq" | "at">;

export type AgentSession = {
  v: number;
  id: string;
  /** How this attempt is named when it sits beside another. */
  title: string;
  /** Shown wherever the session is: this is a reconstruction, not a recording of a live agent. */
  label: string;
  repo: { owner: string; repo: string };
  baseCommit: string;
  headCommit: string | null;
  events: AgentEvent[];
};

export class UnsupportedLog extends Error {}

export type Provenance = {
  /** File contents once every event has been applied. */
  head: Record<string, string>;
  /** Contents after each event; index 0 is the base, before anything ran. */
  snapshots: Record<string, string>[];
  /** path → 1-based head line → id of the event that introduced it. null means it came from base. */
  addedBy: Record<string, (string | null)[]>;
  /** path → 1-based base line → id of the event that removed it. */
  removedBy: Record<string, Record<number, string>>;
};

/**
 * Rebuild every intermediate file state from the base revision plus the log, recording which
 * event is responsible for each surviving line and each removed one. Pure and read-only: replay
 * never re-executes a command, it only re-applies edits that were already recorded.
 */
export function replay(baseFiles: Record<string, string>, events: AgentEvent[]): Provenance {
  for (const e of events) {
    if (e.v !== SCHEMA_VERSION) throw new UnsupportedLog(`Event ${e.id} uses schema v${e.v}; this build reads v${SCHEMA_VERSION}.`);
  }

  const files: Record<string, string> = { ...baseFiles };
  // Which base line each current line descends from, and which event put it there.
  const origin: Record<string, (number | null)[]> = {};
  const owner: Record<string, (string | null)[]> = {};
  for (const [path, src] of Object.entries(baseFiles)) {
    const n = splitLines(src).length;
    origin[path] = Array.from({ length: n }, (_, i) => i + 1);
    owner[path] = Array.from({ length: n }, () => null);
  }

  const removedBy: Record<string, Record<number, string>> = {};
  const snapshots: Record<string, string>[] = [{ ...files }];

  for (const e of events) {
    if (e.kind === "edit") {
      const prev = files[e.path] ?? "";
      const prevOrigin = origin[e.path] ?? [];
      const prevOwner = owner[e.path] ?? [];
      const nextOrigin: (number | null)[] = [];
      const nextOwner: (string | null)[] = [];

      for (const line of diffLines(prev, e.content)) {
        if (line.kind === "same") {
          nextOrigin.push(prevOrigin[line.a - 1] ?? null);
          nextOwner.push(prevOwner[line.a - 1] ?? null);
        } else if (line.kind === "add") {
          nextOrigin.push(null);
          nextOwner.push(e.id);
        } else {
          // A line leaving the file: if it came from the base revision, this event removed it.
          const from = prevOrigin[line.a - 1];
          if (from != null) (removedBy[e.path] ??= {})[from] = e.id;
        }
      }

      files[e.path] = e.content;
      origin[e.path] = nextOrigin;
      owner[e.path] = nextOwner;
    }
    snapshots.push({ ...files });
  }

  return { head: files, snapshots, addedBy: owner, removedBy };
}

/** Paths the session edited, in the order they were first touched. */
export function touchedPaths(events: AgentEvent[]) {
  const seen: string[] = [];
  for (const e of events) if (e.kind === "edit" && !seen.includes(e.path)) seen.push(e.path);
  return seen;
}

/**
 * Validation runs grouped into attempts, so a failure and the work that followed it read as one
 * story rather than a flat list. An attempt is every validation event between two edits.
 */
export type Attempt = { index: number; afterEvent: string | null; results: Extract<AgentEvent, { kind: "validation" }>[] };

export function attempts(events: AgentEvent[]): Attempt[] {
  const out: Attempt[] = [];
  let lastEdit: string | null = null;
  for (const e of events) {
    if (e.kind === "edit") lastEdit = e.id;
    if (e.kind !== "validation") continue;
    const open = out.at(-1);
    if (open && open.afterEvent === lastEdit) open.results.push(e);
    else out.push({ index: out.length, afterEvent: lastEdit, results: [e] });
  }
  return out;
}

export const failed = (a: Attempt) => a.results.some((r) => r.status === "fail" || r.status === "error");
