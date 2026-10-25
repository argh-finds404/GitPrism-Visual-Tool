import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { FIXTURE, fixtureHistory } from "@/features/impact-analysis/fixture";
import { merge3, withMarkers } from "@/features/mergelab/diff3";
import { buildCandidate, compareDiagnostics, mergeTrees, unifiedPatch, type Resolution } from "@/features/mergelab/merge";
import { conflictPlaces, constellation, impactPreview, paramRange, semanticChanges, splitTopLevel } from "@/features/mergelab/semantic";
import { compileFiles, typeCheck } from "@/features/mergelab/checks";
import { runCompiled } from "@/features/testing/harness";

const fx = fixtureHistory();
const base = fx.all.find((c) => c.oid === fx.mergeBase)!.files;
const ours = fx.commits.at(-1)!.files;
const theirs = fx.incoming.at(-1)!.files;
const m = mergeTrees(base, ours, theirs);
const all = (strategy: Resolution["strategy"]) => Object.fromEntries(m.conflicts.map((c) => [c.id, { strategy }]));

const gitAvailable = (() => {
  try {
    execFileSync("git", ["--version"]);
    return true;
  } catch {
    return false;
  }
})();
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "gitprism-mergelab-"));
  dirs.push(d);
  return d;
};

describe("competing branch", () => {
  it("forks from the PR's base, by another author", () => {
    expect(fx.mergeBase).toBe(fx.base.oid);
    expect(fx.incoming.map((c) => c.message)).toEqual(["Slide session expiry on activity", "Test sliding sessions"]);
    expect(fx.incoming[0].parents).toEqual([fx.base.oid]);
    expect(fx.incoming[0].author).toBe("Lin Okafor <lin@acme-shop.dev>");
    expect(fx.incoming.every((c) => c.lane === FIXTURE.incoming)).toBe(true);
  });

  it.runIf(gitAvailable)("has real commit IDs and the merge base git computes", () => {
    const dir = tmp();
    const git = (args: string[], env: Record<string, string> = {}, input?: string) =>
      execFileSync("git", ["-c", "core.autocrlf=false", ...args], { cwd: dir, env: { ...process.env, ...env }, input }).toString().trim();
    git(["init", "-q"]);
    for (const c of [...fx.all, ...fx.incoming]) {
      for (const e of readdirSync(dir)) if (e !== ".git") rmSync(join(dir, e), { recursive: true, force: true });
      for (const [p, content] of Object.entries(c.files)) {
        mkdirSync(join(dir, dirname(p)), { recursive: true });
        writeFileSync(join(dir, p), content);
      }
      git(["add", "-A"]);
      const tree = git(["write-tree"]);
      const [, name, email] = c.author.match(/^(.*) <(.*)>$/)!;
      const when = `${c.timestamp} +0000`;
      const env = { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when };
      expect(git(["commit-tree", tree, ...c.parents.flatMap((p) => ["-p", p])], env, `${c.message}\n`)).toBe(c.oid);
    }
    expect(git(["merge-base", fx.commits.at(-1)!.oid, fx.incoming.at(-1)!.oid])).toBe(fx.mergeBase);
  }, 120_000);
});

