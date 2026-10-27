// Lightweight TypeScript/JavaScript source analysis.
//
// Supported: ES `import { a, b } from "./x"` (relative paths), `export function`
// declarations, direct calls to imported or same-file functions, and Jest-style
// `test("...")` / `it("...")` blocks. Not supported: dynamic imports, re-exports,
// method calls, default exports or type-level relationships. Unsupported forms are
// skipped, never guessed.

export type ParsedImport = { names: string[]; from: string; resolved: string | null; line: number; text: string };
export type ParsedFunction = { name: string; params: string; startLine: number; endLine: number; body: string };
export type ParsedTest = { name: string; startLine: number; endLine: number; body: string };
export type ParsedFile = { path: string; imports: ParsedImport[]; functions: ParsedFunction[]; tests: ParsedTest[] };

export const isSource = (path: string) => /\.(ts|tsx|js|jsx)$/.test(path);
export const isTestFile = (path: string) => /(^|\/)tests?\//.test(path) || /\.(test|spec)\.[tj]sx?$/.test(path);
/** Files that must never be parsed or packed: secrets and environment files. */
export const isSecretFile = (path: string) => /(^|\/)\.env(\..*)?$/.test(path) || /\.(pem|key)$/.test(path);

function resolveImport(from: string, spec: string, files: Set<string>): string | null {
  if (!spec.startsWith(".")) return null;
  const dir = from.split("/").slice(0, -1);
  for (const part of spec.split("/")) {
    if (part === "..") dir.pop();
    else if (part !== ".") dir.push(part);
  }
  const base = dir.join("/");
  for (const ext of ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts"]) if (files.has(base + ext)) return base + ext;
  return null;
}

/** Find the line where the block opened at `openIndex` closes. */
function blockEnd(src: string, openIndex: number) {
  let depth = 0;
  for (let i = openIndex; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return i;
  }
  return src.length - 1;
}

const lineAt = (src: string, index: number) => src.slice(0, index).split("\n").length;

export function parseFile(path: string, src: string, files: Set<string>): ParsedFile {
  const imports: ParsedImport[] = [];
  const importRe = /^import\s+\{([^}]*)\}\s+from\s+["']([^"']+)["'];?/gm;
  for (const m of src.matchAll(importRe)) {
    imports.push({
      names: m[1].split(",").map((n) => n.trim().split(/\s+as\s+/).pop()!).filter(Boolean),
      from: m[2],
      resolved: resolveImport(path, m[2], files),
      line: lineAt(src, m.index!),
      text: m[0].replace(/;$/, ""),
    });
  }

  const functions: ParsedFunction[] = [];
  const fnRe = /^export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)[^{]*\{/gm;
  for (const m of src.matchAll(fnRe)) {
    const open = m.index! + m[0].length - 1;
    const close = blockEnd(src, open);
    functions.push({
      name: m[1],
      params: m[2].trim(),
      startLine: lineAt(src, m.index!),
      endLine: lineAt(src, close),
      body: src.slice(open + 1, close),
    });
  }

  const tests: ParsedTest[] = [];
  const testRe = /^(?:test|it)\(\s*["'`]([^"'`]+)["'`]\s*,[^{]*\{/gm;
  for (const m of src.matchAll(testRe)) {
    const open = m.index! + m[0].length - 1;
    const close = blockEnd(src, open);
    tests.push({ name: m[1], startLine: lineAt(src, m.index!), endLine: lineAt(src, close), body: src.slice(open + 1, close) });
  }
  return { path, imports, functions, tests };
}

/** Direct calls to known names inside a body, with the line (absolute) and call text. */
export function findCalls(body: string, bodyStartLine: number, names: string[]) {
  const out: { name: string; line: number; text: string }[] = [];
  if (!names.length) return out;
  const re = new RegExp(`(?<![\\w.])(${names.map((n) => n.replace(/\W/g, "")).join("|")})\\s*\\(`, "g");
  const lines = body.split("\n");
  lines.forEach((l, i) => {
    for (const m of l.matchAll(re)) {
      // Capture the call's argument text up to the balancing parenthesis.
      let depth = 0;
      let end = m.index! + m[0].length - 1;
      for (let j = end; j < l.length; j++) {
        if (l[j] === "(") depth++;
        else if (l[j] === ")" && --depth === 0) {
          end = j;
          break;
        }
      }
      out.push({ name: m[1], line: bodyStartLine + i, text: l.slice(m.index!, end + 1).trim() });
    }
  });
  return out;
}
