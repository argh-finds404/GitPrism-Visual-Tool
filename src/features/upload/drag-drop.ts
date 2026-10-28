const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "vendor",
  ".venv",
  "__pycache__",
  "coverage",
  ".turbo",
  ".cache",
  "out",
  "target",
]);

function shouldSkipGitSubdir(parentPath: string, dirName: string): boolean {
  const norm = parentPath.replace(/\\/g, "/");
  if ((norm === ".git" || norm.endsWith("/.git")) && (dirName === "hooks" || dirName === "info" || dirName === "lfs" || dirName === "worktrees")) {
    return true;
  }
  if ((norm === ".git/objects" || norm.endsWith("/.git/objects")) && (dirName === "pack" || dirName === "info")) {
    return true;
  }
  return false;
}

/**
 * Recursively extracts File objects from a browser drag-and-drop event,
 * preserving webkitRelativePath for both root files and subdirectories.
 * Skips massive dependencies (node_modules, etc.) during traversal.
 */
export async function getFilesFromDataTransfer(items: DataTransferItemList): Promise<File[]> {
  const files: File[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function traverse(entry: any, path = ""): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        entry.file(resolve, reject);
      });
      const relPath = path ? `${path}/${file.name}` : file.name;
      try {
        Object.defineProperty(file, "webkitRelativePath", {
          value: relPath,
          writable: true,
        });
      } catch {
        // ignore if read-only
      }
      files.push(file);
    } else if (entry.isDirectory) {
      if (IGNORED_DIRS.has(entry.name) || shouldSkipGitSubdir(path, entry.name)) {
        return;
      }
      const reader = entry.createReader();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const readBatch = async (): Promise<any[]> => {
        return new Promise((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let batch: any[];
      do {
        batch = await readBatch();
        for (const child of batch) {
          await traverse(child, path ? `${path}/${entry.name}` : entry.name);
        }
      } while (batch.length > 0);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: any[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
    if (entry) entries.push(entry);
  }

  for (const entry of entries) {
    await traverse(entry);
  }

  return files;
}

/**
 * Uses the modern File System Access API (window.showDirectoryPicker) to open
 * a native folder picker WITHOUT triggering Chrome's scary "Upload X files to this site?" popup.
 * Also prunes node_modules / .venv during traversal for instantaneous loading.
 */
export async function pickDirectoryNative(): Promise<{ files: File[]; cancelled: boolean } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window !== "undefined" && typeof (window as any).showDirectoryPicker === "function") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle: any = await (window as any).showDirectoryPicker({ mode: "read" });
      const files: File[] = [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async function traverseDir(dirHandle: any, path: string) {
        for await (const entry of dirHandle.values()) {
          const entryPath = path ? `${path}/${entry.name}` : entry.name;
          if (entry.kind === "file") {
            const file = await entry.getFile();
            try {
              Object.defineProperty(file, "webkitRelativePath", {
                value: entryPath,
                writable: true,
              });
            } catch {
              // ignore
            }
            files.push(file);
          } else if (entry.kind === "directory") {
            if (IGNORED_DIRS.has(entry.name) || shouldSkipGitSubdir(path, entry.name)) {
              continue;
            }
            await traverseDir(entry, entryPath);
          }
        }
      }

      await traverseDir(handle, handle.name);
      return { files, cancelled: false };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { files: [], cancelled: true };
      }
      return null;
    }
  }
  return null;
}
