import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { symbolId } from "@/features/impact-analysis/analysis-service";
import { fixtureHistory } from "@/features/impact-analysis/fixture";
import { allTests, commitStory, fixtureTimeline, functionDna, lineages } from "@/features/timefold/history";
import { nextProbe, recordProbe, startBisect, type BisectState } from "@/features/timefold/bisect";
import { runFixtureTest, type TestOutcome } from "@/features/timefold/test-runner";

const fx = fixtureHistory();
const h = fixtureTimeline();
const at = (message: string) => fx.all.findIndex((c) => c.message === message);
const PRICING = ["tests/pricing.test.ts", "discounts large carts"] as const;

describe("fixture history", () => {
  it("is main's 13 commits then the PR's 4, as one first-parent chain", () => {
    expect(fx.main).toHaveLength(13);
    expect(fx.all).toHaveLength(17);
    expect(fx.base.oid).toBe(fx.main.at(-1)!.oid);
    fx.all.forEach((c, i) => expect(c.parents).toEqual(i === 0 ? [] : [fx.all[i - 1].oid]));
    expect(new Set(fx.all.map((c) => c.lane))).toEqual(new Set(["main", "feat/auth"]));
  });

  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
  const gitAvailable = (() => {
    try {
      execFileSync("git", ["--version"]);
      return true;
    } catch {
      return false;
    }
  })();

  it.runIf(gitAvailable)("has the same commit IDs as real git", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitprism-timefold-"));
    dirs.push(dir);
    const git = (args: string[], env: Record<string, string> = {}, input?: string) =>
      execFileSync("git", ["-c", "core.autocrlf=false", ...args], { cwd: dir, env: { ...process.env, ...env }, input }).toString().trim();
    git(["init", "-q"]);
    for (const c of fx.all) {
      for (const entry of readdirSync(dir)) if (entry !== ".git") rmSync(join(dir, entry), { recursive: true, force: true });
      for (const [path, content] of Object.entries(c.files)) {
        mkdirSync(join(dir, dirname(path)), { recursive: true });
        writeFileSync(join(dir, path), content);
      }
      git(["add", "-A"]);
      const tree = git(["write-tree"]);
      const when = `${c.timestamp} +0000`;
      const who = { GIT_AUTHOR_NAME: "Ada Prism", GIT_AUTHOR_EMAIL: "ada@gitprism.dev", GIT_COMMITTER_NAME: "Ada Prism", GIT_COMMITTER_EMAIL: "ada@gitprism.dev" };
      const oid = git(["commit-tree", tree, ...c.parents.flatMap((p) => ["-p", p])], { ...who, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when }, `${c.message}\n`);
      expect(oid).toBe(c.oid);
    }
  }, 120_000);
});

describe("snapshots and lineage", () => {
  const session = (name: string) => symbolId("src/auth/session.ts", name);

  it("links the checkSession → validateSession rename by identical body", () => {
    const rename = h.snapshots[at("Rename checkSession to validateSession")].renames.get(session("validateSession"));
    expect(rename).toEqual({ from: session("checkSession"), kind: "renamed", evidence: "identical parameters and body" });
    expect(h.lineageOf.get(session("validateSession"))).toBe(session("checkSession"));
  });

  it("does not link symbols whose bodies differ", () => {
    // validateSession's body changes in "Expire sessions after an hour", but it keeps its ID, so no rename is claimed there.
    expect(h.snapshots[at("Expire sessions after an hour")].renames.size).toBe(0);
  });

  it("records validateSession's DNA from parse and diff evidence", () => {
    const dna = functionDna(h, session("checkSession"));
    const kinds = (m: string) => dna[at(m)].events.map((e) => e.kind);
    expect(dna.slice(0, at("Add sessions")).every((e) => e.id === null)).toBe(true);
    expect(kinds("Add sessions")).toEqual(["created", "calls"]);
    expect(dna[at("Add sessions")].events[1].text).toBe("Now calls verifyToken (tokens.ts)");
    expect(kinds("Rename checkSession to validateSession")).toEqual(["renamed"]);
    expect(dna[at("Expire sessions after an hour")].events.map((e) => e.text)).toContain("Signature (token: string) → (token: string, now: number)");
    expect(kinds("Expire sessions after an hour")).toEqual(expect.arrayContaining(["signature", "body", "callers", "tests"]));
    expect(kinds("Add auth service, guard and account route")).toEqual(["callers"]);
    expect(kinds("Cache validated sessions")).toEqual(expect.arrayContaining(["signature", "body", "calls"]));
    expect(kinds("Add order routes")).toEqual([]);
  });

  it("lists each lineage once under its latest name", () => {
    const names = lineages(h).map((l) => l.name);
    expect(names).toContain("validateSession");
    expect(names).not.toContain("checkSession");
    expect(names.filter((n) => n === "validateSession")).toHaveLength(1);
  });

  it("tells the story of a commit from its diff", () => {
    const rename = commitStory(h, at("Rename checkSession to validateSession"));
    expect(rename.symbols.added).toEqual([]);
    expect(rename.symbols.deleted).toEqual([]);
    expect(rename.symbols.renamed.map((r) => r.id)).toEqual([session("validateSession")]);

    const legacy = commitStory(h, at("Remove legacy login"));
    expect(legacy.files.find((f) => f.path === "src/auth/legacy.ts")?.status).toBe("deleted");
    expect(legacy.edges.removed.some((e) => e.target === "file:src/auth/legacy.ts")).toBe(true);
  });

  it("finds every test that ever existed", () => {
    expect(allTests(h).map((t) => t.id)).toEqual(
      expect.arrayContaining(["tests/pricing.test.ts#discounts large carts", "tests/session.test.ts#rejects an unsigned token"]),
    );
  });
});

