import type { NextRequest } from "next/server";
import { FIXTURE, fixtureHistory } from "@/features/impact-analysis/fixture";
import { isTestFile } from "@/features/impact-analysis/source-analysis";
import { runFixtureTest } from "@/features/timefold/test-runner";

/**
 * Runs one test at one commit of the bundled fixture repository.
 * Body: { oid: string, test: "path/to/file.test.ts#test name" }. Only fixture commits are accepted.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/repos/[owner]/[repo]/run-test">) {
  const { owner, repo } = await ctx.params;
  if (owner !== FIXTURE.owner || repo !== FIXTURE.repo) {
    return Response.json({ error: "Only the bundled demo repository can run tests in this build." }, { status: 404 });
  }

  let body: { oid?: unknown; test?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send JSON with oid and test." }, { status: 400 });
  }
  const oid = typeof body.oid === "string" ? body.oid : "";
  const test = typeof body.test === "string" ? body.test : "";
  const hash = test.indexOf("#");
  if (!/^[0-9a-f]{40}$/.test(oid) || hash < 1) return Response.json({ error: "oid must be a full commit ID and test must be path#name." }, { status: 400 });

  const commit = fixtureHistory().all.find((c) => c.oid === oid);
  if (!commit) return Response.json({ error: "That commit is not part of this repository." }, { status: 404 });

  // The request names a test, not a module. Without this it could name any source file in the
  // commit and have its top-level body executed, which is a wider surface than this route means
  // to offer even though everything in the commit is already reviewed.
  const path = test.slice(0, hash);
  if (!isTestFile(path)) return Response.json({ error: "test must name a test file in this repository." }, { status: 400 });

  const outcome = runFixtureTest(commit.files, path, test.slice(hash + 1));
  return Response.json({ oid, test, ...outcome }, { headers: { "Cache-Control": "no-store" } });
}
