import { describe, expect, it } from "vitest";
import { apply, getCommit, reachableCommits } from "@/features/repository/engine";
import { createSampleRepository, SAMPLE_TIME } from "@/features/repository/sample";
import { buildHistoryGraph, buildObjectGraph, buildRefractionGraph, pathToObject } from "@/lib/graph/build-graph";
import { challenges } from "@/features/repository/challenges";

const repo = createSampleRepository();

describe("history graph", () => {
  it("has one node per reachable commit and one edge per real parent link", () => {
    const g = buildHistoryGraph(repo);
    const commits = reachableCommits(repo);
    expect(g.nodes.filter((n) => n.kind === "commit")).toHaveLength(commits.length);
    const parentEdges = g.edges.filter((e) => e.kind === "parent");
    const realLinks = commits.flatMap((c) => c.parents.map((p) => `${c.oid}->${p}`));
    expect(parentEdges.map((e) => e.id).sort()).toEqual(realLinks.sort());
  });

  it("labels each branch at its tip and HEAD at the current branch", () => {
    const g = buildHistoryGraph(repo);
    for (const [b, tip] of Object.entries(repo.branches)) {
      expect(g.edges.find((e) => e.source === `ref:${b}`)?.target).toBe(tip);
    }
    expect(g.edges.find((e) => e.source === "HEAD")?.target).toBe("ref:main");
  });

  it("filters to one branch's ancestry", () => {
    const g = buildHistoryGraph(repo, { branches: ["feature/shout"] });
    expect(g.nodes.filter((n) => n.kind === "commit").map((n) => n.label)).toEqual(["Initial commit", "Add app.js", "Add shout helper"]);
  });
});

describe("object graph", () => {
  it("shows a shared blob once with an edge from every path", () => {
    let s = apply(repo, { type: "CREATE_FILE", path: "docs/README.md", content: repo.worktree["README.md"] });
    if (!s.ok) throw new Error(s.error);
    let st = s.state;
    for (const cmd of [
      { type: "STAGE_PATHS" as const, paths: ["docs/README.md"] },
      { type: "COMMIT" as const, message: "Copy", timestamp: SAMPLE_TIME + 9000 },
    ]) {
      s = apply(st, cmd);
      if (!s.ok) throw new Error(s.error);
      st = s.state;
    }
    const g = buildObjectGraph(st, st.branches.main);
    const blob = repo.index["README.md"];
    expect(g.nodes.filter((n) => n.oid === blob)).toHaveLength(1);
    expect(g.edges.filter((e) => e.target === blob)).toHaveLength(2);
  });

  it("refraction keeps history and adds the opened commit's tree", () => {
    const head = repo.branches.main;
    const g = buildRefractionGraph(repo, head);
    const tree = getCommit(repo, head)!.tree;
    expect(g.nodes.some((n) => n.id === `r:${tree}`)).toBe(true);
    expect(g.edges.some((e) => e.source === head && e.target === `r:${tree}`)).toBe(true);
  });

  it("traces a path from a commit down to a blob", () => {
    const head = repo.branches.main;
    const blob = repo.index["src/utils/format.js"];
    const path = pathToObject(repo, head, blob)!;
    expect(path[0]).toBe(head);
    expect(path.at(-1)).toBe(blob);
    expect(path).toHaveLength(5); // commit, root tree, src, utils, blob
  });
});

describe("challenges", () => {
  it("none are complete in the untouched sample", () => {
    expect(challenges.filter((c) => c.done({ state: repo, selectedOid: null, commands: [] }))).toEqual([]);
  });
});