describe("test runner", () => {
  it("really runs the pricing test at every commit", () => {
    const statuses = fx.all.map((c) => runFixtureTest(c.files, ...PRICING).status);
    const bad = at("Extract the discount rate");
    const fixed = at("Fix large-cart discount");
    statuses.forEach((s, i) => {
      if (i < at("Discount large carts")) expect(s).toBe("missing");
      else if (i >= bad && i < fixed) expect(s).toBe("fail");
      else expect(s).toBe("pass");
    });
  });

  it("reports the actual assertion", () => {
    const r = runFixtureTest(fx.all[at("Extract the discount rate")].files, ...PRICING);
    expect(r.detail).toBe("Expected 180, received 20");
  });

  it("refuses unsupported module syntax instead of guessing", () => {
    const files = { "t.test.ts": 'export default 1;\ntest("x", () => {});\n' };
    expect(runFixtureTest(files, "t.test.ts", "x").status).toBe("error");
  });

  it("stops runaway code", () => {
    const files = { "t.test.ts": 'test("loop", () => { while (true) {} });\n' };
    expect(runFixtureTest(files, "t.test.ts", "loop")).toMatchObject({ status: "error", detail: "Timed out after 1000 ms" });
  });
});

describe("bisect", () => {
  const run = (s: BisectState, outcomeAt: (i: number) => TestOutcome) => {
    for (let i = 0; i < 20; i++) {
      const p = nextProbe(s);
      if (p === null) return s;
      s = recordProbe(s, p, outcomeAt(p));
    }
    throw new Error("bisect did not finish");
  };
  const o = (status: TestOutcome["status"]): TestOutcome => ({ status, detail: status, ms: 0 });

  it("finds the commit that broke pricing by running the real test", () => {
    const s = run(startBisect(at("Discount large carts"), at("Add local environment template")), (i) => runFixtureTest(fx.all[i].files, ...PRICING));
    expect(s.result).toEqual({ kind: "found", firstBad: at("Extract the discount rate"), lastGood: at("Add order routes") });
    expect(s.probes.length).toBeLessThanOrEqual(5);
  });

  it("refuses when the known-bad commit passes", () => {
    const s = run(startBisect(at("Discount large carts"), at("Remove legacy login")), (i) => runFixtureTest(fx.all[i].files, ...PRICING));
    expect(s.result?.kind).toBe("invalid");
  });

  it("reports ambiguity when skipped commits hide the boundary", () => {
    const s = run(startBisect(0, 4), (i) => (i === 0 ? o("pass") : i === 4 ? o("fail") : i === 3 ? o("error") : i < 3 ? o("pass") : o("fail")));
    expect(s.result).toEqual({ kind: "ambiguous", candidates: [3, 4], lastGood: 2 });
  });
});
