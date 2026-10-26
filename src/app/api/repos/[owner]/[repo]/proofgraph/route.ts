import type { NextRequest } from "next/server";
import { analyze } from "@/features/impact-analysis/analysis-service";
import { FIXTURE, LAYER_CONFIG } from "@/features/impact-analysis/fixture";
import { resolveCandidate } from "@/features/changeverse/candidates";
import { collectEvidence } from "@/features/proofgraph/evidence";
import { runFixtureTest } from "@/features/timefold/test-runner";

/**
 * Collects the evidence standing behind a candidate change from the bundled fixture repository.
 * Body: { candidate: string } — an id the server resolves against the same fixture, never code or
 * file contents. Tests run in a fresh VM context under a time limit, on committed fixture source.
 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/repos/[owner]/[repo]/proofgraph">) {
  const { owner, repo } = await ctx.params;
  if (owner !== FIXTURE.owner || repo !== FIXTURE.repo) {
    return Response.json({ error: "Only the bundled demo repository can be analysed in this build." }, { status: 404 });
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
  const graph = collectEvidence(analysis, runFixtureTest);

  return Response.json({ candidate: candidate.id, graph }, { headers: { "Cache-Control": "no-store" } });
}
