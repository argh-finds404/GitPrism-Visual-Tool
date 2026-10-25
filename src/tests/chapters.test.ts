import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { CHAPTERS, chapterLine } from "@/lib/chapters";

const gitAvailable = (() => {
  try {
    execFileSync("git", ["--version"]);
    return true;
  } catch {
    return false;
  }
})();

describe("chapter IDs", () => {
  it("are unique short IDs", () => {
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
    CHAPTERS.forEach((c) => expect(c.id).toMatch(/^[0-9a-f]{7}$/));
  });

  it.runIf(gitAvailable)("match `echo <line> | git hash-object --stdin`", () => {
    for (const c of CHAPTERS) {
      const oid = execFileSync("git", ["hash-object", "--stdin"], { input: `${chapterLine(c.n, c.name)}\n` }).toString().trim();
      expect(oid.slice(0, 7)).toBe(c.id);
    }
  });
});