describe("three-way merge", () => {
  it("classifies every path", () => {
    const st = Object.fromEntries(m.files.map((f) => [f.path, f.status]));
    expect(st["src/auth/session.ts"]).toBe("conflict");
    expect(st["src/api/middleware/auth-guard.ts"]).toBe("conflict");
    expect(st["tests/session.test.ts"]).toBe("merged");
    expect(st["README.md"]).toBe("theirs");
    expect(st["src/infra/cache.ts"]).toBe("ours");
    expect(st["src/auth/legacy.ts"]).toBe("ours");
    expect(st["src/orders/pricing.ts"]).toBe("unchanged");
    expect(m.conflicts.map((c) => c.id)).toEqual(["src/api/middleware/auth-guard.ts#1", "src/auth/session.ts#1", "src/auth/session.ts#2"]);
  });

  it.runIf(gitAvailable)("matches git merge-file on every file, and across 102 historical combinations", () => {
    const dir = tmp();
    const gitMerge = (o: string, b: string, t: string) => {
      writeFileSync(join(dir, "o"), o);
      writeFileSync(join(dir, "b"), b);
      writeFileSync(join(dir, "t"), t);
      try {
        return execFileSync("git", ["merge-file", "-p", "-L", "ours", "-L", "base", "-L", "theirs", "o", "b", "t"], { cwd: dir }).toString();
      } catch (e) {
        return (e as { stdout: Buffer }).stdout.toString();
      }
    };
    for (const f of m.files) if (f.base !== undefined && f.ours !== undefined && f.theirs !== undefined) expect(withMarkers(merge3(f.base, f.ours, f.theirs))).toBe(gitMerge(f.ours, f.base, f.theirs));

    const commits = [...fx.all, ...fx.incoming];
    let n = 0;
    for (const p of ["src/auth/session.ts", "src/orders/pricing.ts", "src/auth/auth.service.ts", "tests/session.test.ts", "src/auth/tokens.ts", "README.md", "src/api/middleware/auth-guard.ts"]) {
      const vs = [...new Set(commits.map((c) => c.files[p]).filter((x) => x !== undefined))];
      for (let a = 0; a < vs.length; a++)
        for (let b = 0; b < vs.length; b++)
          for (let c = 0; c < vs.length; c++) {
            if (a === b || a === c || b === c) continue;
            n++;
            expect(withMarkers(merge3(vs[a], vs[b], vs[c]))).toBe(gitMerge(vs[b], vs[a], vs[c]));
          }
    }
    expect(n).toBe(102);
  }, 300_000);

  it.runIf(gitAvailable)("exports a patch git can apply", () => {
    const dir = tmp();
    execFileSync("git", ["init", "-q"], { cwd: dir });
    for (const [p, content] of Object.entries(ours)) {
      mkdirSync(join(dir, dirname(p)), { recursive: true });
      writeFileSync(join(dir, p), content);
    }
    const cand = buildCandidate(m, all("theirs"));
    writeFileSync(join(dir, "merge.patch"), unifiedPatch(ours, cand.files));
    execFileSync("git", ["-c", "core.autocrlf=false", "apply", "merge.patch"], { cwd: dir });
    for (const [p, content] of Object.entries(cand.files)) expect(readFileSync(join(dir, p), "utf8")).toBe(content);
    for (const p of Object.keys(ours)) if (!(p in cand.files)) expect(existsSync(join(dir, p))).toBe(false);
  });
});

