// Local-first persistence. The lab stores the list of commands the learner ran,
// not the derived state: replaying them over the sample is deterministic and
// keeps saved data small. Swap this module for a database-backed one later.

import type { RepositoryCommand } from "./types";

export type PersistedLab = {
  version: 1;
  commands: RepositoryCommand[];
  completedChallenges: string[];
  savedAt: number;
};

export interface LabStorage {
  load(): Promise<PersistedLab | null>;
  save(data: PersistedLab): Promise<void>;
  clear(): Promise<void>;
}

const DB = "gitprism";
const STORE = "labs";
const KEY = "default";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

const commandTypes = new Set([
  "EDIT_FILE",
  "CREATE_FILE",
  "RENAME_FILE",
  "DELETE_FILE",
  "STAGE_PATHS",
  "UNSTAGE_PATHS",
  "RESTORE_PATHS",
  "COMMIT",
  "CREATE_BRANCH",
  "SWITCH_BRANCH",
]);

/** Reject anything that doesn't look like data this version wrote. */
export function validatePersisted(raw: unknown): PersistedLab | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<PersistedLab>;
  if (r.version !== 1 || !Array.isArray(r.commands) || !Array.isArray(r.completedChallenges)) return null;
  if (!r.commands.every((c) => c && typeof c === "object" && commandTypes.has((c as RepositoryCommand).type))) return null;
  if (!r.completedChallenges.every((c) => typeof c === "string")) return null;
  return { version: 1, commands: r.commands, completedChallenges: r.completedChallenges, savedAt: Number(r.savedAt) || 0 };
}

export const indexedDbStorage: LabStorage = {
  async load() {
    return validatePersisted(await tx("readonly", (s) => s.get(KEY)));
  },
  async save(data) {
    await tx("readwrite", (s) => s.put(data, KEY));
  },
  async clear() {
    await tx("readwrite", (s) => s.delete(KEY));
  },
};

/** Used when IndexedDB is unavailable (private mode, blocked storage). */
export function memoryStorage(): LabStorage {
  let data: PersistedLab | null = null;
  return {
    async load() {
      return data;
    },
    async save(d) {
      data = d;
    },
    async clear() {
      data = null;
    },
  };
}
