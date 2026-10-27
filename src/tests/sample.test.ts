import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { blobs, files, srcTree, tree } from "@/lib/sample";

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

describe.runIf(gitAvailable)("homepage sample repository matches real git", () => {
  it("has the same blob, subtree and root tree IDs as git write-tree", () => {
    const dir = mkdtempSync(join(tmpdir(), "gitprism-sample-"));
    dirs.push(dir);
    const git = (...args: string[]) => execFileSync("git", ["-c", "core.autocrlf=false", ...args], { cwd: dir }).toString().trim();
    git("init", "-q");
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "hello.txt"), files.hello.content);
    writeFileSync(join(dir, "notes.md"), files.notes.content);
    writeFileSync(join(dir, "src", "app.js"), files.app.content);
    git("add", "-A");

    expect(git("hash-object", "src/app.js")).toBe(blobs.app);
    expect(git("write-tree")).toBe(tree);
    expect(git("rev-parse", `${tree}:src`)).toBe(srcTree);
  });
});
