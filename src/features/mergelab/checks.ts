// Server-side merge checks. Neither one executes code: compiling only parses and strips
// TypeScript, and the type check runs the TypeScript compiler over an in-memory file set.
// That is why these may receive hand-edited candidates. Server only (node:module).

import { stripTypeScriptTypes } from "node:module";
import { resolveModule, toCommonJs } from "@/features/testing/harness";
import { isSecretFile, isSource } from "@/features/impact-analysis/source-analysis";

const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");

export type Compiled = { path: string; ok: true; js: string } | { path: string; ok: false; error: string };

/** Strip types and convert the supported module forms, file by file. Syntax errors are reported, not thrown. */
export function compileFiles(files: Record<string, string>): Compiled[] {
  return Object.entries(files)
    .filter(([p]) => isSource(p) && !isSecretFile(p))
    .map(([path, src]) => {
      try {
        return { path, ok: true as const, js: toCommonJs(stripTypeScriptTypes(src, { mode: "strip", sourceUrl: path }), path) };
      } catch (e) {
        return { path, ok: false as const, error: stripAnsi((e as Error).message).trim() };
      }
    });
}

export type Diagnostic = { path: string; line: number; column: number; code: number; message: string };
export type TypeCheck = { available: true; diagnostics: Diagnostic[]; files: number; ms: number } | { available: false; reason: string };

/** Ambient declarations for the Jest-style globals the fixture's tests use. */
const TEST_GLOBALS = `interface Matchers { toBe(v: unknown): void; toEqual(v: unknown): void; toBeNull(): void; toBeTruthy(): void; toBeFalsy(): void; toContain(v: unknown): void; toThrow(): void }
declare function test(name: string, fn: () => unknown): void;
declare function it(name: string, fn: () => unknown): void;
declare function expect(value: unknown): Matchers & { not: Matchers };
`;

const ROOT = "/repo/";

/** `tsc --noEmit --strict` over the candidate's TypeScript files. */
export async function typeCheck(files: Record<string, string>): Promise<TypeCheck> {
  const t0 = performance.now();
  let ts: typeof import("typescript");
  try {
    ts = (await import("typescript")).default;
  } catch {
    return { available: false, reason: "The TypeScript compiler isn't installed on this server." };
  }
  const virtual = new Map<string, string>();
  for (const [p, src] of Object.entries(files)) if (/\.tsx?$/.test(p) && !isSecretFile(p)) virtual.set(ROOT + p, src);
  virtual.set(`${ROOT}__test-globals.d.ts`, TEST_GLOBALS);

  const options: import("typescript").CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2022.d.ts"],
    types: [],
    skipLibCheck: true,
  };
  const real = ts.createCompilerHost(options, true);
  const host: import("typescript").CompilerHost = {
    ...real,
    getSourceFile: (name, lang) => (virtual.has(name) ? ts.createSourceFile(name, virtual.get(name)!, lang, true) : real.getSourceFile(name, lang)),
    fileExists: (name) => virtual.has(name) || real.fileExists(name),
    readFile: (name) => virtual.get(name) ?? real.readFile(name),
    writeFile: () => {},
    getCurrentDirectory: () => ROOT,
    // Relative imports resolve exactly as the analyzer and the test runner resolve them,
    // independent of the server's file system and platform paths.
    resolveModuleNameLiterals: (literals, containingFile) =>
      literals.map((lit) => {
        const from = containingFile.startsWith(ROOT) ? containingFile.slice(ROOT.length) : containingFile;
        const target = resolveModule(from, lit.text, files);
        return target && /\.tsx?$/.test(target)
          ? { resolvedModule: { resolvedFileName: ROOT + target, extension: target.endsWith(".tsx") ? ts.Extension.Tsx : ts.Extension.Ts, isExternalLibraryImport: false } }
          : { resolvedModule: undefined };
      }),
  };
  try {
    const program = ts.createProgram([...virtual.keys()], options, host);
    const diagnostics = ts
      .getPreEmitDiagnostics(program)
      .filter((d) => d.file && virtual.has(d.file.fileName))
      .map((d) => {
        const { line, character } = d.file!.getLineAndCharacterOfPosition(d.start ?? 0);
        return {
          path: d.file!.fileName.slice(ROOT.length),
          line: line + 1,
          column: character + 1,
          code: d.code,
          message: ts.flattenDiagnosticMessageText(d.messageText, " "),
        };
      });
    return { available: true, diagnostics, files: virtual.size - 1, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return { available: false, reason: `The type checker could not run: ${(e as Error).message}` };
  }
}
