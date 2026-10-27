"use client";

import dynamic from "next/dynamic";
import { PrismMark } from "@/components/brand/PrismMark";

// TimeFold builds its snapshots and reads the address bar in the browser, so it renders client-side only.
const TimeFoldApp = dynamic(() => import("./TimeFoldApp"), {
  ssr: false,
  loading: () => <Opening />,
});

export function Opening() {
  return (
    <div className="studio grid h-[100dvh] place-items-center" role="status">
      <div className="flex flex-col items-center gap-3 text-[13px] text-[#9a90ad]">
        <PrismMark className="h-10 w-10 animate-pulse" />
        Folding history
      </div>
    </div>
  );
}

export function TimeFoldEntry() {
  return <TimeFoldApp />;
}
