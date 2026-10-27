import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FIXTURE, isFixture } from "@/features/impact-analysis/fixture";
import { StudioEntry } from "@/components/impact-studio/StudioEntry";
import { PrismMark } from "@/components/brand/PrismMark";

type Params = { owner: string; repo: string; number: string };

export async function generateStaticParams(): Promise<Params[]> {
  return [{ owner: FIXTURE.owner, repo: FIXTURE.repo, number: String(FIXTURE.number) }];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { owner, repo, number } = await params;
  return {
    title: `#${number} ${owner}/${repo} — Impact Studio`,
    description: "Trace what a pull request affects, check related tests and review evidence-backed findings.",
  };
}

export default function ReviewPage({ params }: { params: Promise<Params> }) {
  // Params are request data, so the static shell renders the fallback until they resolve.
  return (
    <Suspense fallback={<Opening />}>
      <Review params={params} />
    </Suspense>
  );
}

async function Review({ params }: { params: Promise<Params> }) {
  const { owner, repo, number } = await params;
  if (!isFixture(owner, repo, number)) return <NotAvailable owner={owner} repo={repo} number={number} />;
  return <StudioEntry />;
}

function Opening() {
  return (
    <div className="studio grid h-[100dvh] place-items-center" role="status">
      <div className="flex flex-col items-center gap-3 text-[13px] text-[#9a90ad]">
        <PrismMark className="h-10 w-10 animate-pulse" />
        Opening Impact Studio
      </div>
    </div>
  );
}

function NotAvailable({ owner, repo, number }: Params) {
  const demo = `/review/${FIXTURE.owner}/${FIXTURE.repo}/pull/${FIXTURE.number}`;
  return (
    <main className="studio grid min-h-[100dvh] place-items-center p-6">
      <div className="hud max-w-lg p-8">
        <PrismMark className="h-9 w-9" />
        <h1 className="mt-5 text-2xl font-semibold">
          {owner}/{repo}#{number} isn&apos;t available
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[#c9c0d8]">
          Reviewing real pull requests needs a connected repository provider such as GitHub or GitLab, and this build doesn&apos;t have one yet.
          Nothing was fetched.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={demo} className="flex h-10 items-center rounded-full bg-[#7C3AED] px-5 text-[13px] font-medium text-white">
            Open the demo pull request
          </Link>
          <Link href="/" className="flex h-10 items-center rounded-full border border-white/15 px-5 text-[13px]">
            Back to GitPrism
          </Link>
        </div>
      </div>
    </main>
  );
}
