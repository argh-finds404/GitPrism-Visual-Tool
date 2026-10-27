import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FIXTURE } from "@/features/impact-analysis/fixture";
import { candidates } from "@/features/changeverse/candidates";
import { ChangeVerseApp } from "@/components/changeverse/ChangeVerseApp";
import { PrismMark } from "@/components/brand/PrismMark";

type Params = { owner: string; repo: string };

export async function generateStaticParams(): Promise<Params[]> {
  return [{ owner: FIXTURE.owner, repo: FIXTURE.repo }];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { owner, repo } = await params;
  return {
    title: `${owner}/${repo} — ChangeVerse`,
    description:
      "Preflight a change: see what static analysis predicts could break beside what actually happened when the tests ran at both revisions.",
  };
}

export default function ChangeVersePage({ params }: { params: Promise<Params> }) {
  // Params are request data, so the static shell renders the fallback until they resolve.
  return (
    <Suspense fallback={<Opening />}>
      <ChangeVerse params={params} />
    </Suspense>
  );
}

async function ChangeVerse({ params }: { params: Promise<Params> }) {
  const { owner, repo } = await params;
  if (owner !== FIXTURE.owner || repo !== FIXTURE.repo) return <NotAvailable owner={owner} repo={repo} />;
  // Built on the server so the picker costs the browser nothing.
  return <ChangeVerseApp owner={owner} repo={repo} list={candidates()} />;
}

export function Opening() {
  return (
    <main className="studio grid min-h-[100dvh] place-items-center p-6">
      <div className="flex items-center gap-3 text-[13px] text-[#9a90ad]">
        <PrismMark className="h-6 w-6" />
        Loading ChangeVerse…
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
          Preflighting a change means running its tests, and this build only ever executes the bundled demo
          repository&apos;s committed code. Nothing was fetched or run.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/changeverse/${FIXTURE.owner}/${FIXTURE.repo}`}
            className="flex h-10 items-center rounded-full bg-[#7C3AED] px-5 text-[13px] font-medium text-white"
          >
            Open the demo repository
          </Link>
          <Link href="/" className="flex h-10 items-center rounded-full border border-white/15 px-5 text-[13px]">
            Back to GitPrism
          </Link>
        </div>
      </div>
    </main>
  );
}
