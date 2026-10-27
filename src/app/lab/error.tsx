"use client";

import Link from "next/link";

export default function LabError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-paper p-6 text-ink">
      <div className="max-w-md text-center">
        <h1 className="display text-4xl">The lab couldn&apos;t open.</h1>
        <p className="mt-3 text-[14px] text-ink-2">
          Something failed while loading the repository{error.digest ? ` (${error.digest})` : ""}. Your saved work in this browser hasn&apos;t been
          deleted.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={reset} className="btn btn-primary btn-md">
            Try again
          </button>
          <Link href="/" className="btn btn-ghost btn-md">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
