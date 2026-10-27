import { describe, expect, it } from "vitest";
import { analyze } from "@/features/impact-analysis/analysis-service";
import { LAYER_CONFIG } from "@/features/impact-analysis/fixture";
import { runFixtureTest } from "@/features/timefold/test-runner";
import { candidates, resolveCandidate } from "@/features/changeverse/candidates";
import { preflight, type TestRunner } from "@/features/changeverse/preflight";
import type { TestOutcome } from "@/features/testing/harness";

/** Analyse and preflight a candidate by the label the picker shows. */
function runCandidate(label: string, run: TestRunner = runFixtureTest) {
  const c = candidates().find((x) => x.label === label || x.label.startsWith(label));
  if (!c) throw new Error(`No candidate matching "${label}"`);
  const resolved = resolveCandidate(c.id)!;
  const analysis = analyze(resolved.baseFiles, resolved.headFiles, { base: c.base, head: c.head, ...LAYER_CONFIG });
  return { candidate: c, analysis, result: preflight(analysis, run) };
}

describe("candidates", () => {
  it("offers the pull request plus every commit that has a parent", () => {
    const list = candidates();
    expect(list[0].kind).toBe("pull");
    expect(list.filter((c) => c.kind === "commit").length).toBeGreaterThan(5);
    expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
  });

  it("refuses an id that is not part of the fixture", () => {
    expect(resolveCandidate("not-a-commit")).toBeNull();
    expect(resolveCandidate("")).toBeNull();
  });

  it("resolves a candidate to two different file sets", () => {
    const r = resolveCandidate("pull")!;
    expect(r.baseFiles).not.toBe(r.headFiles);
    expect(Object.keys(r.headFiles).length).toBeGreaterThan(0);
  });
});

describe("preflight on the pull request", () => {
  const { result } = runCandidate("Pull request");

  it("records which revisions it ran against", () => {
    expect(result.base).toMatch(/^[0-9a-f]{40}$/);
    expect(result.head).toMatch(/^[0-9a-f]{40}$/);
    expect(result.base).not.toBe(result.head);
    expect(result.analysisVersion).toHaveLength(12);
  });

  it("runs every test and finds none broken", () => {
    expect(result.tests.length).toBeGreaterThan(0);
    expect(result.tests.every((t) => t.verdict === "still-passing")).toBe(true);
    expect(result.missedByForecast).toEqual([]);
  });

  it("still reports changed symbols no test reaches as unverified, not safe", () => {
    // This is the product's whole point: a green suite is not a safe change.
    const unverified = result.predicted.filter((s) => s.verdict === "unverified");
    expect(unverified.length).toBeGreaterThan(0);
    expect(unverified.every((s) => s.tests.length === 0)).toBe(true);
  });

  it("predicts a wide blast radius for the signature that changed", () => {
    const vs = result.predicted.find((s) => s.name === "validateSession")!;
    expect(vs.signatureChanged).toBe(true);
    expect(vs.dependents.length).toBeGreaterThanOrEqual(5);
    // A test reaches it and passes, so the prediction was not reproduced — not disproved.
    expect(vs.verdict).toBe("not-reproduced");
  });

  it("never claims a prediction was confirmed without a newly failing test", () => {
    for (const s of result.predicted) {
      if (s.verdict !== "confirmed") continue;
      const reaching = result.tests.filter((t) => s.tests.includes(t.id));
      expect(reaching.some((t) => t.verdict === "newly-failing")).toBe(true);
    }
  });
});

describe("preflight on a commit that breaks a test", () => {
  // Main's history contains a deliberate regression and the commit that repairs it.
  const broken = runCandidate("Extract the discount rate").result;
  const fixed = runCandidate("Fix large-cart discount").result;

  it("observes the regression by running the test at both revisions", () => {
    const failing = broken.tests.filter((t) => t.verdict === "newly-failing");
    expect(failing).toHaveLength(1);
    expect(failing[0].base.status).toBe("pass");
    expect(failing[0].head.status).toBe("fail");
    expect(failing[0].head.detail).toContain("Expected 180");
  });

  it("confirms the prediction for the symbol the failing test reaches", () => {
    const confirmed = broken.predicted.filter((s) => s.verdict === "confirmed");
    expect(confirmed.map((s) => s.name)).toContain("applyDiscount");
  });

  it("reports the repair as newly passing", () => {
    expect(fixed.tests.some((t) => t.verdict === "newly-passing")).toBe(true);
    expect(fixed.tests.some((t) => t.verdict === "newly-failing")).toBe(false);
  });
});

describe("evidence rules", () => {
  const outcome = (status: TestOutcome["status"], detail = ""): TestOutcome => ({ status, detail, ms: 0 });

  /** A runner that answers differently for the head file set than for the base one. */
  const runner = (head: TestOutcome, base: TestOutcome): TestRunner => {
    let first = true; // preflight asks for head before base
    return () => {
      const r = first ? head : base;
      first = !first;
      return r;
    };
  };

  it("treats a runner error as unavailable rather than a failure", () => {
    const { result } = runCandidate("Pull request", runner(outcome("error", "Timed out"), outcome("pass")));
    expect(result.tests.every((t) => t.verdict === "unavailable")).toBe(true);
    // An unavailable test is not evidence, so nothing may be confirmed by it.
    expect(result.predicted.every((s) => s.verdict !== "confirmed")).toBe(true);
    expect(result.missedByForecast).toEqual([]);
  });

  it("does not let an unavailable test count as a passing one", () => {
    const { result } = runCandidate("Pull request", runner(outcome("error"), outcome("pass")));
    expect(result.predicted.every((s) => s.verdict !== "not-reproduced")).toBe(true);
    expect(result.predicted.every((s) => s.verdict === "unverified")).toBe(true);
  });

  it("calls a test that did not exist at base a new test, not a pass", () => {
    const { result } = runCandidate("Pull request", runner(outcome("pass"), outcome("missing")));
    expect(result.tests.every((t) => t.verdict === "new-test")).toBe(true);
    // A new test has no base to compare against, so it is not evidence about this change.
    expect(result.predicted.every((s) => s.verdict === "unverified")).toBe(true);
  });

  it("flags a newly failing test that no prediction pointed at", () => {
    // Every test fails at head; the pull request does not touch pricing, so its test is
    // outside every predicted radius and must surface as missed by the forecast.
    const { result } = runCandidate("Pull request", runner(outcome("fail", "boom"), outcome("pass")));
    expect(result.missedByForecast.length).toBeGreaterThan(0);
    const missed = result.tests.filter((t) => result.missedByForecast.includes(t.id));
    expect(missed.every((t) => t.verdict === "newly-failing")).toBe(true);
    expect(missed.some((t) => t.path.includes("pricing"))).toBe(true);
  });

  it("always states what the run does not cover", () => {
    const { result } = runCandidate("Pull request");
    expect(result.limitations.length).toBeGreaterThanOrEqual(3);
    expect(result.limitations.join(" ")).toMatch(/does not prove/i);
  });
});
