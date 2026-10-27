import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FIXTURE } from "@/features/impact-analysis/fixture";
import { touchedPaths } from "@/features/agenttrace/events";
import { fixtureSessions, sessionBaseFiles } from "@/features/agenttrace/session";
import { runFixtureTest } from "@/features/timefold/test-runner";
import { AgentTraceApp } from "@/components/agenttrace/AgentTraceApp";
import { PrismMark } from "@/components/brand/PrismMark";

type Params = { owner: string; repo: string };

export async function generateStaticParams(): Promise<Params[]> {
  return [{ owner: FIXTURE.owner, repo: FIXTURE.repo }];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { owner, repo } = await params;
  return {
    title: `${owner}/${repo} — AgentTrace`,
    description:
      "Replay a coding agent's session: what it read, what it changed, which tests failed and how the final diff came about.",
  };
}

export default function AgentTracePage({ params }: { params: Promise<Params> }) {
  // Params are request data, so the static shell renders the fallback until they resolve.
  return (
    <Suspense fallback={<Opening />}>
      <AgentTrace params={params} />
    </Suspense>
  );
}

async function AgentTrace({ params }: { params: Promise<Params> }) {
  const { owner, repo } = await params;
  if (owner !== FIXTURE.owner || repo !== FIXTURE.repo) return <NotAvailable owner={owner} repo={repo} />;

  // The tests really run here, on the server, once. Replay in the browser re-applies the recorded
  // edits and never executes anything.
  const sessions = fixtureSessions(runFixtureTest);
  const all = sessionBaseFiles();
  const paths = [...new Set(sessions.flatMap((s) => touchedPaths(s.events)))];
  const baseFiles = Object.fromEntries(paths.map((p) => [p, all[p] ?? ""]));

  return <AgentTraceApp sessions={sessions} baseFiles={baseFiles} />;
}

export function Opening() {
  return (
    <main className="studio grid min-h-[100dvh] place-items-center p-6">
      <div className="flex items-center gap-3 text-[13px] text-[#9a90ad]">
        <PrismMark className="h-6 w-6" />
        Loading AgentTrace…
      </div>
    </main>
  );
}

function NotAvailable({ owner, repo }: Params) {
  return (
    <main className="studio grid min-h-[100dvh] place-items-center p-6">
      <div className="hud max-w-lg p-8">
        <PrismMark className="h-9 w-9" />
        <h1 className="mt-5 text-2xl font-semibold">
          {owner}/{repo} isn&apos;t available
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[#c9c0d8]">
          AgentTrace reads a recorded session, and this build ships exactly one: a reconstruction against the bundled
          demo repository. Connecting a real coding agent needs an integration this build does not have, so nothing was
          fetched or captured.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/agenttrace/${FIXTURE.owner}/${FIXTURE.repo}`}
            className="flex h-10 items-center rounded-full bg-[#7C3AED] px-5 text-[13px] font-medium text-white"
          >
            Open the demo session
          </Link>
          <Link href="/" className="flex h-10 items-center rounded-full border border-white/15 px-5 text-[13px]">
            Back to GitPrism
          </Link>
        </div>
      </div>
    </main>
  );
}
