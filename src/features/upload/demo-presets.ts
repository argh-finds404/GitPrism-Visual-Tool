/**
 * Built-in demo repositories for instant evaluation in GitPrism.
 *
 * Provides ready-to-inspect repositories with multi-branch commit DAGs,
 * diffs, AST dependency graphs, and test coverage so reviewers and users
 * can explore GitPrism immediately without choosing a local folder.
 */

import { fixtureHistory, FIXTURE } from "@/features/impact-analysis/fixture";
import type { GitCommit, GitContributor, GitFileDiff, ParsedGitRepo } from "./git-reader";

export type DemoPreset = {
  id: "acme-shop" | "prism-core";
  name: string;
  tagline: string;
  description: string;
  branchCount: number;
  commitCount: number;
  files: Record<string, string>;
  gitRepo: ParsedGitRepo;
};

function computeDiff(oldFiles: Record<string, string>, newFiles: Record<string, string>): GitFileDiff[] {
  const diffs: GitFileDiff[] = [];
  const allPaths = new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)]);

  for (const path of allPaths) {
    const oldC = oldFiles[path];
    const newC = newFiles[path];

    if (oldC === undefined && newC !== undefined) {
      const lines = newC.split("\n").length;
      diffs.push({ path, status: "added", newContent: newC, additions: lines, deletions: 0 });
    } else if (oldC !== undefined && newC === undefined) {
      const lines = oldC.split("\n").length;
      diffs.push({ path, status: "deleted", oldContent: oldC, additions: 0, deletions: lines });
    } else if (oldC !== newC) {
      const oldLines = oldC.split("\n").length;
      const newLines = newC.split("\n").length;
      const adds = Math.max(1, newLines - oldLines + 2);
      const dels = Math.max(1, oldLines - newLines + 1);
      diffs.push({
        path,
        status: "modified",
        oldContent: oldC,
        newContent: newC,
        additions: adds,
        deletions: dels,
      });
    }
  }

  return diffs;
}

function parseAuthor(authorStr: string, timestamp: number) {
  const match = authorStr.match(/^(.*?)\s*<(.*?)>$/);
  return {
    name: match ? match[1].trim() : authorStr,
    email: match ? match[2].trim() : "developer@acme-shop.dev",
    timestamp,
  };
}

export function getAcmeShopDemoPreset(): DemoPreset {
  const fx = fixtureHistory();
  const commitsByOid = new Map<string, GitCommit>();
  const contributorMap = new Map<string, GitContributor>();

  // fx.all has main commits then PR commits
  const allRaw = [...fx.all, ...fx.incoming];

  const parsedCommits: GitCommit[] = [];

  for (let i = 0; i < allRaw.length; i++) {
    const raw = allRaw[i];
    const author = parseAuthor(raw.author, raw.timestamp);

    // Track contributor
    const existing = contributorMap.get(author.name) ?? {
      name: author.name,
      email: author.email,
      commitCount: 0,
    };
    existing.commitCount++;
    contributorMap.set(author.name, existing);

    // Compute diff against primary parent if available
    let diffs: GitFileDiff[] = [];
    let additions = 0;
    let deletions = 0;

    if (raw.parents.length > 0) {
      const parentRaw = allRaw.find((c) => c.oid === raw.parents[0]);
      if (parentRaw) {
        diffs = computeDiff(parentRaw.files, raw.files);
        diffs.forEach((d) => {
          additions += d.additions ?? 0;
          deletions += d.deletions ?? 0;
        });
      }
    } else {
      diffs = computeDiff({}, raw.files);
      diffs.forEach((d) => (additions += d.additions ?? 0));
    }

    const branches: string[] = [];
    if (raw.lane) branches.push(raw.lane);
    if (raw.oid === fx.base.oid) branches.push("main");

    const commitObj: GitCommit = {
      oid: raw.oid,
      shortOid: raw.oid.slice(0, 7),
      tree: `tree_${raw.oid.slice(0, 8)}`,
      treeEntries: Object.keys(raw.files).map((p) => ({
        mode: "100644",
        name: p,
        oid: `blob_${p.replace(/[^a-zA-Z0-9]/g, "_")}`,
        isDir: false,
      })),
      parents: raw.parents,
      author,
      committer: author,
      message: raw.message,
      summary: raw.message.split("\n")[0],
      branches,
      diffs,
      additions,
      deletions,
    };

    commitsByOid.set(commitObj.oid, commitObj);
    parsedCommits.push(commitObj);
  }

  // Sort descending by timestamp (newest first)
  parsedCommits.sort((a, b) => b.author.timestamp - a.author.timestamp);

  const headCommit = parsedCommits[0];
  const contributors = Array.from(contributorMap.values()).sort(
    (a, b) => b.commitCount - a.commitCount
  );

  const branchesRecord: Record<string, string> = {
    main: fx.base.oid,
    [FIXTURE.source]: fx.commits[fx.commits.length - 1]?.oid || fx.base.oid,
    [FIXTURE.incoming]: fx.incoming[fx.incoming.length - 1]?.oid || fx.base.oid,
  };

  const gitRepo: ParsedGitRepo = {
    name: "acme-shop",
    headBranch: "main",
    headOid: headCommit?.oid || fx.base.oid,
    branches: branchesRecord,
    commits: parsedCommits,
    commitsByOid,
    contributors,
    totalCommits: parsedCommits.length,
    treesByOid: new Map(),
    blobsByOid: new Map(),
  };

  return {
    id: "acme-shop",
    name: "acme-shop",
    tagline: "E-Commerce Monorepo with Concurrent Feature Branches",
    description:
      "A complete storefront featuring session management, auth token rotation, and competing branches with real Git commit hashes.",
    branchCount: Object.keys(branchesRecord).length,
    commitCount: parsedCommits.length,
    files: fx.base.files,
    gitRepo,
  };
}

