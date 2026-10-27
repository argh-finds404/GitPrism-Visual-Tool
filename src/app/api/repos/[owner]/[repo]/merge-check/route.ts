import type { NextRequest } from "next/server";
import { FIXTURE } from "@/features/impact-analysis/fixture";
import { compileFiles, typeCheck } from "@/features/mergelab/checks";

const MAX_FILES = 80;
const MAX_BYTES = 400_000;

/**
 * Parse-only checks for a merge candidate. Body: { check: "compile" | "types", files: { path: text } }.
 * Nothing is executed here, so hand-edited candidates are accepted; tests run in the browser.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/repos/[owner]/[repo]/merge-check">) {
  const { owner, repo } = await ctx.params;
  if (owner !== FIXTURE.owner || repo !== FIXTURE.repo) {
    return Response.json({ error: "Only the bundled demo repository can be checked in this build." }, { status: 404 });
  }

  let body: { check?: unknown; files?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send JSON with check and files." }, { status: 400 });
  }
  const files = body.files;
  if (!files || typeof files !== "object" || Array.isArray(files)) return Response.json({ error: "files must be an object of path → text." }, { status: 400 });
  const entries = Object.entries(files as Record<string, unknown>);
  if (entries.length > MAX_FILES) return Response.json({ error: `At most ${MAX_FILES} files.` }, { status: 413 });
  let bytes = 0;
  for (const [path, text] of entries) {
    if (typeof text !== "string" || !/^[\w.-]+(\/[\w.-]+)*$/.test(path) || path.split("/").includes("..")) {
      return Response.json({ error: `Invalid file entry: ${path.slice(0, 80)}` }, { status: 400 });
    }
    bytes += text.length;
  }
  if (bytes > MAX_BYTES) return Response.json({ error: "The candidate is too large to check here." }, { status: 413 });

  const set = files as Record<string, string>;
  const headers = { "Cache-Control": "no-store" };
  if (body.check === "compile") return Response.json({ check: "compile", results: compileFiles(set) }, { headers });
  if (body.check === "types") return Response.json({ check: "types", result: await typeCheck(set) }, { headers });
  return Response.json({ error: 'check must be "compile" or "types".' }, { status: 400 });
}
