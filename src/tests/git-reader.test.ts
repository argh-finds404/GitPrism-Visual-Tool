import { describe, expect, it } from "vitest";
import {
  computeCommitDiffs,
  flattenTree,
  readLocalGitRepo,
  type GitCommit,
  type GitTreeEntry,
} from "@/features/upload/git-reader";

describe("readLocalGitRepo", () => {
  it("returns null when no .git files are found", async () => {
    const fakeFile = new File(["console.log(1)"], "index.ts");
    Object.defineProperty(fakeFile, "webkitRelativePath", { value: "my-project/index.ts" });
    const result = await readLocalGitRepo([fakeFile]);
    expect(result).toBeNull();
  });

  it("parses HEAD, branches, and reflog commits from a .git folder", async () => {
    const headFile = new File(["ref: refs/heads/main\n"], "HEAD");
    Object.defineProperty(headFile, "webkitRelativePath", { value: "repo/.git/HEAD" });

    const branchFile = new File(["1111111111111111111111111111111111111111\n"], "main");
    Object.defineProperty(branchFile, "webkitRelativePath", { value: "repo/.git/refs/heads/main" });

    const reflogContent = [
      "0000000000000000000000000000000000000000 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa Alice <alice@example.com> 1700000000 +0000\tcommit (initial): Initial commit",
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1111111111111111111111111111111111111111 Alice <alice@example.com> 1700003600 +0000\tcommit: Add feature X",
    ].join("\n");
    const reflogFile = new File([reflogContent], "HEAD");
    Object.defineProperty(reflogFile, "webkitRelativePath", { value: "repo/.git/logs/HEAD" });

    const result = await readLocalGitRepo([headFile, branchFile, reflogFile]);
    expect(result).not.toBeNull();
    expect(result?.headBranch).toBe("main");
    expect(result?.headOid).toBe("1111111111111111111111111111111111111111");
    expect(result?.branches["main"]).toBe("1111111111111111111111111111111111111111");
    expect(result?.commits.length).toBe(2);

    const latest = result?.commits[0];
    expect(latest?.summary).toBe("Add feature X");
    expect(latest?.oid).toBe("1111111111111111111111111111111111111111");
    expect(latest?.branches).toContain("main");
    expect(latest?.isHead).toBe(true);

    const initial = result?.commits[1];
    expect(initial?.summary).toBe("Initial commit");
    expect(initial?.parents).toEqual([]);
  });

  it("flattens trees and computes file diffs between commits", () => {
    const trees = new Map<string, GitTreeEntry[]>([
      [
        "root1",
        [
          { name: "src", oid: "subtree1", mode: "040000", isDir: true },
          { name: "README.md", oid: "blob1", mode: "100644", isDir: false },
        ],
      ],
      [
        "subtree1",
        [{ name: "index.ts", oid: "blob2", mode: "100644", isDir: false }],
      ],
      [
        "root2",
        [
          { name: "src", oid: "subtree2", mode: "040000", isDir: true },
          { name: "README.md", oid: "blob1_mod", mode: "100644", isDir: false },
          { name: "LICENSE", oid: "blob3", mode: "100644", isDir: false },
        ],
      ],
      [
        "subtree2",
        [{ name: "index.ts", oid: "blob2", mode: "100644", isDir: false }],
      ],
    ]);

    const blobs = new Map<string, string>([
      ["blob1", "# Hello"],
      ["blob1_mod", "# Hello World"],
      ["blob2", "console.log(1);"],
      ["blob3", "MIT License"],
    ]);

    const flat1 = flattenTree("root1", trees);
    expect(flat1.get("src/index.ts")?.oid).toBe("blob2");
    expect(flat1.get("README.md")?.oid).toBe("blob1");

    const parentCommit: GitCommit = {
      oid: "p1",
      shortOid: "p1",
      tree: "root1",
      parents: [],
      author: { name: "Bob", email: "bob@example.com", timestamp: 100 },
      message: "Initial",
      summary: "Initial",
      branches: [],
    };

    const currentCommit: GitCommit = {
      oid: "c1",
      shortOid: "c1",
      tree: "root2",
      parents: ["p1"],
      author: { name: "Bob", email: "bob@example.com", timestamp: 200 },
      message: "Update README and add LICENSE",
      summary: "Update README and add LICENSE",
      branches: [],
    };

    const diffs = computeCommitDiffs(currentCommit, parentCommit, trees, blobs);
    expect(diffs.length).toBe(2);

    const licenseDiff = diffs.find((d) => d.path === "LICENSE");
    expect(licenseDiff?.status).toBe("added");
    expect(licenseDiff?.newContent).toBe("MIT License");
    expect(licenseDiff?.additions).toBe(1);
    expect(licenseDiff?.deletions).toBe(0);

    const readmeDiff = diffs.find((d) => d.path === "README.md");
    expect(readmeDiff?.status).toBe("modified");
    expect(readmeDiff?.oldContent).toBe("# Hello");
    expect(readmeDiff?.newContent).toBe("# Hello World");
    expect(readmeDiff?.additions).toBe(1);
    expect(readmeDiff?.deletions).toBe(1);
  });

  it("parses tags, remote origin URL, branch reflogs, and backslash paths", async () => {
    const headFile = new File(["ref: refs/heads/feat/ui\n"], "HEAD");
    Object.defineProperty(headFile, "webkitRelativePath", { value: "repo\\.git\\HEAD" });

    const configFile = new File(['[remote "origin"]\n\turl = https://github.com/acme/repo.git\n'], "config");
    Object.defineProperty(configFile, "webkitRelativePath", { value: "repo\\.git\\config" });

    const tagFile = new File(["2222222222222222222222222222222222222222\n"], "v1.0.0");
    Object.defineProperty(tagFile, "webkitRelativePath", { value: "repo/.git/refs/tags/v1.0.0" });

    const branchLog = new File(
      [
        "0000000000000000000000000000000000000000 2222222222222222222222222222222222222222 Dev <dev@acme.io> 1700005000 +0000\tcommit (initial): Ship v1",
      ],
      "ui"
    );
    Object.defineProperty(branchLog, "webkitRelativePath", { value: "repo/.git/logs/refs/heads/feat/ui" });

    const result = await readLocalGitRepo([headFile, configFile, tagFile, branchLog]);
    expect(result).not.toBeNull();
    expect(result?.headBranch).toBe("feat/ui");
    expect(result?.remoteUrl).toBe("https://github.com/acme/repo.git");
    expect(result?.tags?.["v1.0.0"]).toBe("2222222222222222222222222222222222222222");
    expect(result?.commits[0]?.branches).toContain("feat/ui");
  });
});
