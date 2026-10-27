import { describe, expect, it } from "vitest";
import { readLocalGitRepo } from "@/features/upload/git-reader";

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
});
