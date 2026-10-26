// The bundled AgentTrace sessions: two attempts at the same task.
//
// These are reconstructions, labelled as such everywhere they appear. No coding agent was recorded
// to produce them, and nothing is captured from the person using GitPrism. What is real: every
// file state is fixture repository content, the base is a genuine commit, and every test result is
// produced by actually executing the code at that point in the session — including the wrong
// attempt in session A, which really does fail when run.
//
// The two attempts are deliberately chosen to end the same way and leave different code, because
// that is the case test results alone cannot tell apart.

import { fixtureHistory, FIXTURE } from "@/features/impact-analysis/fixture";
import { isSource, parseFile } from "@/features/impact-analysis/source-analysis";
import type { TestOutcome } from "@/features/testing/harness";
import { SCHEMA_VERSION, type AgentEvent, type AgentSession, type NewEvent } from "./events";

export type TestRunner = (files: Record<string, string>, path: string, name: string) => TestOutcome;

const PATH = "src/orders/pricing.ts";
const AGENT = "A coding agent";
const TASK = "tests/pricing.test.ts is failing on main. Find the cause and fix it.";

/** Every test case in a file set, found the same way the analyser finds them. */
function testsIn(files: Record<string, string>) {
  const set = new Set(Object.keys(files));
  const out: { path: string; name: string }[] = [];
  for (const [path, src] of Object.entries(files)) {
    if (!isSource(path) || !path.includes(".test.")) continue;
    for (const t of parseFile(path, src, set).tests) out.push({ path, name: t.name });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name));
}

/** Stamps version, id, sequence and time onto events as they are recorded. */
function recorder(sessionId: string, startMs: number, run: TestRunner) {
  const events: AgentEvent[] = [];
  let seq = 0;
  let at = startMs;

  const push = (e: NewEvent, gapMs = 1500) => {
    at += gapMs;
    events.push({ ...e, v: SCHEMA_VERSION, id: `${sessionId}-e${seq + 1}`, seq: seq++, at });
  };

  /** Run the suite against a file state and record the command plus every result it produced. */
  const runSuite = (files: Record<string, string>) => {
    const results = testsIn(files).map((t) => ({ ...t, outcome: run(files, t.path, t.name) }));
    const broke = results.filter((r) => r.outcome.status !== "pass");
    // The exit code is derived from what actually happened, never asserted ahead of it.
    push({
      kind: "command",
      command: "npm test",
      exitCode: broke.length ? 1 : 0,
      summary: broke.length ? `${broke.length} of ${results.length} tests failed` : `${results.length} tests passed`,
    });
    for (const r of results)
      push({ kind: "validation", test: r.name, path: r.path, status: r.outcome.status, detail: r.outcome.detail, ms: r.outcome.ms }, 120);
  };

  return { events, push, runSuite };
}

function endpoints() {
  const h = fixtureHistory();
  return {
    base: h.main.find((c) => c.message === "Add local environment template")!,
    head: h.main.find((c) => c.message === "Fix large-cart discount")!,
  };
}

/**
 * Attempt A — reaches the fix the repository actually took, after one wrong turn.
 * Its final tree is exactly the "Fix large-cart discount" commit.
 */
function attemptA(run: TestRunner): AgentSession {
  const { base, head } = endpoints();
  const id = "a-threshold-then-rate";
  const { events, push, runSuite } = recorder(id, base.timestamp * 1000, run);

  const brokenSrc = base.files[PATH];
  // A plausible wrong diagnosis: blame the threshold rather than the rate.
  const wrongSrc = brokenSrc.replace("total > 100 ?", "total > 1000 ?");
  const fixedSrc = head.files[PATH];

  push({ kind: "session-start", agent: AGENT, task: TASK, baseCommit: base.oid });
  runSuite(base.files);
  push({ kind: "read", path: "tests/pricing.test.ts" });
  push({ kind: "read", path: PATH });
  push({
    kind: "note",
    text: "priceCart calls applyDiscount, which multiplies a large total by DISCOUNT_RATE. The constant is 0.1, so a £200 cart becomes £20 instead of £180.",
  });

  push({ kind: "edit", path: PATH, content: wrongSrc, summary: "Raise the large-cart threshold to 1000" });
  runSuite({ ...base.files, [PATH]: wrongSrc });
  push({
    kind: "note",
    text: "Still failing, and now the cart is not discounted at all. The threshold was never the problem; the rate is being applied as a multiplier.",
  });

  push({ kind: "edit", path: PATH, content: fixedSrc, summary: "Apply the discount as a 0.9 multiplier and drop the constant" });
  runSuite(head.files);
  push({ kind: "session-end", outcome: "completed", headCommit: head.oid });

  return {
    v: SCHEMA_VERSION,
    id,
    title: "Attempt A — drop the constant",
    label: "Reconstructed session — not a recording",
    repo: { owner: FIXTURE.owner, repo: FIXTURE.repo },
    baseCommit: base.oid,
    headCommit: head.oid,
    events,
  };
}

/**
 * Attempt B — keeps the extracted constant and corrects its value instead. Reaches a green suite
 * in fewer steps, and leaves different code behind. Nothing committed it, so it has no head commit.
 */
function attemptB(run: TestRunner): AgentSession {
  const { base } = endpoints();
  const id = "b-keep-constant";
  const { events, push, runSuite } = recorder(id, base.timestamp * 1000 + 7200_000, run);

  const keptSrc = base.files[PATH].replace("const DISCOUNT_RATE = 0.1;", "const DISCOUNT_RATE = 0.9;");

  push({ kind: "session-start", agent: AGENT, task: TASK, baseCommit: base.oid });
  runSuite(base.files);
  push({ kind: "read", path: PATH });
  push({
    kind: "note",
    text: "DISCOUNT_RATE is named for a rate but holds the discount taken off, and applyDiscount uses it as the multiplier. Correcting the constant keeps the extraction.",
  });

  push({ kind: "edit", path: PATH, content: keptSrc, summary: "Set DISCOUNT_RATE to the multiplier it is used as" });
  runSuite({ ...base.files, [PATH]: keptSrc });
  push({ kind: "session-end", outcome: "completed", headCommit: null });

  return {
    v: SCHEMA_VERSION,
    id,
    title: "Attempt B — keep the constant",
    label: "Reconstructed session — not a recording",
    repo: { owner: FIXTURE.owner, repo: FIXTURE.repo },
    baseCommit: base.oid,
    headCommit: null,
    events,
  };
}

let cached: AgentSession[] | null = null;

/**
 * Built once per process. A recorded session is a fixed artefact: re-running it per request would
 * make the measured durations drift, and a log that changes when nothing changed is not a record.
 */
export function fixtureSessions(run: TestRunner): AgentSession[] {
  return (cached ??= [attemptA(run), attemptB(run)]);
}

/** The file set both sessions start from. */
export function sessionBaseFiles() {
  return endpoints().base.files;
}
