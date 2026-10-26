import type { NextRequest } from "next/server";
import { analyze } from "@/features/impact-analysis/analysis-service";
import { FIXTURE, LAYER_CONFIG } from "@/features/impact-analysis/fixture";
import { resolveCandidate } from "@/features/changeverse/candidates";
import { preflight } from "@/features/changeverse/preflight";
import { runFixtureTest } from "@/features/timefold/test-runner";

/**
 * Analyses a candidate change from the bundled fixture repository and runs its tests at both
 * revisions. Body: { candidate: string } — an id from `candidates()`, never code or file
 * contents: the server resolves the id against the same fixture and executes only committed
 * fixture source, each test in a fresh VM context under a time limit.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/repos/[owner]/[repo]/preflight">) {
  const { owner, repo } = await ctx.params;
  if (owner !== FIXTURE.owner || repo !== FIXTURE.repo) {
    return Response.json({ error: "Only the bundled demo repository can run a preflight in this build." }, { status: 404 });
  }

  let body: { candidate?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Send JSON with a candidate id." }, { status: 400 });
  }
  const id = typeof body.candidate === "string" ? body.candidate : "";
  if (!id) return Response.json({ error: "candidate must be a string." }, { status: 400 });

  const resolved = resolveCandidate(id);
  if (!resolved) return Response.json({ error: "That change is not part of this repository." }, { status: 404 });

  const { candidate, baseFiles, headFiles } = resolved;
  const analysis = analyze(baseFiles, headFiles, { base: candidate.base, head: candidate.head, ...LAYER_CONFIG });
  const result = preflight(analysis, runFixtureTest);

  return Response.json(
    { candidate: candidate.id, result, findings: analysis.findings, stages: analysis.stages },
    { headers: { "Cache-Control": "no-store" } },
  );
}
