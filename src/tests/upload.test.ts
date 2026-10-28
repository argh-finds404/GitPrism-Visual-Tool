import { describe, expect, it } from "vitest";
import { analyze } from "@/features/impact-analysis/analysis-service";
import { classify, collect, isIgnored, LIMITS, relativePath } from "@/features/upload/collect";

/** A stand-in for the browser's File, enough for what collect() touches. */
const file = (path: string, content: string): File =>
  ({
    name: path.split("/").pop()!,
    size: content.length,
    webkitRelativePath: `project/${path}`,
    text: async () => content,
  }) as unknown as File;

describe("what a picked folder contributes", () => {
  it("drops the picked folder's own name from the path", () => {
    expect(relativePath(file("src/a.ts", "x"))).toBe("src/a.ts");
  });

  it("refuses directories that are never worth analysing", () => {
    for (const p of ["node_modules/react/index.js", "src/node_modules/x.ts", ".git/config", "dist/main.js", ".next/server/a.js"]) {
      expect(isIgnored(p)).toBe(true);
    }
    expect(isIgnored("src/app/page.tsx")).toBe(false);
  });

  it("never takes a secret, whatever its extension", () => {
    expect(classify(".env", 10)).toBe("secret");
    expect(classify("src/.env.local", 10)).toBe("secret");
    expect(classify("id.key", 10)).toBe("secret");
    expect(classify("server.pem", 10)).toBe("secret");
  });

  it("takes source and refuses the rest", () => {
    expect(classify("src/a.ts", 10)).toBe("take");
    expect(classify("src/a.tsx", 10)).toBe("take");
    expect(classify("README.md", 10)).toBe("notSource");
    expect(classify("logo.png", 10)).toBe("notSource");
    expect(classify("src/huge.ts", LIMITS.fileBytes + 1)).toBe("tooBig");
  });
});

describe("collecting a folder", () => {
  it("reads only the eligible files and counts what it left", async () => {
    const r = await collect([
      file("src/a.ts", "export function a() { return 1; }\n"),
      file("src/b.ts", 'import { a } from "./a";\nexport function b() { return a(); }\n'),
      file("README.md", "# hi"),
      file(".env", "SECRET=1"),
      file("node_modules/dep/index.js", "module.exports = 1"),
    ]);
    expect(Object.keys(r.files)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(r.skipped).toEqual({ ignored: 1, notSource: 1, secret: 1, tooBig: 0 });
    expect(r.truncated).toBe(false);
    expect(JSON.stringify(r.files)).not.toContain("SECRET");
  });

  it("stops at the file limit and says so rather than silently truncating", async () => {
    const many = Array.from({ length: LIMITS.files + 25 }, (_, i) => file(`src/f${i}.ts`, "export const x = 1;\n"));
    const r = await collect(many);
    expect(Object.keys(r.files)).toHaveLength(LIMITS.files);
    expect(r.truncated).toBe(true);
  });

  it("stops at the byte limit too", async () => {
    const big = "x".repeat(LIMITS.fileBytes - 1);
    const r = await collect(Array.from({ length: 30 }, (_, i) => file(`src/b${i}.ts`, big)));
    expect(r.bytes).toBeLessThanOrEqual(LIMITS.bytes);
    expect(r.truncated).toBe(true);
  });
});

describe("an uploaded project goes through the real analyser", () => {
  it("builds the graph, and finds a cycle the project actually has", async () => {
    const { files } = await collect([
      file("src/a.ts", 'import { b } from "./b";\nexport function a() { return b(); }\n'),
      file("src/b.ts", 'import { a } from "./a";\nexport function b() { return a(); }\n'),
      file("src/loose.ts", 'import { gone } from "./missing";\nexport function loose() { return gone(); }\n'),
    ]);
    // Same snapshot both sides: nothing "changed", so this is pure structure.
    const r = analyze(files, files, { base: "upload", head: "upload", layers: [], rules: [] });

    expect(r.changes).toEqual([]);
    expect(r.nodes.filter((n) => n.kind === "file")).toHaveLength(3);
    expect(r.cycles.length).toBeGreaterThan(0);
    expect(r.unresolved.map((u) => u.path)).toContain("src/loose.ts");
    // No layer config for an arbitrary project, so nothing is wrongly reported as a violation.
    expect(r.violations).toEqual([]);
  });

  it("resolves @/ and ~/ path aliases and index.tsx files cleanly", async () => {
    const { files } = await collect([
      file("src/lib/math.ts", "export function add(a: number, b: number) { return a + b; }\n"),
      file("src/components/ui/index.tsx", 'import { add } from "@/lib/math";\nexport function Widget() { return add(1, 2); }\n'),
      file("src/app/page.tsx", 'import { Widget } from "~/components/ui";\nexport function Page() { return Widget(); }\n'),
    ]);
    const r = analyze(files, files, { base: "upload", head: "upload", layers: [], rules: [] });
    expect(r.unresolved).toEqual([]);
    const importEdges = r.edges.filter((e) => e.kind === "imports");
    expect(importEdges).toHaveLength(2);
    const callEdges = r.edges.filter((e) => e.kind === "calls");
    expect(callEdges).toHaveLength(2);
  });
});
