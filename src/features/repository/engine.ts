// Pure repository operations. Nothing here touches React or storage.

import { commitText, hashBlob, hashCommit, hashTree, short } from "@/lib/git";
import type {
  BlobObject,
  ChangeKind,
  CommandResult,
  CommitObject,
  FileStatus,
  GitObject,
  ObjectId,
  RepositoryCommand,
  RepositoryState,
  TreeEntry,
  TreeObject,
} from "./types";

export const AUTHOR = "Ada Prism <ada@gitprism.dev>";

const encoder = new TextEncoder();

/* ------------------------------------------------------------------ */
/* Object writing                                                      */
/* ------------------------------------------------------------------ */

/** Content-addressed: writing identical content twice yields the same object. */
export function writeBlob(objects: Record<ObjectId, GitObject>, content: string): ObjectId {
  const oid = hashBlob(content);
  if (!objects[oid]) objects[oid] = { type: "blob", oid, content, size: encoder.encode(content).length };
  return oid;
}

/** Build nested tree objects from a flat path → blob map. Returns the root tree ID. */
export function writeTree(objects: Record<ObjectId, GitObject>, files: Record<string, ObjectId>): ObjectId {
  type Dir = { files: Record<string, ObjectId>; dirs: Record<string, Dir> };
  const root: Dir = { files: {}, dirs: {} };
  for (const [path, oid] of Object.entries(files)) {
    const parts = path.split("/");
    let dir = root;
    for (const p of parts.slice(0, -1)) dir = dir.dirs[p] ??= { files: {}, dirs: {} };
    dir.files[parts[parts.length - 1]] = oid;
  }
  const write = (dir: Dir): ObjectId => {
    const entries: TreeEntry[] = [
      ...Object.entries(dir.dirs).map(([name, d]) => ({ name, mode: "040000" as const, type: "tree" as const, oid: write(d) })),
      ...Object.entries(dir.files).map(([name, oid]) => ({ name, mode: "100644" as const, type: "blob" as const, oid })),
    ];
    const oid = hashTree(entries.map((e) => ({ mode: e.mode, name: e.name, oid: e.oid })));
    // Store entries in Git's order (as hashed) so displays match `git ls-tree`.
    const sorted = [...entries].sort((a, b) => {
      const an = a.type === "tree" ? a.name + "/" : a.name;
      const bn = b.type === "tree" ? b.name + "/" : b.name;
      return an < bn ? -1 : an > bn ? 1 : 0;
    });
    if (!objects[oid]) objects[oid] = { type: "tree", oid, entries: sorted };
    return oid;
  };
  return write(root);
}

