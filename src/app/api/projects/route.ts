import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { classify, LIMITS } from "@/features/upload/collect";

/** A saved project is someone else's source. It is kept briefly and then pruned. */
const KEEP_DAYS = 7;

/**
 * Saves an uploaded project so it can be reopened from a link.
 *
 * Saving is opt-in; the browser analyses a folder without this route. Everything the client
 * claims is checked again here — the same source-only, no-secrets rules, and the same limits —
 * because a request can say anything. Stored source is only ever parsed, never executed.
 */
export async function POST(req: NextRequest) {
  let body: { name?: unknown; files?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send JSON with a name and files." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const files = body.files;
  if (!name) return Response.json({ error: "name is required." }, { status: 400 });
  if (!files || typeof files !== "object" || Array.isArray(files)) {
    return Response.json({ error: "files must be an object of path to source." }, { status: 400 });
  }

  const entries = Object.entries(files as Record<string, unknown>);
  if (entries.length === 0) return Response.json({ error: "No files to save." }, { status: 400 });
  if (entries.length > LIMITS.files) {
    return Response.json({ error: `At most ${LIMITS.files} files.` }, { status: 413 });
  }

  let bytes = 0;
  for (const [path, content] of entries) {
    if (typeof content !== "string") {
      return Response.json({ error: `${path}: contents must be text.` }, { status: 400 });
    }
    const size = Buffer.byteLength(content, "utf8");
    bytes += size;
    // The client filtered already; it is not trusted to have done so.
    if (classify(path, size) !== "take") {
      return Response.json({ error: `${path} is not an analysable source file.` }, { status: 400 });
    }
  }
  if (bytes > LIMITS.bytes) return Response.json({ error: `At most ${Math.round(LIMITS.bytes / 1000)} KB in total.` }, { status: 413 });

  try {
    const project = await prisma.project.create({
      data: {
        name,
        fileCount: entries.length,
        bytes,
        files: files as Record<string, string>,
        expiresAt: new Date(Date.now() + KEEP_DAYS * 86_400_000),
      },
      select: { id: true, expiresAt: true },
    });
    return Response.json({ id: project.id, expiresAt: project.expiresAt, keepDays: KEEP_DAYS }, { status: 201 });
  } catch {
    // A missing or unreachable database must not look like a problem with the user's project.
    return Response.json({ error: "Saving is unavailable: this deployment has no database configured." }, { status: 503 });
  }
}