export function getPrismCoreDemoPreset(): DemoPreset {
  const baseFiles: Record<string, string> = {
    "README.md": "# Prism Core Microkernel\n\nA lightweight, acyclic TypeScript microkernel architecture.\n",
    "src/index.ts": `import { Kernel } from "./core/kernel";
import { Logger } from "./infra/logger";

export function boot() {
  const logger = new Logger("boot");
  const kernel = new Kernel(logger);
  return kernel.start();
}
`,
    "src/core/kernel.ts": `import { Logger } from "../infra/logger";
import { EventBus } from "../infra/events";

export class Kernel {
  private events = new EventBus();
  constructor(private logger: Logger) {}

  start() {
    this.logger.info("Kernel initialized");
    this.events.emit("ready");
    return { status: "running", uptime: 0 };
  }
}
`,
    "src/infra/logger.ts": `export class Logger {
  constructor(private context: string) {}
  info(msg: string) { return \`[\${this.context}] \${msg}\`; }
}
`,
    "src/infra/events.ts": `export class EventBus {
  private listeners = new Map<string, (() => void)[]>();
  on(event: string, cb: () => void) {
    const list = this.listeners.get(event) ?? [];
    list.push(cb);
    this.listeners.set(event, list);
  }
  emit(event: string) {
    this.listeners.get(event)?.forEach((cb) => cb());
  }
}
`,
    "tests/kernel.test.ts": `import { Kernel } from "../src/core/kernel";
import { Logger } from "../src/infra/logger";

test("kernel starts cleanly", () => {
  const k = new Kernel(new Logger("test"));
  expect(k.start().status).toBe("running");
});
`,
  };

  const now = 1767225600;
  const authorAda = { name: "Ada Prism", email: "ada@gitprism.dev", timestamp: now };
  const authorLin = { name: "Lin Okafor", email: "lin@gitprism.dev", timestamp: now - 3600 };

  const c1: GitCommit = {
    oid: "a1b2c3d4e5f678901234567890abcdef12345678",
    shortOid: "a1b2c3d",
    tree: "tree_init",
    parents: [],
    author: authorLin,
    message: "feat(core): initial microkernel layout and event bus",
    summary: "feat(core): initial microkernel layout and event bus",
    branches: ["main"],
    diffs: computeDiff({}, baseFiles),
    additions: 45,
    deletions: 0,
  };

  const c2: GitCommit = {
    oid: "f9e8d7c6b5a432109876543210fedcba98765432",
    shortOid: "f9e8d7c",
    tree: "tree_test",
    parents: [c1.oid],
    author: authorAda,
    message: "test(kernel): add automated boot lifecycle verification",
    summary: "test(kernel): add automated boot lifecycle verification",
    branches: ["main"],
    diffs: [
      {
        path: "tests/kernel.test.ts",
        status: "added",
        newContent: baseFiles["tests/kernel.test.ts"],
        additions: 8,
        deletions: 0,
      },
    ],
    additions: 8,
    deletions: 0,
  };

  const commits = [c2, c1];
  const commitsByOid = new Map<string, GitCommit>([
    [c1.oid, c1],
    [c2.oid, c2],
  ]);

  const gitRepo: ParsedGitRepo = {
    name: "prism-core",
    headBranch: "main",
    headOid: c2.oid,
    branches: { main: c2.oid },
    commits,
    commitsByOid,
    contributors: [
      { name: "Ada Prism", email: "ada@gitprism.dev", commitCount: 1 },
      { name: "Lin Okafor", email: "lin@gitprism.dev", commitCount: 1 },
    ],
    totalCommits: 2,
    treesByOid: new Map(),
    blobsByOid: new Map(),
  };

  return {
    id: "prism-core",
    name: "prism-core",
    tagline: "Acyclic TypeScript Microkernel Architecture",
    description:
      "A clean acyclic dependency architecture with 100% test coverage and zero circular import hazards.",
    branchCount: 1,
    commitCount: 2,
    files: baseFiles,
    gitRepo,
  };
}

export function getAllDemoPresets(): DemoPreset[] {
  return [getAcmeShopDemoPreset(), getPrismCoreDemoPreset()];
}
