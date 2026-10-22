"use client";

import dynamic from "next/dynamic";
import { PrismMark } from "@/components/brand/PrismMark";

// The studio needs WebGL and runs its analysis in the browser, so it renders client-side only.
const ImpactStudio = dynamic(() => import("./ImpactStudio"), {
  ssr: false,
  loading: () => (
    <div className="studio grid h-[100dvh] place-items-center" role="status">
      <div className="flex flex-col items-center gap-3 text-[13px] text-[#9a90ad]">
        <PrismMark className="h-10 w-10 animate-pulse" />
        Opening Impact Studio
      </div>
    </div>
  ),
});

export function StudioEntry() {
  return <ImpactStudio />;
}
