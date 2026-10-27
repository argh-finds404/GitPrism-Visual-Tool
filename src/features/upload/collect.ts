// Turning a folder the user picked into the file map the analyser already understands.
//
// Nothing here executes anything. The uploaded project is parsed, never run: the only code this
// application ever executes is the bundled fixture, and that stays true no matter what is
// uploaded. See README "Executing repository code".
//
// Reading happens in the browser, so a project is analysed without being sent anywhere unless
// the user explicitly saves it.

import { isSecretFile, isSource } from "@/features/impact-analysis/source-analysis";

/** Bounds, so a stray node_modules or a huge repo cannot lock up the tab. */
export const LIMITS = { files: 400, bytes: 2_000_000, fileBytes: 200_000 } as const;

/** Directories that are never source worth analysing, and would swamp the limits. */
const IGNORED = ["node_modules/", ".git/", "dist/", "build/", ".next/", "coverage/", "vendor/", ".venv/", "__pycache__/"];

export type Collected = {
  files: Record<string, string>;
  /** What was left out, and why, so the result is never silently partial. */
  skipped: { ignored: number; notSource: number; secret: number; tooBig: number };
  /** True when the limits stopped the read before every eligible file was taken. */
  truncated: boolean;
  bytes: number;
};

/** The path to analyse under, with the picked folder's own name removed. */
export function relativePath(file: File) {
  const full = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const cut = full.indexOf("/");
  return cut === -1 ? full : full.slice(cut + 1);
}

export const isIgnored = (path: string) => IGNORED.some((d) => path.startsWith(d) || path.includes(`/${d}`));

/** Decide a single file without reading it, so ineligible files are never loaded into memory. */
export function classify(path: string, size: number) {
  if (isIgnored(path)) return "ignored" as const;
  if (isSecretFile(path)) return "secret" as const;
  if (!isSource(path)) return "notSource" as const;
  if (size > LIMITS.fileBytes) return "tooBig" as const;
  return "take" as const;
}

export async function collect(list: ArrayLike<File>): Promise<Collected> {
  const files: Record<string, string> = {};
  const skipped = { ignored: 0, notSource: 0, secret: 0, tooBig: 0 };
  let bytes = 0;
  let truncated = false;

  const entries = Array.from(list)
    .map((f) => ({ file: f, path: relativePath(f) }))
    .sort((a, b) => a.path.localeCompare(b.path));

  for (const { file, path } of entries) {
    const verdict = classify(path, file.size);
    if (verdict !== "take") {
      skipped[verdict]++;
      continue;
    }
    if (Object.keys(files).length >= LIMITS.files || bytes + file.size > LIMITS.bytes) {
      truncated = true;
      continue;
    }
    files[path] = await file.text();
    bytes += file.size;
  }

  return { files, skipped, truncated, bytes };
}
