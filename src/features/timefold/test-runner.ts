// Runs one Jest-style test from a fixture commit, for real. TypeScript is stripped with
// Node's built-in stripper, the supported ES module forms are rewritten to CommonJS, and
// the code runs in a fresh VM context with a time limit. Only committed fixture source is
// ever executed: callers pass a commit ID and a test name, never code. Server only (node:vm).

import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

import { expect, resolveModule, toCommonJs, Unsupported, type TestOutcome, type TestStatus } from "@/features/testing/harness";

export type { TestOutcome, TestStatus } from "@/features/testing/harness";

const TIME_LIMIT_MS = 1000;

export function runFixtureTest(files: Record<string, string>, testPath: string, testName: string): TestOutcome {
  const t0 = performance.now();
  const done = (status: TestStatus, detail: string): TestOutcome => ({ status, detail, ms: Math.round((performance.now() - t0) * 10) / 10 });

  if (!(testPath in files)) return done("missing", `${testPath} does not exist at this commit.`);

  const registered = new Map<string, () => unknown>();
  const register = (name: string, fn: () => unknown) => void registered.set(name, fn);
  const context = vm.createContext({ test: register, it: register, expect, console: { log() {}, warn() {}, error() {} } });
  const cache = new Map<string, Record<string, unknown>>();

  const load = (path: string): Record<string, unknown> => {
    const hit = cache.get(path);
    if (hit) return hit;
    const exports: Record<string, unknown> = {};
    cache.set(path, exports);
    const js = toCommonJs(stripTypeScriptTypes(files[path], { mode: "strip" }), path);
    const wrapper = vm.runInContext(`(function (exports, require) {\n${js}\n})`, context, { filename: path, timeout: TIME_LIMIT_MS });
    const require = (spec: string) => {
      const target = resolveModule(path, spec, files);
      if (!target) throw new Unsupported(`${path}: cannot resolve "${spec}" at this commit`);
      return load(target);
    };
    wrapper(exports, require);
    return exports;
  };

  // Module bodies run inside the context as well, under the same time limit.
  context.__load = () => load(testPath);
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
    const err = e as Error;
    if (err instanceof Unsupported) return done("error", err.message);
    if (/Script execution timed out/.test(err.message)) return done("error", `Timed out after ${TIME_LIMIT_MS} ms`);
    return done("fail", err.message || String(e));
  }
}
