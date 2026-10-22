"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { Chapter } from "@/components/ui/Chapter";
import { usePrefersReducedMotion } from "@/lib/theme";
import { hashCommit, short } from "@/lib/git";
import { BASE_TIME, commits, tree } from "@/lib/sample";

const commitId = short(hashCommit({ tree, parents: [commits.c2.oid], message: "Update homepage", time: BASE_TIME + 5400 }));

const script = [
  { kind: "cmd", text: "git add ." },
  { kind: "cmd", text: 'git commit -m "Update homepage"' },
  { kind: "out", text: `[main ${commitId}] Update homepage` },
  { kind: "out", text: " 1 file changed, 2 insertions(+), 1 deletion(-)" },
] as const;

const questions = ["What did Git actually save?", "Where did the content go?", "Why is the old version still there?"];

function Terminal() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const reduce = usePrefersReducedMotion();
  const [shown, setShown] = useState(0); // characters revealed across the whole script

  const total = script.reduce((n, l) => n + l.text.length, 0);

  useEffect(() => {
    if (!inView || reduce) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(i);
      if (i >= total) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [inView, reduce, total]);

  const revealed = reduce && inView ? total : shown;
  const starts = script.map((_, i) => script.slice(0, i).reduce((n, l) => n + l.text.length, 0));
  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-2xl border border-night-line bg-night text-[#e9e6f2] shadow-[0_40px_80px_-40px_rgb(40_20_110/0.55)]"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="ml-3 text-[0.8rem] text-white/50">~/homepage</span>
      </div>
      <pre className="min-h-[188px] px-5 py-5 font-mono text-[0.88rem] leading-7" aria-label="Terminal session">
        {script.map((line, i) => {
          const budget = revealed - starts[i];
          const visible = line.text.slice(0, Math.max(0, budget));
          const typing = budget > 0 && budget < line.text.length;
          if (!visible && i > 0) return null;
          return (
            <div key={i} className={line.kind === "out" ? "text-white/60" : ""}>
              {line.kind === "cmd" && <span className="mr-2 select-none text-[#b6a0ff]">$</span>}
              {visible}
              {typing && (
                <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-[#b6a0ff]" />
              )}
            </div>
          );
        })}
      </pre>
    </div>
  );
}

export function Problem() {
  return (
    <section id="problem" aria-labelledby="problem-title" className="relative py-28 md:py-40">
      <div className="shell grid gap-14 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-6">
          <Chapter n={1} name="the problem" id="problem-title" title={<>You know the command. But do you know what changed?</>}>
            <p>
              You run <code className="rounded bg-violet-wash px-1.5 py-0.5 font-mono text-[0.92em] text-violet-ink">git commit</code>.
              A success message appears. Then the questions start.
            </p>
          </Chapter>

          <ul className="mt-10 space-y-3">
            {questions.map((q, i) => (
              <motion.li
                key={q}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-10% 0px" }}
                transition={{ delay: 0.5 + i * 0.35, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-baseline gap-4 border-b border-line pb-3 text-[1.15rem] text-ink"
              >
                <span className="display text-2xl italic text-violet">?</span>
                {q}
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col justify-end lg:col-span-6 lg:pl-6">
          <Terminal />
          <div className="mt-5 grid grid-cols-3 gap-3" aria-hidden="true">
            {["object", "object", "object"].map((o, i) => (
              <div
                key={i}
                className="grid h-20 place-items-center rounded-xl border border-dashed border-line-2 font-mono text-[0.8rem] text-ink-3"
              >
                {o} ?
              </div>
            ))}
          </div>
          <p className="mt-10 display text-[clamp(1.8rem,3vw,2.5rem)] leading-tight text-ink">
            The command worked. <span className="text-ink-3">The mental model is still missing.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