export function writeCommit(
  objects: Record<ObjectId, GitObject>,
  input: { tree: ObjectId; parents: ObjectId[]; message: string; timestamp: number },
): ObjectId {
  const oid = hashCommit({ tree: input.tree, parents: input.parents, message: input.message, author: AUTHOR, time: input.timestamp });
  if (!objects[oid]) objects[oid] = { type: "commit", oid, author: AUTHOR, ...input };
  return oid;
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export function getCommit(state: RepositoryState, oid: ObjectId | null | undefined): CommitObject | null {
  const o = oid ? state.objects[oid] : undefined;
  return o?.type === "commit" ? o : null;
}

export function headCommitId(state: RepositoryState): ObjectId | null {
  return state.head.type === "symbolic" ? (state.branches[state.head.ref] ?? null) : state.head.oid;
}

export function currentBranch(state: RepositoryState): string | null {
  return state.head.type === "symbolic" ? state.head.ref : null;
}

/** Flatten a tree into path → blob ID. */
export function flattenTree(state: RepositoryState, treeOid: ObjectId | null, prefix = ""): Record<string, ObjectId> {
  const out: Record<string, ObjectId> = {};
  const tree = treeOid ? state.objects[treeOid] : undefined;
  if (!tree || tree.type !== "tree") return out;
  for (const e of tree.entries) {
    const path = prefix + e.name;
    if (e.type === "tree") Object.assign(out, flattenTree(state, e.oid, path + "/"));
    else out[path] = e.oid;
  }
  return out;
}

export function commitFiles(state: RepositoryState, commitOid: ObjectId | null): Record<string, ObjectId> {
  const c = getCommit(state, commitOid);
  return c ? flattenTree(state, c.tree) : {};
}

export function blobContent(state: RepositoryState, oid: ObjectId | undefined): string | null {
  const o = oid ? state.objects[oid] : undefined;
  return o?.type === "blob" ? o.content : null;
}

/** All commits reachable from any branch or HEAD, oldest first. */
export function reachableCommits(state: RepositoryState): CommitObject[] {
  const seen = new Map<ObjectId, CommitObject>();
  const walk = (oid: ObjectId) => {
    if (seen.has(oid)) return;
    const c = getCommit(state, oid);
    if (!c) return;
    seen.set(oid, c);
    c.parents.forEach(walk);
  };
  Object.values(state.branches).forEach(walk);
  const head = headCommitId(state);
  if (head) walk(head);
  return orderCommits([...seen.values()]);
}

/** Topological order (parents before children), ties broken by time. */
export function orderCommits(commits: CommitObject[]): CommitObject[] {
  const byId = new Map(commits.map((c) => [c.oid, c]));
  const out: CommitObject[] = [];
  const done = new Set<ObjectId>();
  const visit = (c: CommitObject) => {
    if (done.has(c.oid)) return;
    done.add(c.oid);
    c.parents.map((p) => byId.get(p)).filter(Boolean).forEach((p) => visit(p!));
    out.push(c);
  };
  [...commits].sort((a, b) => a.timestamp - b.timestamp).forEach(visit);
  return out;
}

export function ancestors(state: RepositoryState, oid: ObjectId): Set<ObjectId> {
  const seen = new Set<ObjectId>();
  const walk = (o: ObjectId) => {
    if (seen.has(o)) return;
    seen.add(o);
    getCommit(state, o)?.parents.forEach(walk);
  };
  walk(oid);
  return seen;
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export function fileStatuses(state: RepositoryState): FileStatus[] {
  const headFiles = commitFiles(state, headCommitId(state));
  const paths = new Set([...Object.keys(headFiles), ...Object.keys(state.index), ...Object.keys(state.worktree)]);
  const out: FileStatus[] = [];
  for (const path of [...paths].sort()) {
    const h = headFiles[path];
    const i = state.index[path];
    const w = path in state.worktree ? hashBlob(state.worktree[path]) : undefined;

    let staged: ChangeKind | null = null;
    if (!h && i) staged = "added";
    else if (h && !i) staged = "deleted";
    else if (h && i && h !== i) staged = "modified";

    let unstaged: FileStatus["unstaged"] = null;
    if (!i && w) unstaged = h ? "added" : "untracked";
    else if (i && !w) unstaged = "deleted";
    else if (i && w && i !== w) unstaged = "modified";

    out.push({ path, staged, unstaged });
  }
  return out;
}

export function hasChanges(state: RepositoryState) {
  return fileStatuses(state).some((s) => s.staged || s.unstaged);
}

/* ------------------------------------------------------------------ */
/* Commands                                                            */
/* ------------------------------------------------------------------ */

const validPath = (p: string) => /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(p) && !p.split("/").some((s) => s === "." || s === "..");

const clone = (s: RepositoryState): RepositoryState => ({
  ...s,
  worktree: { ...s.worktree },
  index: { ...s.index },
  objects: { ...s.objects },
  branches: { ...s.branches },
});

export function apply(prev: RepositoryState, cmd: RepositoryCommand): CommandResult {
  const s = clone(prev);
  switch (cmd.type) {
    case "EDIT_FILE": {
      if (!(cmd.path in s.worktree)) return { ok: false, error: `${cmd.path} doesn't exist in the working tree.` };
      s.worktree[cmd.path] = cmd.content;
      return {
        ok: true,
        state: s,
        event: {
          kind: "FILE_EDITED",
          title: `Edited ${cmd.path}`,
          detail: `The working tree changed. If staged now, this content would become blob ${short(hashBlob(cmd.content))}. No object has been written yet.`,
          objects: [],
        },
      };
    }
    case "CREATE_FILE": {
      const path = cmd.path.trim();
      if (!validPath(path)) return { ok: false, error: "Use a relative path made of letters, numbers, dots, dashes and slashes, like src/new.js." };
      if (path in s.worktree) return { ok: false, error: `${path} already exists.` };
      const clash = Object.keys(s.worktree).find((p) => p.startsWith(path + "/") || path.startsWith(p + "/"));
      if (clash) return { ok: false, error: `${path} would clash with ${clash}. A path can't be both a file and a folder.` };
      s.worktree[path] = cmd.content;
      return {
        ok: true,
        state: s,
        event: { kind: "FILE_CREATED", title: `Created ${path}`, detail: "The file exists only in the working tree. Git calls it untracked until you stage it.", objects: [] },
      };
    }
    case "RENAME_FILE": {
      const to = cmd.to.trim();
      if (!(cmd.from in s.worktree)) return { ok: false, error: `${cmd.from} doesn't exist.` };
      if (!validPath(to)) return { ok: false, error: "That isn't a valid path." };
      if (to in s.worktree) return { ok: false, error: `${to} already exists.` };
      s.worktree[to] = s.worktree[cmd.from];
      delete s.worktree[cmd.from];
      return {
        ok: true,
        state: s,
        event: {
          kind: "FILE_RENAMED",
          title: `Renamed ${cmd.from} to ${to}`,
          detail: "The content didn't change, so its blob ID stays the same. Only the name, which lives in a tree entry, is different.",
          objects: [],
        },
      };
    }
    case "DELETE_FILE": {
      if (!(cmd.path in s.worktree)) return { ok: false, error: `${cmd.path} doesn't exist.` };
      delete s.worktree[cmd.path];
      return {
        ok: true,
        state: s,
        event: {
          kind: "FILE_DELETED",
          title: `Deleted ${cmd.path}`,
          detail: "Removed from the working tree. Earlier commits still reference its blob, so history keeps it.",
          objects: [],
        },
      };
    }
    case "STAGE_PATHS": {
      if (!cmd.paths.length) return { ok: false, error: "Choose at least one file to stage." };
      const written: ObjectId[] = [];
      for (const p of cmd.paths) {
        if (p in s.worktree) {
          const oid = writeBlob(s.objects, s.worktree[p]);
          s.index[p] = oid;
          written.push(oid);
        } else if (p in s.index) delete s.index[p];
        else return { ok: false, error: `${p} has nothing to stage.` };
      }
      const names = cmd.paths.length === 1 ? cmd.paths[0] : `${cmd.paths.length} files`;
      return {
        ok: true,
        state: s,
        event: {
          kind: "PATHS_STAGED",
          title: `Staged ${names}`,
          detail: written.length
            ? `Staging wrote the content as blob ${written.map((o) => short(o)).join(", ")} and pointed the index at it. Nothing is committed yet.`
            : "The deletion is recorded in the index. The next commit's tree won't include this path.",
          objects: written,
        },
      };
    }
    case "UNSTAGE_PATHS": {
      const headFiles = commitFiles(s, headCommitId(s));
      for (const p of cmd.paths) {
        if (headFiles[p]) s.index[p] = headFiles[p];
        else delete s.index[p];
      }
      return {
        ok: true,
        state: s,
        event: {
          kind: "PATHS_UNSTAGED",
          title: `Unstaged ${cmd.paths.length === 1 ? cmd.paths[0] : `${cmd.paths.length} files`}`,
          detail: "The index entry went back to what the current commit has. Your working-tree edits are untouched.",
          objects: [],
        },
      };
    }
    case "RESTORE_PATHS": {
      const restored = cmd.paths.filter((p) => s.index[p]);
      if (!restored.length) return { ok: false, error: "Only files Git already tracks can be restored. Delete an untracked file instead." };
      for (const p of restored) s.worktree[p] = blobContent(s, s.index[p]) ?? "";
      return {
        ok: true,
        state: s,
        event: {
          kind: "PATHS_RESTORED",
          title: `Discarded changes to ${restored.length === 1 ? restored[0] : `${restored.length} files`}`,
          detail: "The working tree was rewritten from the blobs the index points at. Unstaged edits are gone.",
          objects: restored.map((p) => s.index[p]),
        },
      };
    }
    case "COMMIT": {
      const message = cmd.message.trim();
      if (!message) return { ok: false, error: "Write a commit message. It's how history explains why this snapshot exists." };
      const parent = headCommitId(s);
      const tree = writeTree(s.objects, s.index);
      const parentTree = getCommit(s, parent)?.tree;
      if (parent && parentTree === tree)
        return { ok: false, error: "Nothing is staged. The index matches the last commit, so a commit would record the same snapshot again." };
      const oid = writeCommit(s.objects, { tree, parents: parent ? [parent] : [], message, timestamp: cmd.timestamp });
      if (s.head.type === "symbolic") s.branches[s.head.ref] = oid;
      else s.head = { type: "detached", oid };
      const branch = currentBranch(s);
      return {
        ok: true,
        state: s,
        event: {
          kind: "COMMIT_CREATED",
          title: `Committed ${short(oid)}`,
          detail: `Git turned the index into tree ${short(tree)} and wrote commit ${short(oid)} pointing at it${
            parent ? ` and at its parent ${short(parent)}` : ""
          }.${branch ? ` The branch ${branch} moved forward to the new commit.` : ""}`,
          objects: [oid, tree],
        },
      };
    }
    case "CREATE_BRANCH": {
      const name = cmd.name.trim();
      if (!/^[A-Za-z0-9._/-]+$/.test(name) || name.endsWith("/") || name.includes("..")) return { ok: false, error: "Branch names can use letters, numbers, dots, dashes and slashes." };
      if (s.branches[name]) return { ok: false, error: `A branch called ${name} already exists.` };
      if (!getCommit(s, cmd.at)) return { ok: false, error: "Pick a commit to start the branch from." };
      s.branches[name] = cmd.at;
      return {
        ok: true,
        state: s,
        event: {
          kind: "BRANCH_CREATED",
          title: `Created branch ${name}`,
          detail: `A branch is only a name pointing at a commit. ${name} now points at ${short(cmd.at)}. No files were copied.`,
          objects: [cmd.at],
        },
      };
    }
    case "SWITCH_BRANCH": {
      const target = s.branches[cmd.name];
      if (!target) return { ok: false, error: `There's no branch called ${cmd.name}.` };
      if (currentBranch(s) === cmd.name) return { ok: false, error: `You're already on ${cmd.name}.` };
      if (hasChanges(s)) return { ok: false, error: "Commit or discard your changes first. Switching would overwrite the working tree." };
      const files = commitFiles(s, target);
      s.index = { ...files };
      s.worktree = Object.fromEntries(Object.entries(files).map(([p, o]) => [p, blobContent(s, o) ?? ""]));
      s.head = { type: "symbolic", ref: cmd.name };
      return {
        ok: true,
        state: s,
        event: {
          kind: "BRANCH_SWITCHED",
          title: `Switched to ${cmd.name}`,
          detail: `HEAD now refers to ${cmd.name}, so the working tree and index were rebuilt from commit ${short(target)}.`,
          objects: [target],
        },
      };
    }
  }
}

/** Raw object body, formatted like `git cat-file -p`. */
export function catFile(obj: GitObject): string {
  switch (obj.type) {
    case "blob":
      return obj.content;
    case "tree":
      return obj.entries.map((e) => `${e.mode} ${e.type} ${e.oid}\t${e.name}`).join("\n");
    case "commit":
      return commitText({ tree: obj.tree, parents: obj.parents, message: obj.message, author: obj.author, time: obj.timestamp });
  }
}

/** Every (commit, path) that references a blob or tree. */
export function referencesTo(state: RepositoryState, oid: ObjectId): { commit: ObjectId; path: string }[] {
  const out: { commit: ObjectId; path: string }[] = [];
  for (const c of reachableCommits(state)) {
    const walk = (treeOid: ObjectId, prefix: string) => {
      const t = state.objects[treeOid] as TreeObject | undefined;
      if (!t || t.type !== "tree") return;
      for (const e of t.entries) {
        const path = prefix + e.name;
        if (e.oid === oid) out.push({ commit: c.oid, path: e.type === "tree" ? path + "/" : path });
        if (e.type === "tree") walk(e.oid, path + "/");
      }
    };
    if (c.tree === oid) out.push({ commit: c.oid, path: "/" });
    walk(c.tree, "");
  }
  return out;
}

export function isBlob(o: GitObject | undefined): o is BlobObject {
  return o?.type === "blob";
}
