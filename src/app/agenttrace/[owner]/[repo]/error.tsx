"use client";

import Link from "next/link";

export default function AgentTraceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="studio grid min-h-[100dvh] place-items-center p-6">
      <div className="hud max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">AgentTrace couldn&apos;t load</h1>
        <p className="mt-2 text-[13px] text-[#c9c0d8]">
          {error.message || "Something went wrong while reading the session."}
          {error.digest ? ` (${error.digest})` : ""}
        </p>
        <p className="mt-2 text-[12px] text-[#9a90ad]">Nothing was run and no session was recorded.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={reset} className="h-9 rounded-full bg-[#7C3AED] px-4 text-[13px] text-white">
            Try again
          </button>
          <Link href="/" className="flex h-9 items-center rounded-full border border-white/15 px-4 text-[13px]">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
