/**
 * Recursively extracts File objects from a browser drag-and-drop event,
 * preserving webkitRelativePath for both root files and subdirectories.
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
