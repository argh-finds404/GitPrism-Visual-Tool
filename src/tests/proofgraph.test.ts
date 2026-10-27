import { describe, expect, it } from "vitest";
import { analyze } from "@/features/impact-analysis/analysis-service";
import { LAYER_CONFIG } from "@/features/impact-analysis/fixture";
import { runFixtureTest } from "@/features/timefold/test-runner";
import { candidates, resolveCandidate } from "@/features/changeverse/candidates";
import { collectEvidence, evaluate, type TestRunner } from "@/features/proofgraph/evidence";
import type { TestOutcome } from "@/features/testing/harness";

function build(label: string, run: TestRunner = runFixtureTest) {
  const c = candidates().find((x) => x.label.startsWith(label))!;
  const r = resolveCandidate(c.id)!;
  const analysis = analyze(r.baseFiles, r.headFiles, { base: c.base, head: c.head, ...LAYER_CONFIG });
  return { candidate: c, graph: collectEvidence(analysis, run) };
}

const always = (o: Partial<TestOutcome>): TestRunner => () => ({ status: "pass", detail: "", ms: 0, ...o });

describe("evidence for the pull request", () => {
  const { candidate, graph } = build("Pull request");
  const ev = evaluate(graph, candidate.head);
  const symbol = (name: string) => ev.symbols.find((s) => s.name === name)!;

  it("rates every changed symbol as exactly one state", () => {
    expect(ev.counts).toEqual({ verified: 1, inferred: 2, missing: 5, stale: 0 });
    expect(ev.symbols).toHaveLength(8);
    expect(ev.stale).toBe(false);
  });

  it("verifies a symbol a test calls directly", () => {
    const vs = symbol("validateSession");
    expect(vs.state).toBe("verified");
    expect(vs.links[0].direct).toBe(true);
    expect(vs.links[0].distance).toBe(0);
    expect(vs.links[0].result.status).toBe("pass");
  });

  it("only infers a symbol reached through other code", () => {
    const cache = symbol("cacheGet");
    expect(cache.state).toBe("inferred");
    expect(cache.links.every((l) => !l.direct)).toBe(true);
    expect(cache.links[0].distance).toBeGreaterThan(0);
  });

  it("records a symbol nothing reaches as missing, with no links to show", () => {
    const guard = symbol("authGuard");
    expect(guard.state).toBe("missing");
    expect(guard.links).toEqual([]);
  });

  it("keeps every result tied to the revision it came from", () => {
    const links = ev.symbols.flatMap((s) => s.links);
    expect(links.length).toBeGreaterThan(0);
    expect(links.every((l) => l.result.revision === candidate.head)).toBe(true);
    expect(graph.revision).toBe(candidate.head);
  });

  it("says plainly that a missing link is not proof of an untested symbol", () => {
    expect(graph.limitations.join(" ")).toMatch(/not a claim that the symbol is untested/i);
    expect(graph.limitations.join(" ")).toMatch(/nothing here is combined into a score/i);
  });
});

describe("what verified does and does not mean", () => {
  it("verifies the link, not the correctness: a direct test that fails still verifies", () => {
    const { candidate, graph } = build("Pull request", always({ status: "fail", detail: "boom" }));
    const ev = evaluate(graph, candidate.head);
    const vs = ev.symbols.find((s) => s.name === "validateSession")!;
    expect(vs.state).toBe("verified");
    expect(vs.links[0].result.status).toBe("fail");
  });

  it("will not verify from a test the runner could not execute", () => {
    const { candidate, graph } = build("Pull request", always({ status: "error", detail: "timed out" }));
    const ev = evaluate(graph, candidate.head);
    expect(ev.counts.verified).toBe(0);
    const vs = ev.symbols.find((s) => s.name === "validateSession")!;
    expect(vs.state).toBe("inferred");
  });

  it("treats an absent test as missing rather than as a pass", () => {
    const { candidate, graph } = build("Pull request", always({ status: "missing", detail: "not found" }));
    const ev = evaluate(graph, candidate.head);
    expect(ev.counts.verified).toBe(0);
    expect(ev.counts.missing).toBe(5);
  });
});

describe("staleness", () => {
  const { candidate, graph } = build("Extract the discount rate");

  it("rates evidence against the revision being read, not the one it was collected at", () => {
    const here = evaluate(graph, candidate.head);
    expect(here.stale).toBe(false);
    expect(here.counts.stale).toBe(0);

    const elsewhere = evaluate(graph, candidate.base);
    expect(elsewhere.stale).toBe(true);
    expect(elsewhere.counts.stale).toBe(1);
    expect(elsewhere.counts.verified + elsewhere.counts.inferred).toBe(0);
  });

  it("never lets stale evidence keep a verified rating", () => {
    const pr = build("Pull request");
    const elsewhere = evaluate(pr.graph, "0".repeat(40));
    expect(elsewhere.counts.verified).toBe(0);
    expect(elsewhere.counts.inferred).toBe(0);
    // Symbols nothing reached stay missing: there was never any evidence to go stale.
    expect(elsewhere.counts.missing).toBe(5);
    expect(elsewhere.counts.stale).toBe(3);
  });
});

describe("a failing test that only reaches its symbol indirectly", () => {
  it("is still inferred, and still carries the failure", () => {
    const { candidate, graph } = build("Extract the discount rate");
    const ev = evaluate(graph, candidate.head);
    const ad = ev.symbols.find((s) => s.name === "applyDiscount")!;
    // The test calls priceCart, not applyDiscount, so the connection is a deduction...
    expect(ad.state).toBe("inferred");
    expect(ad.links[0].direct).toBe(false);
    // ...but the result it carries is a real failure, which inferred must not hide.
    expect(ad.links[0].result.status).toBe("fail");
    expect(ad.links[0].result.detail).toContain("Expected 180");
  });
});
