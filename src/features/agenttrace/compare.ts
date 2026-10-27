// Reading two attempts at one task against each other.
//
// The comparison deliberately keeps two questions apart: did the attempts end up agreeing about
// the tests, and did they end up agreeing about the code. Those are different questions, and the
// interesting case is when the answers differ — two attempts can leave a green suite and leave
// genuinely different code behind, which no test result can tell you.

import type { TestStatus } from "@/features/testing/harness";
import { attempts, failed, replay, touchedPaths, type AgentEvent, type AgentSession } from "./events";

type Validation = Extract<AgentEvent, { kind: "validation" }>;

export type FileDifference = { path: string; a: string; b: string; same: boolean };

export type TestDifference = {
  key: string;
  path: string;
  name: string;
  /** The last result each attempt recorded for this test. null: it never ran there. */
  a: TestStatus | null;
  b: TestStatus | null;
  agree: boolean;
};

export type SessionComparison = {
  a: AgentSession;
  b: AgentSession;
  sameTask: boolean;
  sameBase: boolean;
  files: FileDifference[];
  tests: TestDifference[];
  /** Both attempts finished with every test they ran passing. */
  bothGreen: boolean;
  /** Both attempts left exactly the same code. */
  sameCode: boolean;
  counts: {
    edits: [number, number];
    reads: [number, number];
    attempts: [number, number];
    failedAttempts: [number, number];
  };
  /** How long each attempt ran, in milliseconds of recorded time. */
  elapsed: [number, number];
};

/** The last result each attempt recorded per test; a later run supersedes an earlier one. */
function finalResults(s: AgentSession) {
  const out = new Map<string, Validation>();
  for (const e of s.events) if (e.kind === "validation") out.set(`${e.path}#${e.test}`, e);
  return out;
}

const task = (s: AgentSession) => s.events.find((e) => e.kind === "session-start")?.task ?? "";
const count = (s: AgentSession, kind: AgentEvent["kind"]) => s.events.filter((e) => e.kind === kind).length;
const span = (s: AgentSession) => (s.events.length ? s.events[s.events.length - 1].at - s.events[0].at : 0);

export function compareSessions(baseFiles: Record<string, string>, a: AgentSession, b: AgentSession): SessionComparison {
  const headA = replay(baseFiles, a.events).head;
  const headB = replay(baseFiles, b.events).head;

  const paths = [...new Set([...touchedPaths(a.events), ...touchedPaths(b.events)])].sort();
  const files: FileDifference[] = paths.map((path) => {
    const left = headA[path] ?? "";
    const right = headB[path] ?? "";
    return { path, a: left, b: right, same: left === right };
  });

  const ra = finalResults(a);
  const rb = finalResults(b);
  const tests: TestDifference[] = [...new Set([...ra.keys(), ...rb.keys()])].sort().map((key) => {
    const left = ra.get(key) ?? null;
    const right = rb.get(key) ?? null;
    const source = left ?? right!;
    return {
      key,
      path: source.path,
      name: source.test,
      a: left?.status ?? null,
      b: right?.status ?? null,
      agree: (left?.status ?? null) === (right?.status ?? null),
    };
  });

  const green = (m: Map<string, Validation>) => m.size > 0 && [...m.values()].every((v) => v.status === "pass");
  const groupsA = attempts(a.events);
  const groupsB = attempts(b.events);

  return {
    a,
    b,
    sameTask: task(a) === task(b),
    sameBase: a.baseCommit === b.baseCommit,
    files,
    tests,
    bothGreen: green(ra) && green(rb),
    sameCode: files.every((f) => f.same),
    counts: {
      edits: [count(a, "edit"), count(b, "edit")],
      reads: [count(a, "read"), count(b, "read")],
      attempts: [groupsA.length, groupsB.length],
      failedAttempts: [groupsA.filter(failed).length, groupsB.filter(failed).length],
    },
    elapsed: [span(a), span(b)],
  };
}