describe("semantic layer", () => {
  const places = conflictPlaces(m, { base, ours, theirs });

  it("finds the function each conflict sits in", () => {
    expect(places.get("src/auth/session.ts#1")!.symbols).toEqual(["validateSession"]);
    expect(places.get("src/auth/session.ts#2")!.symbols).toEqual(["refreshSession"]);
    expect(places.get("src/api/middleware/auth-guard.ts#1")!.symbols).toEqual(["authGuard"]);
  });

  it("relates conflicts only with evidence", () => {
    const { relations, groups } = constellation(m, places);
    expect(relations.every((r) => r.kind === "calls")).toBe(true);
    expect(relations.map((r) => [r.a, r.b])).toEqual(
      expect.arrayContaining([
        ["src/api/middleware/auth-guard.ts#1", "src/auth/session.ts#1"],
        ["src/auth/session.ts#2", "src/auth/session.ts#1"],
      ]),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it("groups each side's changes by structure", () => {
    const o = semanticChanges("src/auth/session.ts", base["src/auth/session.ts"], ours["src/auth/session.ts"], ours)!;
    const t = semanticChanges("src/auth/session.ts", base["src/auth/session.ts"], theirs["src/auth/session.ts"], theirs)!;
    expect(o.find((c) => c.kind === "signature")).toMatchObject({ symbol: "validateSession", detail: "(token: string, now: number) → (token: string, opts: ValidateOptions)" });
    expect(o.map((c) => c.kind)).toEqual(expect.arrayContaining(["import", "signature", "logic", "other"]));
    expect(t.find((c) => c.kind === "signature")).toMatchObject({ detail: "(token: string, now: number) → (token: string, now: number, slide = false)" });
    expect(semanticChanges("README.md", base["README.md"], theirs["README.md"], theirs)).toBeNull();
  });

  it("splits parameters and arguments at the top level only", () => {
    expect(paramRange("token: string, now: number, slide = false")).toEqual({ min: 2, max: 3 });
    expect(paramRange("token: string, next: () => unknown")).toEqual({ min: 2, max: 2 });
    expect(paramRange("opts?: { a: number, b: string }")).toEqual({ min: 0, max: 1 });
    expect(splitTopLevel('token, { now: Date.now(), useCache: true }, a < b, "x,y"')).toHaveLength(4);
  });
});

describe("validation", () => {
  const cleanly = async (files: Record<string, string>) => (await typeCheck(files)) as { available: true; diagnostics: { path: string; line: number; code: number; message: string }[] };
  const tests = (files: Record<string, string>) => {
    const compiled = compileFiles(files);
    expect(compiled.every((c) => c.ok)).toBe(true);
    const modules = Object.fromEntries(compiled.map((c) => [c.path, (c as { js: string }).js]));
    const names = [
      ["tests/session.test.ts", "rejects an unsigned token"],
      ["tests/session.test.ts", "creates a session for an hour"],
      ["tests/session.test.ts", "slides expiry when asked"],
      ["tests/auth.service.test.ts", "login returns a token"],
      ["tests/pricing.test.ts", "discounts large carts"],
    ] as const;
    return Object.fromEntries(names.map(([p, n]) => [n, runCompiled(modules, p, n).status]));
  };

  // The PR itself leaves requireUser passing a number to validateSession; the Studio flags it as a
  // static warning and the type checker confirms it. MergeLab must not blame the merge for it.
  let baseline: Awaited<ReturnType<typeof cleanly>>["diagnostics"] = [];
  it("type-checks the merge base and their tip cleanly, and finds the PR's own stale caller", async () => {
    expect((await cleanly(base)).diagnostics).toEqual([]);
    expect((await cleanly(theirs)).diagnostics).toEqual([]);
    baseline = (await cleanly(ours)).diagnostics;
    expect(baseline).toEqual([
      expect.objectContaining({ path: "src/auth/auth.service.ts", message: "Argument of type 'number' is not assignable to parameter of type 'ValidateOptions'." }),
    ]);
  }, 60_000);

  it("catches what taking our side breaks: their new test", async () => {
    const c = buildCandidate(m, all("ours"));
    expect(c.unresolved).toEqual([]);
    const { introduced, existing } = compareDiagnostics(baseline, ours, (await cleanly(c.files)).diagnostics, c.files);
    expect(existing).toHaveLength(1);
    expect(introduced).toHaveLength(1);
    expect(introduced[0]).toMatchObject({ path: "tests/session.test.ts", message: "Expected 2 arguments, but got 3." });
    expect(tests(c.files)["slides expiry when asked"]).toBe("fail");
    expect(impactPreview(ours, c.files).callSites).toEqual([]);
  }, 60_000);

  it("catches what taking their side breaks, even though every test passes", async () => {
    const c = buildCandidate(m, all("theirs"));
    const d = (await cleanly(c.files)).diagnostics;
    expect(d.map((x) => x.path)).toEqual(["tests/session.test.ts"]);
    expect(d[0].message).toMatch(/not assignable to parameter of type 'number'/);
    expect(Object.values(tests(c.files)).every((s) => s === "pass")).toBe(true);
    const preview = impactPreview(ours, c.files);
    expect(preview.signatures.map((s) => s.name)).toEqual(["validateSession"]);
    expect(preview.callSites.length).toBeGreaterThan(0);
  }, 60_000);

  it("passes everything with a correct hand-written combination", async () => {
    const session = ours["src/auth/session.ts"]
      .replace("useCache?: boolean };", "useCache?: boolean; slide?: boolean };")
      .replace("  const session = { userId, expiresAt: opts.now + 3600_000 };", "  const ttl = opts.slide ? 30 * 60_000 : 3600_000;\n  const session = { userId, expiresAt: opts.now + ttl };")
      .replace("validateSession(token, { now: Date.now() })", "validateSession(token, { now: Date.now(), slide: true })");
    const guard = ours["src/api/middleware/auth-guard.ts"].replace("useCache: true }", "useCache: true, slide: true }");
    const merged = buildCandidate(m, all("ours")).files["tests/session.test.ts"].replace('validateSession("u1.sig", 0, true)', 'validateSession("u1.sig", { now: 0, slide: true })');
    // Fixing the PR's stale caller too leaves no errors at all.
    const service = ours["src/auth/auth.service.ts"].replace("validateSession(token, Date.now())", "validateSession(token, { now: Date.now() })");
    const c = buildCandidate(m, {}, { "src/auth/session.ts": session, "src/api/middleware/auth-guard.ts": guard, "tests/session.test.ts": merged, "src/auth/auth.service.ts": service });
    expect(c.unresolved).toEqual([]);
    expect(c.handEdited).toBe(true);
    expect((await cleanly(c.files)).diagnostics).toEqual([]);
    expect(Object.values(tests(c.files)).every((s) => s === "pass")).toBe(true);
  }, 60_000);

  it("reports syntax errors instead of throwing", () => {
    const r = compileFiles({ "src/x.ts": "export function f( {\n" });
    expect(r[0].ok).toBe(false);
  });
});
