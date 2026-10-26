// Runs one Jest-style test from a fixture commit, for real. TypeScript is stripped with
// Node's built-in stripper, the supported ES module forms are rewritten to CommonJS, and
// the code runs in a VM context with a time limit. Server only (node:vm).
//
// What actually keeps this safe is NOT the VM. `node:vm` is documented as not being a security
// mechanism, and it should not be trusted as one. The control that matters is upstream: callers
// pass a commit ID and a test name, never code, and the route resolves both against the bundled
// fixture, so only source that is already committed to this repository ever executes.
//
// Within that, the measures below are defence in depth:
//   - every host value handed to the context has its prototype severed, because a host object's
//     `.constructor` reaches the host realm's Function and compiles code there. Left alone, a
//     test body could read `process`, `fs` and the whole environment (demonstrated in the tests).
//   - secrets are never loadable, so nothing inside the context can see them even by accident.
//   - a wall-clock limit covers both module bodies and the test body.
// Running genuinely untrusted code would need a separate process with its own limits.

import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

import { isSecretFile, isSource } from "@/features/impact-analysis/source-analysis";
import { expect, resolveModule, toCommonJs, Unsupported, type TestOutcome, type TestStatus } from "@/features/testing/harness";

export type { TestOutcome, TestStatus } from "@/features/testing/harness";

const TIME_LIMIT_MS = 1000;

/**
 * Cut a value off from the host realm before it crosses into the context. A function keeps
 * working without its prototype; what it loses is `.constructor`, and with it the route to
 * compiling code outside the sandbox.
 */
function severed<T extends object>(value: T): T {
  for (const key of Object.keys(value)) {
    const inner = (value as Record<string, unknown>)[key];
    if (typeof inner === "function" || (typeof inner === "object" && inner !== null)) severed(inner as object);
  }
  return Object.setPrototypeOf(value, null) as T;
}

export function runFixtureTest(files: Record<string, string>, testPath: string, testName: string): TestOutcome {
  const t0 = performance.now();
  const done = (status: TestStatus, detail: string): TestOutcome => ({ status, detail, ms: Math.round((performance.now() - t0) * 10) / 10 });

  if (!(testPath in files)) return done("missing", `${testPath} does not exist at this commit.`);

  const registered = new Map<string, () => unknown>();
  const register = severed((name: string, fn: () => unknown) => void registered.set(name, fn));

  // The sandbox object becomes the context's global, so it needs severing too: otherwise
  // `globalThis.constructor` is the host realm's Object and leads straight back out.
  const context = vm.createContext(severed({ test: register, it: register, console: severed({ log() {}, warn() {}, error() {} }) }));

  // Errors are values that cross the boundary like any other. A host Error carries the host
  // realm on its prototype chain, so test code could catch one and compile through it. Every
  // error handed back to the context is built here, inside it.
  const vmError = vm.runInContext(
    "(message, kind) => { const e = new Error(String(message)); e.kind = kind; return e; }",
    context,
  ) as (message: string, kind: string) => Error;

  /** Run host logic for the context, converting anything it throws into a context-owned error. */
  const forVm = <T>(fn: () => T): T => {
    try {
      return fn();
    } catch (e) {
      const err = e as Error;
      throw vmError(err?.message ?? String(e), err instanceof Unsupported ? "unsupported" : "host");
    }
  };

  /** Wrap a host value so every function in it reports failures as context-owned errors. */
  const shield = (value: unknown): unknown => {
    if (typeof value === "function") {
      const fn = value as (...args: unknown[]) => unknown;
      return severed((...args: unknown[]) => shield(forVm(() => fn(...args))));
    }
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = Object.create(null);
      for (const [k, v] of Object.entries(value)) out[k] = shield(v);
      return out;
    }
    return value;
  };

  // A failed assertion throws from the host, so the matchers are shielded, not just severed.
  context.expect = severed((actual: unknown) => shield(expect(actual)));
  const cache = new Map<string, Record<string, unknown>>();

  const load = (path: string): Record<string, unknown> => {
    const hit = cache.get(path);
    if (hit) return hit;
    // An allowlist, not a denylist. Naming the secrets to refuse was not enough: anything in the
    // commit whose contents happen to parse as JavaScript could be imported and read back, which
    // covered id_rsa, .npmrc and credentials.json. Only real source modules load, and secrets are
    // refused even when they carry a source extension.
    if (!isSource(path) || isSecretFile(path)) throw new Unsupported(`${path} is not a source module and is never loaded`);
    const exports: Record<string, unknown> = severed({});
    cache.set(path, exports);
    const js = toCommonJs(stripTypeScriptTypes(files[path], { mode: "strip" }), path);
    const wrapper = vm.runInContext(`(function (exports, require) {\n${js}\n})`, context, { filename: path, timeout: TIME_LIMIT_MS });
    const require = severed((spec: string) =>
      forVm(() => {
        const target = resolveModule(path, spec, files);
        if (!target) throw new Unsupported(`${path}: cannot resolve "${spec}" at this commit`);
        return load(target);
      }),
    );
    wrapper(exports, require);
    return exports;
  };

  // Module bodies run inside the context as well, under the same time limit.
  context.__load = severed(() => forVm(() => load(testPath)));
  try {
    vm.runInContext("__load()", context, { timeout: TIME_LIMIT_MS });
  } catch (e) {
    return done("error", `Could not load the test: ${(e as Error).message}`);
  }
  const fn = registered.get(testName);
  if (!fn) return done("missing", `“${testName}” is not defined in ${testPath} at this commit.`);

  // Run the test body inside the context too, so the time limit applies to it.
  context.__run = fn;
  try {
    const r = vm.runInContext("__run()", context, { timeout: TIME_LIMIT_MS });
    if (r && typeof (r as Promise<unknown>).then === "function") return done("error", "Async tests are not supported by this runner.");
    return done("pass", "Passed");
  } catch (e) {
    const err = e as Error & { kind?: string };
    // Boundary errors arrive rebuilt inside the context, so the kind travels on the error
    // rather than on its class.
    if (err instanceof Unsupported || err?.kind === "unsupported") return done("error", err.message);
    if (/Script execution timed out/.test(err.message)) return done("error", `Timed out after ${TIME_LIMIT_MS} ms`);
    return done("fail", err.message || String(e));
  }
}
