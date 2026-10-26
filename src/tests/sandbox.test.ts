// What keeps executing repository code safe, pinned down.
//
// Two separate claims are tested here, because they protect against different things:
//   1. only code that is already committed to the bundled fixture can ever be executed, which is
//      enforced by the route handlers and is the control that actually matters;
//   2. inside the runner, a test body cannot reach the host realm, read secrets or run forever.
//
// The second is defence in depth, not a security boundary: `node:vm` is documented as not being
// one. These tests exist so the known holes stay closed, not to claim the VM is escape-proof.

import { describe, expect, it } from "vitest";
import { fixtureHistory, FIXTURE } from "@/features/impact-analysis/fixture";
import { runFixtureTest } from "@/features/timefold/test-runner";
import { POST as runTest } from "@/app/api/repos/[owner]/[repo]/run-test/route";
import { POST as preflight } from "@/app/api/repos/[owner]/[repo]/proofgraph/route";

/** Run a hostile test body through the server runner. */
function hostile(body: string, extra: Record<string, string> = {}) {
  const files = { ...extra, "tests/x.test.ts": `test("x", () => {\n${body}\n});\n` };
  return runFixtureTest(files, "tests/x.test.ts", "x");
}

/** Call a route handler the way Next would, without a server. */
async function call(
  handler: (req: never, ctx: never) => Promise<Response>,
  params: { owner: string; repo: string },
  body: unknown,
) {
  const req = new Request("http://test.local/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const res = await handler(req as never, { params: Promise.resolve(params) } as never);
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const FIX = { owner: FIXTURE.owner, repo: FIXTURE.repo };

describe("the runner cannot reach outside itself", () => {
  // Every one of these reached the real `process`, `fs` and 134 environment variables before
  // host values had their prototypes severed.
  const vectors: [string, string][] = [
    ["the expect helper", `expect.constructor("return process")().pid;`],
    ["the console stub", `console.log.constructor("return process")().pid;`],
    ["the module's own exports object", `exports.constructor.constructor("return process")().pid;`],
    ["the require function", `require.constructor("return process")().pid;`],
    ["a matcher object", `expect(1).constructor.constructor("return process")().pid;`],
  ];

  for (const [name, body] of vectors) {
    it(`cannot compile host code through ${name}`, () => {
      const out = hostile(body);
      expect(out.status).not.toBe("pass");
      expect(out.detail).not.toMatch(/\d{3,}/); // no pid came back
      expect(out.detail).toMatch(/is not a function|Cannot read properties of undefined/);
    });
  }

  it("cannot reach the host realm through an imported module", () => {
    const out = hostile(`require("../src/a").constructor.constructor("return process")().pid;`, {
      "src/a.ts": `export function a() { return 1; }\n`,
    });
    expect(out.status).not.toBe("pass");
    expect(out.detail).toMatch(/Cannot read properties of undefined/);
  });

  it("leaves no global environment to read even if it got that far", () => {
    const out = hostile(`throw new Error("env:" + typeof process + " req:" + typeof require("fs"));`);
    expect(out.status).not.toBe("pass");
    expect(out.detail).not.toMatch(/env:object/);
  });
});

describe("secrets never enter the sandbox", () => {
  it("refuses to load a .env file", () => {
    const out = hostile(`throw new Error("LEAKED " + require("../.env"));`, { ".env": "SESSION_SECRET=super-secret\n" });
    expect(out.status).toBe("error");
    expect(out.detail).toMatch(/secret file and is never loaded/);
    expect(out.detail).not.toContain("super-secret");
  });

  it("refuses key material too", () => {
    const out = hostile(`require("../id.key");`, { "id.key": "-----BEGIN PRIVATE KEY-----\n" });
    expect(out.status).toBe("error");
    expect(out.detail).toMatch(/secret file and is never loaded/);
    expect(out.detail).not.toContain("PRIVATE KEY");
  });
});

describe("a test cannot run forever", () => {
  it("stops an infinite loop", () => {
    const out = hostile(`while (true) {}`);
    expect(out.status).toBe("error");
    expect(out.detail).toMatch(/Timed out/);
  });

  it("stops unbounded allocation", () => {
    const out = hostile(`const a = []; while (true) a.push(new Array(1e6).fill(7));`);
    expect(out.status).toBe("error");
    expect(out.detail).toMatch(/Timed out/);
  });

  it("stops a module body that never returns", () => {
    const out = runFixtureTest(
      { "src/slow.ts": `while (true) {}\nexport function s() { return 1; }\n`, "tests/s.test.ts": `import { s } from "../src/slow";\ntest("s", () => { s(); });\n` },
      "tests/s.test.ts",
      "s",
    );
    expect(out.status).toBe("error");
  });
});

describe("hardening did not change what the runner reports", () => {
  const files = {
    "src/m.ts": `export function two() { return 2; }\n`,
    "tests/ok.test.ts": `import { two } from "../src/m";\ntest("works", () => { expect(two()).toBe(2); });\n`,
  };

  it("still passes a passing test", () => {
    expect(runFixtureTest(files, "tests/ok.test.ts", "works").status).toBe("pass");
  });

  it("still reports a real failure with its message", () => {
    const broken = { ...files, "src/m.ts": `export function two() { return 3; }\n` };
    const out = runFixtureTest(broken, "tests/ok.test.ts", "works");
    expect(out.status).toBe("fail");
    expect(out.detail).toBe("Expected 2, received 3");
  });

  it("still reports an absent test as missing", () => {
    expect(runFixtureTest(files, "tests/ok.test.ts", "nope").status).toBe("missing");
    expect(runFixtureTest(files, "tests/gone.test.ts", "works").status).toBe("missing");
  });
});

describe("one run cannot contaminate the next", () => {
  const clean = {
    "src/m.ts": `export function two() { return 2; }\n`,
    "tests/ok.test.ts": `import { two } from "../src/m";\ntest("works", () => { expect(two()).toBe(2); });\n`,
  };

  it("leaves no trace on globals a later run would see", () => {
    hostile(`Object.prototype.__pg = "polluted"; Array.prototype.push = () => {};`);
    const after = hostile(`
      if (({}).__pg) throw new Error("LEAKED object prototype");
      const a = []; a.push(1);
      if (a.length !== 1) throw new Error("LEAKED array prototype");
    `);
    expect(after.status).toBe("pass");
  });

  it("leaves the shared matchers unharmed for later runs", () => {
    hostile(`expect(1).toBe = () => { throw new Error("hijacked"); };`);
    expect(runFixtureTest(clean, "tests/ok.test.ts", "works").status).toBe("pass");
  });

  it("gives each run its own module instances", () => {
    const counter = {
      "src/c.ts": `let n = 0;\nexport function bump() { n += 1; return n; }\n`,
      "tests/c.test.ts": `import { bump } from "../src/c";\ntest("first", () => { expect(bump()).toBe(1); });\n`,
    };
    expect(runFixtureTest(counter, "tests/c.test.ts", "first").status).toBe("pass");
    expect(runFixtureTest(counter, "tests/c.test.ts", "first").status).toBe("pass");
  });
});

describe("only committed fixture code can be executed", () => {
  const head = fixtureHistory().commits.at(-1)!;

  it("runs a real test at a real commit", async () => {
    const r = await call(runTest, FIX, { oid: head.oid, test: "tests/pricing.test.ts#discounts large carts" });
    expect(r.status).toBe(200);
    expect(["pass", "fail"]).toContain(r.body.status);
  });

  it("refuses any repository but the bundled fixture", async () => {
    const r = await call(runTest, { owner: "someone", repo: "else" }, { oid: head.oid, test: "a#b" });
    expect(r.status).toBe(404);
  });

  it("refuses a commit that is not in this repository", async () => {
    const r = await call(runTest, FIX, { oid: "0".repeat(40), test: "a#b" });
    expect(r.status).toBe(404);
  });

  it("refuses a malformed commit id", async () => {
    for (const oid of ["", "abc", "../../etc/passwd", "z".repeat(40), `${head.oid} `]) {
      const r = await call(runTest, FIX, { oid, test: "a#b" });
      expect(r.status).toBe(400);
    }
  });

  it("refuses a malformed test reference", async () => {
    for (const test of ["", "no-hash", "#leading"]) {
      const r = await call(runTest, FIX, { oid: head.oid, test });
      expect(r.status).toBe(400);
    }
  });

  it("refuses a body that is not JSON, and one with the wrong types", async () => {
    expect((await call(runTest, FIX, "not json at all")).status).toBe(400);
    expect((await call(runTest, FIX, { oid: 42, test: ["x"] })).status).toBe(400);
  });

  it("cannot be steered outside the commit by a path in the test name", async () => {
    const r = await call(runTest, FIX, { oid: head.oid, test: "../../../../etc/passwd#x" });
    expect(r.status).toBe(200);
    // Resolved against the commit's own file map, so it simply is not there.
    expect(r.body.status).toBe("missing");
  });

  it("validates the analysis routes the same way", async () => {
    expect((await call(preflight, { owner: "someone", repo: "else" }, { candidate: "pull" })).status).toBe(404);
    expect((await call(preflight, FIX, { candidate: "not-a-candidate" })).status).toBe(404);
    expect((await call(preflight, FIX, {})).status).toBe(400);
    expect((await call(preflight, FIX, "}{")).status).toBe(400);
  });
});
