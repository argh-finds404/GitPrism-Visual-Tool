import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AnalyzeApp } from "@/components/upload/AnalyzeApp";
import { PrismMark } from "@/components/brand/PrismMark";

export const metadata: Metadata = {
  title: "A saved project — GitPrism",
  description: "Structural analysis of a saved project: dependency graph, import cycles and unresolved imports.",
};

type Params = { id: string };

/** Not a component: the clock and the database both belong outside the render. */
async function loadProject(id: string) {
  try {
    // Expiry is part of the query, so a stale row is never read in the first place.
    const project = await prisma.project.findUnique({
      where: { id, expiresAt: { gt: new Date() } },
      select: { name: true, files: true },
    });
    return project
      ? ({ ok: true, project } as const)
      : ({ ok: false, reason: "That project does not exist, has expired, or has been pruned. Saved projects are kept for a week." } as const);
  } catch {
    return { ok: false, reason: "Saved projects are unavailable: this deployment has no database configured." } as const;
  }
}

export default function SavedProjectPage({ params }: { params: Promise<Params> }) {
  // The lookup is request data, so the static shell renders the fallback until it resolves.
  return (
    <Suspense fallback={<Opening />}>
      <SavedProject params={params} />
    </Suspense>
  );
}

async function SavedProject({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const loaded = await loadProject(id);
  if (!loaded.ok) return <Gone reason={loaded.reason} />;
  return <AnalyzeApp initial={{ name: loaded.project.name, files: loaded.project.files as Record<string, string> }} />;
}

function Opening() {
  return (
    <main className="studio grid min-h-[100dvh] place-items-center p-6">
      <div className="flex items-center gap-3 text-[13px] text-[#9a90ad]">
        <PrismMark className="h-6 w-6" />
        Loading the saved project…
      </div>
    </main>
  );
}

function Gone({ reason }: { reason: string }) {
  return (
    <main className="studio grid min-h-[100dvh] place-items-center p-6">
      <div className="hud max-w-lg p-8">
        <PrismMark className="h-9 w-9" />
        <h1 className="mt-5 text-2xl font-semibold">Nothing to show</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[#c9c0d8]">{reason}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/analyze" className="flex h-10 items-center rounded-full bg-[#7C3AED] px-5 text-[13px] font-medium text-white">
            Analyse a folder
          </Link>
          <Link href="/" className="flex h-10 items-center rounded-full border border-white/15 px-5 text-[13px]">
            Back to GitPrism
          </Link>
        </div>
      </div>
    </main>
  );
}
