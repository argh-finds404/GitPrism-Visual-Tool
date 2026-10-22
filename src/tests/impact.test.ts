import { describe, expect, it } from "vitest";
import { analyze, symbolId, fileId } from "@/features/impact-analysis/analysis-service";
import { stronglyConnected } from "@/features/impact-analysis/architecture-rules";
import { blastRadius, pathToCenter } from "@/features/impact-analysis/blast-radius";
import { buildPack, defaultItems, redactSecrets } from "@/features/impact-analysis/context-packager";
import { parseCommand } from "@/features/impact-analysis/commands";
import { FIXTURE, fixtureHistory, LAYER_CONFIG } from "@/features/impact-analysis/fixture";
import { hashCommit } from "@/lib/git";

const h = fixtureHistory();
const head = h.commits.at(-1)!;
const r = analyze(h.base.files, head.files, { base: h.base.oid, head: head.oid, ...LAYER_CONFIG });
const node = (id: string) => r.nodes.find((n) => n.id === id)!;

describe("fixture history", () => {
  it("has four PR commits with real, chained commit IDs", () => {
    expect(h.commits.map((c) => c.message)).toEqual([
      "Cache validated sessions",
      "Rotate tokens on refresh",
      "Pass options to validateSession in auth guard",
      "Remove legacy login",
    ]);
    expect(new Set([h.base.oid, ...h.commits.map((c) => c.oid)]).size).toBe(5);
    expect(h.base.oid).toMatch(/^[0-9a-f]{40}$/);
  });
  it("is deterministic", () => expect(fixtureHistory().base.oid).toBe(h.base.oid));
  void hashCommit;
  void FIXTURE;
});

describe("diff and symbols", () => {
  it("classifies file changes", () => {
    const s = Object.fromEntries(r.changes.map((c) => [c.path, c.status]));
    expect(s["src/infra/cache.ts"]).toBe("added");
    expect(s["src/auth/legacy.ts"]).toBe("deleted");
    expect(s["src/auth/session.ts"]).toBe("modified");
    expect(s["src/orders/pricing.ts"]).toBeUndefined();
  });
  it("detects the changed signature of validateSession", () => {
    const v = node(symbolId("src/auth/session.ts", "validateSession"));
    expect(v.changeStatus).toBe("modified");
    expect(v.signatureChanged).toBe(true);
    expect(v.baseParams).toBe("token: string, now: number");
    expect(node(symbolId("src/auth/session.ts", "createSession")).changeStatus).toBe("unchanged");
    expect(node(symbolId("src/auth/tokens.ts", "rotateToken")).changeStatus).toBe("added");
    expect(node(symbolId("src/auth/legacy.ts", "legacyLogin")).changeStatus).toBe("deleted");
  });
});

describe("relationships", () => {
  it("only creates edges that exist in source", () => {
    for (const e of r.edges) {
      const line = r.headFiles[e.location.path].split("\n")[e.location.line - 1];
      expect(line.trim()).toBe(e.location.text);
    }
  });
  it("finds callers of validateSession", () => {
    const callers = r.edges.filter((e) => e.kind === "calls" && e.target === symbolId("src/auth/session.ts", "validateSession")).map((e) => e.source);
    expect(callers.sort()).toEqual(
      [symbolId("src/api/middleware/auth-guard.ts", "authGuard"), symbolId("src/auth/auth.service.ts", "requireUser"), symbolId("src/auth/session.ts", "refreshSession")].sort(),
    );
  });
});

describe("findings", () => {
  it("flags the caller that kept the old call shape, not the ones updated", () => {
    const stale = r.findings.filter((f) => f.id.startsWith("stale-call:"));
    expect(stale.map((f) => f.locations[0].path)).toEqual(["src/auth/auth.service.ts"]);
  });
  it("reports the domain → infrastructure import and the session/tokens cycle", () => {
    expect(r.violations.map((v) => [v.from, v.to, v.ruleId])).toEqual([[fileId("src/auth/session.ts"), fileId("src/infra/cache.ts"), "pure-domain"]]);
    expect(r.cycles.map((c) => [...c].sort())).toEqual([[fileId("src/auth/session.ts"), fileId("src/auth/tokens.ts")].sort()]);
  });
  it("marks untested changes as hypotheses", () => {
    const f = r.findings.find((x) => x.id === `untested:${symbolId("src/auth/tokens.ts", "rotateToken")}`);
    expect(f?.kind).toBe("hypothesis");
  });
});

describe("blast radius", () => {
  it("measures distance along reverse calls", () => {
    const rad = blastRadius(r, symbolId("src/auth/session.ts", "validateSession"), 4);
    expect(rad.distance.get(symbolId("src/auth/auth.service.ts", "requireUser"))).toBe(1);
    expect(rad.distance.get(symbolId("src/api/routes/orders.ts", "listOrders"))).toBe(2);
    expect(pathToCenter(rad, symbolId("src/api/routes/orders.ts", "listOrders"))).toHaveLength(2);
    expect(rad.tests.length).toBeGreaterThan(0);
  });
  it("respects depth", () => {
    const rad = blastRadius(r, symbolId("src/auth/session.ts", "validateSession"), 1);
    expect(Math.max(...rad.distance.values())).toBe(1);
  });
});

describe("tarjan", () => {
  it("finds cycles and ignores acyclic graphs", () => {
    expect(stronglyConnected(["a", "b", "c"], [["a", "b"], ["b", "c"]])).toEqual([]);
    expect(stronglyConnected(["a", "b", "c"], [["a", "b"], ["b", "a"], ["b", "c"]]).map((c) => c.sort())).toEqual([["a", "b"]]);
  });
});

describe("context pack", () => {
  it("never includes secret files and redacts secrets", () => {
    const p = buildPack(r, defaultItems(r), 32000, "PR #42");
    expect(p.excluded.map((e) => e.path)).toContain(".env");
    expect(p.markdown).not.toContain("SESSION_SECRET");
    // Assembled at runtime so the source never contains a key-shaped literal.
    const sample = ["sk", "test", "0".repeat(24)].join("_");
    expect(redactSecrets(`const k = "${sample}"`)).toEqual({ text: 'const k = "[REDACTED]"', count: 1 });
  });
  it("summarizes lower-priority code under a tight budget instead of dropping changed code", () => {
    const big = buildPack(r, defaultItems(r), 32000, "x");
    // The diff is always kept; related code shrinks to signatures as the budget tightens.
    const small = buildPack(r, defaultItems(r), big.estimatedTokens - 300, "x");
    expect(small.estimatedTokens).toBeLessThan(big.estimatedTokens);
    expect(small.included.some((i) => i.mode === "signature")).toBe(true);
    expect(small.markdown).toContain("## Diff");
  });
});

describe("command bar", () => {
  it("resolves supported commands and explains unsupported ones", () => {
    const c = parseCommand("Show direct callers of validateSession", r);
    expect(c.ok && c.action.type).toBe("callers");
    expect(parseCommand("deploy to production", r).ok).toBe(false);
    expect(parseCommand("Focus on circular dependencies", r).ok).toBe(true);
  });
});
