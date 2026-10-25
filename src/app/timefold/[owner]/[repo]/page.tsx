import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FIXTURE } from "@/features/impact-analysis/fixture";
import { Opening, TimeFoldEntry } from "@/components/timefold/TimeFoldEntry";
import { PrismMark } from "@/components/brand/PrismMark";

type Params = { owner: string; repo: string };

export async function generateStaticParams(): Promise<Params[]> {
  return [{ owner: FIXTURE.owner, repo: FIXTURE.repo }];
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { owner, repo } = await params;
  return {
    title: `${owner}/${repo} — TimeFold`,
    description: "Travel through a repository's history: follow one function commit by commit, replay architecture drift and bisect a regression with real tests.",
  };
}

export default function TimeFoldPage({ params }: { params: Promise<Params> }) {
  // Params are request data, so the static shell renders the fallback until they resolve.
  return (
    <Suspense fallback={<Opening />}>
      <TimeFold params={params} />
    </Suspense>
  );
}

async function TimeFold({ params }: { params: Promise<Params> }) {
  const { owner, repo } = await params;
  if (owner !== FIXTURE.owner || repo !== FIXTURE.repo) return <NotAvailable owner={owner} repo={repo} />;
  return <TimeFoldEntry />;
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
          Reading a real repository&apos;s history needs a connected provider such as GitHub or GitLab, and this build doesn&apos;t have one yet. Nothing was
          fetched.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={`/timefold/${FIXTURE.owner}/${FIXTURE.repo}`} className="flex h-10 items-center rounded-full bg-[#7C3AED] px-5 text-[13px] font-medium text-white">
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
