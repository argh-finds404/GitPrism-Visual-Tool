"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/theme";
import { LazyPrism } from "@/components/three/LazyPrism";


export function ClosingCTA() {
  const reduce = usePrefersReducedMotion();
  return (
    <section aria-labelledby="cta-title">
      {/* A band of the page, not a card floating on it: full bleed, square, no drop shadow. */}
      <div
        className="night relative grid overflow-hidden border-t border-line lg:min-h-[640px] lg:grid-cols-12"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 60% at 78% 50%, rgb(124 77 255 / 0.5), transparent 70%), radial-gradient(30% 40% at 92% 88%, rgb(255 92 184 / 0.3), transparent 70%), radial-gradient(35% 45% at 8% 10%, rgb(62 224 255 / 0.16), transparent 70%)",
          }}
        />
        <div className="relative z-[1] flex flex-col justify-center px-6 pb-4 pt-16 md:px-14 lg:col-span-7 lg:py-20">
          <p className="mb-6 text-[0.95rem] text-lilac">Your next commit to understanding</p>
          <h2 id="cta-title" className="display text-[clamp(2.4rem,5.2vw,4.8rem)]">
            Stop memorizing Git.
            <br />
            {/* One sweep of the spectrum when the line arrives, instead of a loop that never stops. */}
            <motion.span
              className="spectrum-text"
              initial={{ backgroundPosition: "100% 0" }}
              whileInView={{ backgroundPosition: "0% 0" }}
              viewport={{ once: true, margin: "-15% 0px" }}
              transition={{ duration: reduce ? 0 : 1.6, ease: [0.22, 1, 0.36, 1] }}
            >
              Start seeing it.
            </motion.span>
          </h2>
          <p className="mt-7 max-w-[32rem] text-[1.1rem] leading-relaxed text-ink-2">
            Explore the objects, snapshots and relationships behind every version of your code.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/lab" className="btn bg-[#f5f2ff] text-[#08070f] hover:bg-white hover:shadow-[0_16px_40px_-14px_#9b7bff]">
              Enter GitPrism <ArrowUpRight size={17} className="btn-arrow" />
            </Link>
            <Link href="/review/gitprism-demo/acme-shop/pull/42" className="btn border border-white/20 text-[#f5f2ff] hover:border-lilac">
              Review a pull request
            </Link>
          </div>
        </div>
        <div className="relative h-[340px] lg:col-span-5 lg:h-auto">
          <LazyPrism variant="finale" background="#191720" reducedMotion={reduce} fadeEdges={false} />
        </div>
      </div>
    </section>
  );
}
