"use client";

import dynamic from "next/dynamic";
import { PrismMark } from "@/components/brand/PrismMark";

// MergeLab keeps decisions in this browser and runs tests in a worker, so it renders client-side only.
const MergeLabApp = dynamic(() => import("./MergeLabApp"), {
  ssr: false,
  loading: () => <Opening />,
});

export function Opening() {
  return (
    <div className="studio grid h-[100dvh] place-items-center" role="status">
      <div className="flex flex-col items-center gap-3 text-[13px] text-[#9a90ad]">
        <PrismMark className="h-10 w-10 animate-pulse" />
        Lining up three versions
      </div>
    </div>
  );
}

export function MergeLabEntry() {
  return <MergeLabApp />;
}
