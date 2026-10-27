import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { apply, commitFiles, fileStatuses, getCommit, headCommitId, referencesTo } from "@/features/repository/engine";
import { createSampleRepository, emptyRepository, runAll, SAMPLE_TIME } from "@/features/repository/sample";
import { buildSteps } from "@/features/repository/session";
import { validatePersisted } from "@/features/repository/storage";
import type { RepositoryCommand, RepositoryState } from "@/features/repository/types";
import { hashBlob } from "@/lib/git";

const must = (s: RepositoryState, cmd: RepositoryCommand) => {
  const r = apply(s, cmd);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

/* ------------------------------------------------------------------ */
/* Compatibility with real Git                                         */
/* ------------------------------------------------------------------ */

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function gitAvailable() {
  try {
    execFileSync("git", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

describe.runIf(gitAvailable())("matches real git", () => {
  it("produces the same tree and commit IDs for every commit on main", () => {
    const repo = createSampleRepository();
    const dir = mkdtempSync(join(tmpdir(), "gitprism-"));
    dirs.push(dir);
    const git = (args: string[], env: Record<string, string> = {}, input?: string) =>
      execFileSync("git", ["-c", "core.autocrlf=false", ...args], { cwd: dir, env: { ...process.env, ...env }, input })
        .toString()
        .trim();
    git(["init", "-q"]);

    // Walk main's first-parent chain from the root and recreate each snapshot with real git.
    const chain = [];
    for (let c = getCommit(repo, repo.branches.main); c; c = getCommit(repo, c.parents[0])) chain.unshift(c);
    expect(chain.map((c) => c.message)).toEqual(["Initial commit", "Add app.js", "Update README"]);

    for (const commit of chain) {
      rmSync(join(dir, "src"), { recursive: true, force: true });
      for (const f of ["README.md", "package.json"]) rmSync(join(dir, f), { force: true });
      for (const [path, oid] of Object.entries(commitFiles(repo, commit.oid))) {
        mkdirSync(join(dir, dirname(path)), { recursive: true });
        writeFileSync(join(dir, path), (repo.objects[oid] as { content: string }).content);
      }
      git(["add", "-A"]);
      const tree = git(["write-tree"]);
      expect(tree).toBe(commit.tree);

      const when = `${commit.timestamp} +0000`;
      const id = { NAME: "Ada Prism", EMAIL: "ada@gitprism.dev" };
      const oid = git(
        ["commit-tree", tree, ...commit.parents.flatMap((p) => ["-p", p])],
        {
          GIT_AUTHOR_NAME: id.NAME,
          GIT_AUTHOR_EMAIL: id.EMAIL,
          GIT_AUTHOR_DATE: when,
          GIT_COMMITTER_NAME: id.NAME,
          GIT_COMMITTER_EMAIL: id.EMAIL,
          GIT_COMMITTER_DATE: when,
        },
        `${commit.message}\n`,
      );
      expect(oid).toBe(commit.oid);
    }
  });

  it("hashes blobs like git hash-object", () => {
    const out = execFileSync("git", ["hash-object", "--stdin"], { input: "Hello GitPrism!\n" }).toString().trim();
    expect(hashBlob("Hello GitPrism!\n")).toBe(out);
  });
});

/* ------------------------------------------------------------------ */
/* Domain rules                                                        */
/* ------------------------------------------------------------------ */

describe("sample repository", () => {
  it("is deterministic", () => {
    const a = createSampleRepository();
    expect(Object.keys(a.branches).sort()).toEqual(["feature/shout", "main"]);
    expect(getCommit(a, a.branches.main)!.message).toBe("Update README");
    expect(fileStatuses(a).every((s) => !s.staged && !s.unstaged)).toBe(true);
  });
});

describe("staging and committing", () => {
  const base = createSampleRepository();

  it("editing only changes the working tree", () => {
    const s = must(base, { type: "EDIT_FILE", path: "src/app.js", content: "changed\n" });
    expect(s.index["src/app.js"]).toBe(base.index["src/app.js"]);
    expect(fileStatuses(s).find((f) => f.path === "src/app.js")).toEqual({ path: "src/app.js", staged: null, unstaged: "modified" });
  });

  it("staging writes a blob and updates the index without committing", () => {
    let s = must(base, { type: "EDIT_FILE", path: "src/app.js", content: "changed\n" });
    s = must(s, { type: "STAGE_PATHS", paths: ["src/app.js"] });
    expect(s.index["src/app.js"]).toBe(hashBlob("changed\n"));
    expect(s.objects[hashBlob("changed\n")]?.type).toBe("blob");
    expect(headCommitId(s)).toBe(headCommitId(base));
  });

  it("commits the index, not the working tree", () => {
    let s = must(base, { type: "EDIT_FILE", path: "src/app.js", content: "staged\n" });
    s = must(s, { type: "STAGE_PATHS", paths: ["src/app.js"] });
    s = must(s, { type: "EDIT_FILE", path: "src/app.js", content: "not staged\n" });
    s = must(s, { type: "COMMIT", message: "Change app", timestamp: SAMPLE_TIME + 9000 });
    const files = commitFiles(s, headCommitId(s));
    expect(files["src/app.js"]).toBe(hashBlob("staged\n"));
    expect(fileStatuses(s).find((f) => f.path === "src/app.js")?.unstaged).toBe("modified");
  });

  it("links the new commit to its parent and advances the branch", () => {
    let s = must(base, { type: "EDIT_FILE", path: "README.md", content: "# hi\n" });
    s = must(s, { type: "STAGE_PATHS", paths: ["README.md"] });
    s = must(s, { type: "COMMIT", message: "Shorter README", timestamp: SAMPLE_TIME + 9000 });
    const c = getCommit(s, s.branches.main)!;
    expect(c.parents).toEqual([base.branches.main]);
    expect(s.branches["feature/shout"]).toBe(base.branches["feature/shout"]);
  });

  it("refuses an empty message and an empty commit", () => {
    expect(apply(base, { type: "COMMIT", message: "  ", timestamp: 1 }).ok).toBe(false);
    const r = apply(base, { type: "COMMIT", message: "Nothing", timestamp: 1 });
    expect(r.ok).toBe(false);
  });

  it("drops a deleted file from the next tree once the deletion is committed", () => {
    let s = must(base, { type: "DELETE_FILE", path: "package.json" });
    expect(fileStatuses(s).find((f) => f.path === "package.json")?.unstaged).toBe("deleted");
    s = must(s, { type: "STAGE_PATHS", paths: ["package.json"] });
    expect(fileStatuses(s).find((f) => f.path === "package.json")?.staged).toBe("deleted");
    s = must(s, { type: "COMMIT", message: "Remove package.json", timestamp: SAMPLE_TIME + 9000 });
    expect(commitFiles(s, headCommitId(s))["package.json"]).toBeUndefined();
    expect(commitFiles(s, base.branches.main)["package.json"]).toBeDefined();
  });

  it("unstaging restores the committed entry and keeps edits", () => {
    let s = must(base, { type: "EDIT_FILE", path: "README.md", content: "x\n" });
    s = must(s, { type: "STAGE_PATHS", paths: ["README.md"] });
    s = must(s, { type: "UNSTAGE_PATHS", paths: ["README.md"] });
    expect(s.index["README.md"]).toBe(base.index["README.md"]);
    expect(s.worktree["README.md"]).toBe("x\n");
  });
});

describe("content addressing", () => {
  it("reuses one blob for identical content at different paths", () => {
    let s = must(createSampleRepository(), { type: "CREATE_FILE", path: "docs/copy.md", content: createSampleRepository().worktree["README.md"] });
    s = must(s, { type: "STAGE_PATHS", paths: ["docs/copy.md"] });
    s = must(s, { type: "COMMIT", message: "Copy README", timestamp: SAMPLE_TIME + 9000 });
    const files = commitFiles(s, headCommitId(s));
    expect(files["docs/copy.md"]).toBe(files["README.md"]);
    const refs = referencesTo(s, files["README.md"]).filter((r) => r.commit === headCommitId(s));
    expect(refs.map((r) => r.path).sort()).toEqual(["README.md", "docs/copy.md"]);
  });

  it("keeps the blob ID when a file is only renamed", () => {
    const base = createSampleRepository();
    const s = must(base, { type: "RENAME_FILE", from: "src/app.js", to: "src/main.js" });
    expect(hashBlob(s.worktree["src/main.js"])).toBe(base.index["src/app.js"]);
  });
});

describe("branches", () => {
  it("won't switch with uncommitted changes", () => {
    const s = must(createSampleRepository(), { type: "EDIT_FILE", path: "README.md", content: "x\n" });
    expect(apply(s, { type: "SWITCH_BRANCH", name: "feature/shout" }).ok).toBe(false);
  });

  it("rebuilds the working tree from the branch tip", () => {
    const s = must(createSampleRepository(), { type: "SWITCH_BRANCH", name: "feature/shout" });
    expect(s.worktree["src/utils/format.js"]).toContain("shout");
    expect(s.worktree["README.md"]).not.toContain("Run it");
  });

  it("creating a branch copies no files", () => {
    const base = createSampleRepository();
    const s = must(base, { type: "CREATE_BRANCH", name: "experiment", at: base.branches.main });
    expect(Object.keys(s.objects).length).toBe(Object.keys(base.objects).length);
  });
});

describe("session replay and storage", () => {
  it("rebuilds the same states from saved commands and drops invalid ones", () => {
    const cmds: RepositoryCommand[] = [
      { type: "EDIT_FILE", path: "README.md", content: "y\n" },
      { type: "COMMIT", message: "nothing staged", timestamp: 1 },
      { type: "STAGE_PATHS", paths: ["README.md"] },
      { type: "COMMIT", message: "ok", timestamp: SAMPLE_TIME + 9000 },
    ];
    const a = buildSteps(cmds);
    const b = buildSteps(a.valid);
    expect(a.valid).toHaveLength(3);
    expect(headCommitId(a.steps.at(-1)!.state)).toBe(headCommitId(b.steps.at(-1)!.state));
  });

  it("rejects malformed saved data", () => {
    expect(validatePersisted({ version: 2 })).toBeNull();
    expect(validatePersisted({ version: 1, commands: [{ type: "HACK" }], completedChallenges: [] })).toBeNull();
    expect(validatePersisted({ version: 1, commands: [], completedChallenges: [], savedAt: 1 })).not.toBeNull();
  });

  it("builds nested trees for subdirectories", () => {
    const s = runAll(emptyRepository(), [
      { type: "CREATE_FILE", path: "a/b/c.txt", content: "c\n" },
      { type: "STAGE_PATHS", paths: ["a/b/c.txt"] },
      { type: "COMMIT", message: "nested", timestamp: SAMPLE_TIME },
    ]);
    expect(commitFiles(s, headCommitId(s))).toEqual({ "a/b/c.txt": hashBlob("c\n") });
  });
});
