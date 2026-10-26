// ChangeVerse: run a change's tests at base and at head, then set what actually happened
// beside what the impact analysis predicted would happen.
//
// The whole point of this module is to keep two kinds of claim apart. A prediction comes from
// reading the code; an observation comes from running it. They are never merged into one score,
// and neither is allowed to stand in for the other: a prediction the tests did not reproduce is
// not a prediction disproved, and a suite that passes is not a change proved correct.
//
// Pure: the test runner is passed in, so the server can inject the node:vm one and tests can
// inject whatever they like without this file importing anything server-only.

import { blastRadius } from "@/features/impact-analysis/blast-radius";
import type { AnalysisResult, ChangeStatus } from "@/features/impact-analysis/types";
import type { TestOutcome } from "@/features/testing/harness";

export type TestRunner = (files: Record<string, string>, path: string, name: string) => TestOutcome;

/** How a test's base result compares with its head result. */
export type TestVerdict =
  /** Passed at base, fails at head. The only verdict that is evidence this change broke something. */
  | "newly-failing"
  /** Failed at base, passes at head. */
  | "newly-passing"
  | "still-passing"
  /** Failing before and after: broken already, not by this change. */
  | "still-failing"
  /** Did not exist at base. There is nothing to compare it against. */
  | "new-test"
  /** Existed at base, gone at head. */
  | "removed"
  /** The runner could not execute it, so it is not evidence either way. */
  | "unavailable";

export type TestComparison = {
  id: string;
  path: string;
  name: string;
  base: TestOutcome;
  head: TestOutcome;
  verdict: TestVerdict;
  /** Symbols this test calls directly, from the graph's `tests` edges. Not a coverage measure. */
  covers: string[];
};

export type SymbolVerdict =
  /** A test that reaches this symbol newly fails. */
  | "confirmed"
  /** Tests that reach it ran and still pass. The prediction was not reproduced — not disproved. */
  | "not-reproduced"
  /** No test that reaches it produced a usable result. No evidence either way. */
  | "unverified";

export type PredictedSymbol = {
  id: string;
  name: string;
  path: string;
  changeStatus: ChangeStatus;
  signatureChanged: boolean;
  /** What the analysis says may be affected, by hop distance along reverse call edges. */
  dependents: { id: string; name: string; path: string; distance: number }[];
  /** Ids of tests the graph links to this symbol or anything in its radius. */
  tests: string[];
  verdict: SymbolVerdict;
};

export type Preflight = {
  /** The analysis these predictions came from. If it no longer matches, this run is stale. */
  analysisVersion: string;
  base: string;
  head: string;
  ranAt: number;
  predicted: PredictedSymbol[];
  tests: TestComparison[];
  /** Tests that newly fail although no prediction pointed at them. */
  missedByForecast: string[];
  limitations: string[];
};

const MAX_DEPTH = 3;

/** A verdict that came from actually executing the test at both revisions. */
const RAN: TestVerdict[] = ["newly-failing", "newly-passing", "still-passing", "still-failing"];

function compare(base: TestOutcome, head: TestOutcome): TestVerdict {
  // An error is the runner failing, not the code failing, so it never counts as evidence.
  if (head.status === "error") return "unavailable";
  if (head.status === "missing") return "removed";
  if (base.status === "missing") return "new-test";
  if (base.status === "error") return "unavailable";
  if (base.status === "pass") return head.status === "pass" ? "still-passing" : "newly-failing";
  return head.status === "pass" ? "newly-passing" : "still-failing";
}

export function preflight(r: AnalysisResult, run: TestRunner): Preflight {
  // Observed: every test present at head, run against both revisions.
  const tests: TestComparison[] = r.nodes
    .filter((n) => n.kind === "test")
    .map((n) => {
      const head = run(r.headFiles, n.path, n.name);
      const base = run(r.baseFiles, n.path, n.name);
      return {
        id: n.id,
        path: n.path,
        name: n.name,
        base,
        head,
        verdict: compare(base, head),
        covers: r.edges.filter((e) => e.kind === "tests" && e.source === n.id).map((e) => e.target),
      };
    });
  const byTest = new Map(tests.map((t) => [t.id, t]));

  // Predicted: every symbol this change touched, and what the analysis says depends on it.
  const byId = new Map(r.nodes.map((n) => [n.id, n]));
  const predicted: PredictedSymbol[] = r.nodes
    .filter((n) => n.kind === "symbol" && n.changeStatus !== "unchanged")
    .map((n) => {
      const radius = blastRadius(r, n.id, MAX_DEPTH);
      const reaching = radius.tests.map((t) => t.id);
      const ran = reaching.map((id) => byTest.get(id)).filter((t) => t && RAN.includes(t.verdict));
      const verdict: SymbolVerdict = ran.some((t) => t!.verdict === "newly-failing")
        ? "confirmed"
        : ran.length
          ? "not-reproduced"
          : "unverified";
      return {
        id: n.id,
        name: n.name,
        path: n.path,
        changeStatus: n.changeStatus,
        signatureChanged: !!n.signatureChanged,
        dependents: [...radius.distance]
          .filter(([id, d]) => d > 0 && byId.has(id))
          .map(([id, d]) => ({ id, name: byId.get(id)!.name, path: byId.get(id)!.path, distance: d }))
          .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name)),
        tests: reaching,
        verdict,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name));

  // The cell that matters most: something broke that nothing in the forecast pointed at.
  const forecast = new Set(predicted.flatMap((p) => p.tests));
  const missedByForecast = tests.filter((t) => t.verdict === "newly-failing" && !forecast.has(t.id)).map((t) => t.id);

  return {
    analysisVersion: r.version,
    base: r.base,
    head: r.head,
    ranAt: Date.now(),
    predicted,
    tests,
    missedByForecast,
    limitations: [
      "Observations cover the tests in this repository and nothing else. A test that passes does not prove the change is correct.",
      "A symbol with no linked test is unverified, not safe: it only means no parsed test calls it directly.",
      "Predictions come from static analysis of relative imports and direct calls by name, so dynamic dispatch and re-exports are invisible to them.",
      "Tests run in a sandbox with a one second limit; anything the runner cannot execute is reported as unavailable rather than failing.",
    ],
  };
}
