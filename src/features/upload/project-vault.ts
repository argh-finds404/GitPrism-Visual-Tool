import type { GitCommit, GitContributor, GitTreeEntry, ParsedGitRepo } from "./git-reader";

export type StoredProject = {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  fileCount: number;
  totalBytes: number;
  files: Record<string, string>; // Complete uncompressed files: path -> content
  gitRepo?: {
    name: string;
    headBranch: string;
    headOid: string;
    branches: Record<string, string>;
    commits: GitCommit[];
    totalCommits: number;
    contributors: GitContributor[];
    timeSpan?: { first: number; latest: number };
    blobsByOid?: [string, string][];
  } | null;
};

export type StoredProjectSummary = {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  fileCount: number;
  totalBytes: number;
  commitCount: number;
  headBranch?: string;
  topAuthor?: string;
};

const DB_NAME = "gitprism_vault";
const STORE_NAME = "projects";
const LAST_ACTIVE_KEY = "gitprism_last_active_project_id";

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB unavailable"));
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function vaultTx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openVaultDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_NAME, mode);
    const req = fn(t.objectStore(STORE_NAME));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export function serializeGitRepo(repo: ParsedGitRepo | null | undefined) {
  if (!repo) return null;
  return {
    name: repo.name,
    headBranch: repo.headBranch,
    headOid: repo.headOid,
    branches: repo.branches,
    commits: repo.commits,
    totalCommits: repo.totalCommits,
    contributors: repo.contributors,
    timeSpan: repo.timeSpan,
    blobsByOid: Array.from(repo.blobsByOid?.entries() || []),
  };
}

export function rehydrateGitRepo(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serialized: any
): ParsedGitRepo | null {
  if (!serialized || !serialized.commits) return null;
  const commitsByOid = new Map<string, GitCommit>();
  const treesByOid = new Map<string, GitTreeEntry[]>();
  const blobsByOid = new Map<string, string>(serialized.blobsByOid || []);

  for (const c of serialized.commits as GitCommit[]) {
    commitsByOid.set(c.oid, c);
    if (c.tree && c.treeEntries) {
      treesByOid.set(c.tree, c.treeEntries);
    }
  }

  return {
    name: serialized.name || "project",
    headBranch: serialized.headBranch || "main",
    headOid: serialized.headOid || "",
    branches: serialized.branches || {},
    commits: serialized.commits,
    commitsByOid,
    contributors: serialized.contributors || [],
    totalCommits: serialized.totalCommits || serialized.commits.length,
    treesByOid,
    blobsByOid,
    timeSpan: serialized.timeSpan,
  };
}

/** Save an uploaded project and its uncompressed files and git history into the vault */
export async function saveProjectToVault(project: StoredProject): Promise<void> {
  try {
    await vaultTx("readwrite", (s) => s.put(project));
    setLastActiveProjectId(project.id);
  } catch (err) {
    console.warn("Could not save project to vault:", err);
  }
}

/** Retrieve all saved projects as lightweight summaries for the project switcher */
export async function listProjectsInVault(userId?: string): Promise<StoredProjectSummary[]> {
  try {
    const db = await openVaultDb();
    return new Promise((resolve) => {
      const t = db.transaction(STORE_NAME, "readonly");
      const store = t.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const raw = req.result as StoredProject[];
        const summaries: StoredProjectSummary[] = (raw || [])
          .filter((p) => !userId || p.userId === userId)
          .map((p) => ({
            id: p.id,
            userId: p.userId,
            name: p.name,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            fileCount: p.fileCount,
            totalBytes: p.totalBytes,
            commitCount: p.gitRepo?.totalCommits ?? 0,
            headBranch: p.gitRepo?.headBranch,
            topAuthor: p.gitRepo?.contributors?.[0]?.name,
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(summaries);
      };
      req.onerror = () => resolve([]);
      t.oncomplete = () => db.close();
    });
  } catch {
    return [];
  }
}

/** Fetch full uncompressed project data by ID */
export async function getProjectFromVault(id: string): Promise<StoredProject | null> {
  try {
    const res = await vaultTx<StoredProject | undefined>("readonly", (s) => s.get(id));
    return res || null;
  } catch {
    return null;
  }
}

/** Delete a project from the vault */
export async function deleteProjectFromVault(id: string): Promise<void> {
  try {
    await vaultTx("readwrite", (s) => s.delete(id));
    if (getLastActiveProjectId() === id) {
      setLastActiveProjectId(null);
    }
  } catch {
    // ignore
  }
}

export function getLastActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LAST_ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setLastActiveProjectId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) {
      localStorage.setItem(LAST_ACTIVE_KEY, id);
    } else {
      localStorage.removeItem(LAST_ACTIVE_KEY);
    }
  } catch {
    // ignore
  }
}

/**
 * Downloads the full uncompressed project workspace as a portable `.gitprism.json` bundle.
 * Future developers can send this file to teammates or load it back instantly.
 */
export function downloadProjectBundle(project: StoredProject): void {
  if (typeof window === "undefined") return;
  const bundle = {
    version: 1,
    exportedAt: Date.now(),
    app: "GitPrism",
    project,
  };
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}.gitprism.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses and validates an uploaded `.gitprism.json` bundle.
 */
export function parseProjectBundle(jsonString: string, targetUserId: string): StoredProject {
  const parsed = JSON.parse(jsonString);
  const rawProject = parsed.project || parsed;
  if (!rawProject || typeof rawProject.files !== "object") {
    throw new Error("Invalid GitPrism bundle: missing project files");
  }

  const id = `prj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    userId: targetUserId,
    name: rawProject.name || "imported-project",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    fileCount: Object.keys(rawProject.files).length,
    totalBytes: Object.values(rawProject.files as Record<string, string>).reduce((n, c) => n + c.length, 0),
    files: rawProject.files,
    gitRepo: rawProject.gitRepo || null,
  };
}

/**
 * Queries client browser storage usage and quota in Megabytes.
 */
export async function getVaultStorageEstimate(): Promise<{ usageMb: number; quotaMb: number } | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
  try {
    const est = await navigator.storage.estimate();
    const usageMb = est.usage ? Math.round((est.usage / (1024 * 1024)) * 10) / 10 : 0;
    const quotaMb = est.quota ? Math.round((est.quota / (1024 * 1024)) * 10) / 10 : 0;
    return { usageMb, quotaMb };
  } catch {
    return null;
  }
}

