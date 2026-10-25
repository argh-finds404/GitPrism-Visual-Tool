// Repository domain model for the GitPrism lab.
//
// GitPrism is an educational simulator, not a full Git implementation. What is
// real: blob, tree and commit objects are encoded exactly as Git encodes them,
// so every object ID matches `git hash-object`. What is simulated: the working
// tree and index live in memory, there is no packing, merging or remote.

export type ObjectId = string;

export type BlobObject = {
  type: "blob";
  oid: ObjectId;
  content: string;
  size: number;
};

export type TreeEntry = {
  name: string;
  mode: "100644" | "040000";
  type: "blob" | "tree";
  oid: ObjectId;
};

export type TreeObject = {
  type: "tree";
  oid: ObjectId;
  entries: TreeEntry[];
};

export type CommitObject = {
  type: "commit";
  oid: ObjectId;
  tree: ObjectId;
  parents: ObjectId[];
  message: string;
  author: string;
  /** Unix seconds */
  timestamp: number;
};

export type GitObject = BlobObject | TreeObject | CommitObject;

export type Head = { type: "symbolic"; ref: string } | { type: "detached"; oid: ObjectId };

export type RepositoryState = {
  name: string;
  /** Working tree: path → text content. */
  worktree: Record<string, string>;
  /** Index (staging area): path → blob ID. */
  index: Record<string, ObjectId>;
  /** Immutable object store, keyed by object ID. */
  objects: Record<ObjectId, GitObject>;
  /** Branch name → commit ID. */
  branches: Record<string, ObjectId>;
  head: Head;
};

/** Commands are the only way repository state changes. */
export type RepositoryCommand =
  | { type: "EDIT_FILE"; path: string; content: string }
  | { type: "CREATE_FILE"; path: string; content: string }
  | { type: "RENAME_FILE"; from: string; to: string }
  | { type: "DELETE_FILE"; path: string }
  | { type: "STAGE_PATHS"; paths: string[] }
  | { type: "UNSTAGE_PATHS"; paths: string[] }
  | { type: "RESTORE_PATHS"; paths: string[] }
  /** `author` defaults to the lab's author; fixtures use it to model other contributors. */
  | { type: "COMMIT"; message: string; timestamp: number; author?: string }
  | { type: "CREATE_BRANCH"; name: string; at: ObjectId }
  | { type: "SWITCH_BRANCH"; name: string };

/** An application event (not a Git object): what a command did, in plain words. */
export type RepositoryEvent = {
  kind: "FILE_EDITED" | "FILE_CREATED" | "FILE_RENAMED" | "FILE_DELETED" | "PATHS_STAGED" | "PATHS_UNSTAGED" | "PATHS_RESTORED" | "COMMIT_CREATED" | "BRANCH_CREATED" | "BRANCH_SWITCHED";
  title: string;
  detail: string;
  /** Objects the event created or points at, for highlighting. */
  objects: ObjectId[];
};

export type CommandResult = { ok: true; state: RepositoryState; event: RepositoryEvent } | { ok: false; error: string };

export type ChangeKind = "added" | "modified" | "deleted";

export type FileStatus = {
  path: string;
  /** Index compared with HEAD: what the next commit would change. */
  staged: ChangeKind | null;
  /** Working tree compared with index: what is not staged yet. "untracked" = not in index or HEAD. */
  unstaged: ChangeKind | "untracked" | null;
};
