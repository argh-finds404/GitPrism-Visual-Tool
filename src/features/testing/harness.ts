// The pieces both test runners share: the server runner for committed fixture code
// (TimeFold) and the browser worker for merge candidates (MergeLab). Pure functions only.

export type TestStatus = "pass" | "fail" | "missing" | "error";
export type TestOutcome = { status: TestStatus; detail: string; ms: number };

export class Unsupported extends Error {}

/** `import { a, b as c } from "x"` and `export function|const` only; anything else is refused. */
export function toCommonJs(src: string, path: string) {
  const exported: string[] = [];
  let out = src.replace(/^import\s+\{([^}]*)\}\s+from\s+["']([^"']+)["'];?/gm, (_, names: string, spec: string) => {
    const list = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => n.replace(/\s+as\s+/, ": "));
    return `const { ${list.join(", ")} } = require(${JSON.stringify(spec)});`;
  });
  out = out.replace(/^export\s+(async\s+)?function\s+(\w+)/gm, (_, a: string | undefined, name: string) => {
    exported.push(name);
    return `${a ?? ""}function ${name}`;
  });
  out = out.replace(/^export\s+(const|let|var)\s+(\w+)/gm, (_, k: string, name: string) => {
    exported.push(name);
    return `${k} ${name}`;
  });
  const left = out.match(/^\s*(import|export)\b.*$/m);
  if (left) throw new Unsupported(`${path}: unsupported module syntax "${left[0].trim()}"`);
  return `${out}\n${exported.map((n) => `exports.${n} = ${n};`).join("\n")}`;
}

/** Resolve a relative import against a file set, like the analyzer does. */
export function resolveModule(from: string, spec: string, files: Record<string, unknown>) {
  if (!spec.startsWith(".")) return null;
  const dir = from.split("/").slice(0, -1);
  for (const part of spec.split("/")) {
    if (part === "..") dir.pop();
    else if (part !== ".") dir.push(part);
  }
  const base = dir.join("/");
  // Own properties only: `in` walks the prototype chain, so `require("../constructor")` and
  // `require("../toString")` would resolve to Object.prototype members and hand back a function
  // where a file's source was expected.
  for (const ext of ["", ".ts", ".tsx", ".js", "/index.ts"])
    if (Object.prototype.hasOwnProperty.call(files, base + ext)) return base + ext;
  return null;
}

const show = (v: unknown) => {
  try {
    return typeof v === "string" ? JSON.stringify(v) : (JSON.stringify(v) ?? String(v));
  } catch {
    return String(v);
  }
};

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Run one test from already-compiled CommonJS modules. Used inside a Web Worker, which the
 * caller terminates if it runs too long; in a worker the code can't touch the page.
 */
export function runCompiled(modules: Record<string, string>, testPath: string, testName: string): TestOutcome {
  const t0 = performance.now();
  const done = (status: TestStatus, detail: string): TestOutcome => ({ status, detail, ms: Math.round((performance.now() - t0) * 10) / 10 });
  if (!Object.prototype.hasOwnProperty.call(modules, testPath)) return done("missing", `${testPath} is not in the candidate.`);

  const registered = new Map<string, () => unknown>();
  const register = (name: string, fn: () => unknown) => void registered.set(name, fn);
  const cache = new Map<string, Record<string, unknown>>();
  const load = (path: string): Record<string, unknown> => {
    const hit = cache.get(path);
    if (hit) return hit;
    const exports: Record<string, unknown> = {};
    cache.set(path, exports);
    const require = (spec: string) => {
      const target = resolveModule(path, spec, modules);
      if (!target) throw new Unsupported(`${path}: cannot resolve "${spec}"`);
      return load(target);
    };
    new Function("exports", "require", "test", "it", "expect", modules[path])(exports, require, register, register, expect);
    return exports;
  };

  try {
    load(testPath);
  } catch (e) {
    return done("error", `Could not load the test: ${(e as Error).message}`);
  }
  const fn = registered.get(testName);
  if (!fn) return done("missing", `“${testName}” is not defined in ${testPath}.`);
  try {
    const r = fn();
    if (r && typeof (r as Promise<unknown>).then === "function") return done("error", "Async tests are not supported by this runner.");
    return done("pass", "Passed");
  } catch (e) {
    return done("fail", (e as Error)?.message || String(e));
  }
}

/** The small subset of Jest's `expect` the fixture uses, plus a few common matchers. */
export function expect(actual: unknown) {
  const fail = (m: string) => {
    throw new Error(m);
  };
  const matchers = (negate: boolean) => {
    const check = (ok: boolean, m: string) => (ok === negate ? fail(negate ? `Expected not: ${m}` : m) : undefined);
    return {
      toBe: (e: unknown) => check(Object.is(actual, e), `Expected ${show(e)}, received ${show(actual)}`),
      toEqual: (e: unknown) => check(deepEqual(actual, e), `Expected ${show(e)}, received ${show(actual)}`),
      toBeNull: () => check(actual === null, `Expected null, received ${show(actual)}`),
      toBeTruthy: () => check(!!actual, `Expected a truthy value, received ${show(actual)}`),
      toBeFalsy: () => check(!actual, `Expected a falsy value, received ${show(actual)}`),
      toContain: (e: unknown) =>
        check(
          (typeof actual === "string" && typeof e === "string" && actual.includes(e)) || (Array.isArray(actual) && actual.includes(e)),
          `Expected ${show(actual)} to contain ${show(e)}`,
        ),
      toThrow: () => {
        let threw = false;
        try {
          (actual as () => unknown)();
        } catch {
          threw = true;
        }
        check(threw, "Expected the function to throw");
      },
    };
  };
  return { ...matchers(false), not: matchers(true) };
}
