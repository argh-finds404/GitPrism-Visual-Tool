"use client";

import dynamic from "next/dynamic";
import { ArrowUpRight } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/theme";

const PrismScene = dynamic(() => import("@/components/three/PrismScene"), { ssr: false });

export function ClosingCTA() {
  const reduce = usePrefersReducedMotion();
  return (
    <section aria-labelledby="cta-title" className="px-3 py-6 md:px-6">
      <div className="night relative mx-auto grid max-w-[1400px] overflow-hidden rounded-[36px] lg:min-h-[640px] lg:grid-cols-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 60% at 78% 50%, rgb(118 84 232 / 0.45), transparent 70%), radial-gradient(30% 40% at 90% 85%, rgb(232 90 196 / 0.25), transparent 70%)",
          }}
        />
        <div className="relative z-[1] flex flex-col justify-center px-6 pb-4 pt-16 md:px-14 lg:col-span-7 lg:py-20">
          <p className="mb-6 text-[0.95rem] text-lilac">Your next commit to understanding</p>
          <h2 id="cta-title" className="display text-[clamp(3rem,7.4vw,6.6rem)]">
            Stop memorizing Git.
            <br />
            <span className="spectrum-text shimmer italic">Start seeing it.</span>
          </h2>
          <p className="mt-7 max-w-[32rem] text-[1.1rem] leading-relaxed text-ink-2">
            Explore the objects, snapshots and relationships behind every version of your code.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <a href="/lab" className="btn bg-[#f3f1f8] text-[#191720] hover:bg-white hover:shadow-[0_16px_40px_-14px_#7654e8]">
              Enter GitPrism <ArrowUpRight size={17} className="btn-arrow" />
            </a>
            <a href="#how" className="btn border border-white/20 text-[#f3f1f8] hover:border-lilac">
              Revisit the story
            </a>
          </div>
        </div>
        <div className="relative h-[340px] lg:col-span-5 lg:h-auto">
          <PrismScene variant="finale" background="#191720" reducedMotion={reduce} />
        </div>
      </div>
    </section>
  );
}
