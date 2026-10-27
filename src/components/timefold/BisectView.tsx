"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, CircleSlash, Loader2, Search, X } from "lucide-react";
import { diffLines, short } from "@/lib/git";
import { usePrefersReducedMotion } from "@/lib/theme";
import { FIXTURE } from "@/features/impact-analysis/fixture";
import { nextProbe, recordProbe, startBisect, type BisectState } from "@/features/timefold/bisect";
import type { TestOutcome } from "@/features/timefold/test-runner";
import { C, useTimeFold } from "./store";

async function runTest(oid: string, test: string): Promise<TestOutcome> {
  const res = await fetch(`/api/repos/${FIXTURE.owner}/${FIXTURE.repo}/run-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oid, test }),
  });
  const body = await res.json();
  if (!res.ok) return { status: "error", detail: body.error ?? `Request failed (${res.status})`, ms: 0 };
  return { status: body.status, detail: body.detail, ms: body.ms };
}

const STATUS_UI = {
  pass: { icon: Check, color: C.green, label: "passed" },
  fail: { icon: X, color: C.red, label: "failed" },
  missing: { icon: CircleSlash, color: C.ink3, label: "can't run here, skipped" },
  error: { icon: CircleSlash, color: C.ink3, label: "can't run here, skipped" },
} as const;

/** Regression hunt: bisect between a known-good and a known-bad commit by running a real test. */
export function BisectView() {
  const { h, tests, bisect, setBisect, setIndex, setMode, setLineage } = useTimeFold();
  const reduce = usePrefersReducedMotion();
  const at = (m: string) => h.snapshots.findIndex((s) => s.commit.message === m);
  const [test, setTest] = useState("tests/pricing.test.ts#discounts large carts");
  const [good, setGood] = useState(Math.max(0, at("Discount large carts")));
  const [bad, setBad] = useState(Math.max(0, at("Add local environment template")));
  const [running, setRunning] = useState(false);
  const cancel = useRef(false);

  const run = async () => {
    cancel.current = false;
    setRunning(true);
    let s: BisectState = startBisect(good, bad);
    setBisect(s);
    try {
      for (let p = nextProbe(s); p !== null && !cancel.current; p = nextProbe(s)) {
        setIndex(p);
        const outcome = await runTest(h.snapshots[p].commit.oid, test);
        s = recordProbe(s, p, outcome);
        setBisect(s);
      }
      if (cancel.current && !s.result) {
        // Stopped by hand: say so, and end the search instead of leaving a live range behind.
        s = { ...s, result: { kind: "invalid", reason: `Stopped after ${s.probes.length} test run${s.probes.length === 1 ? "" : "s"}. No conclusion was drawn.` } };
        setBisect(s);
      }
      if (s.result?.kind === "found") setIndex(s.result.firstBad);
    } finally {
      setRunning(false);
    }
  };

  const result = bisect?.result;
  const culprit = result?.kind === "found" ? h.snapshots[result.firstBad] : null;
  const lastGood = result?.kind === "found" ? h.snapshots[result.lastGood] : null;
  const culpritProbe = culprit ? bisect!.probes.find((p) => p.index === culprit.index) : null;

  // What the first bad commit changed in source (tests excluded), for the verdict card.
  const culpritDiff = useMemo(() => {
    if (!culprit) return [];
    const parent = h.snapshots[culprit.index - 1];
    return culprit.analysis.changes
      .filter((c) => !c.path.startsWith("tests/"))
      .map((c) => ({ path: c.path, lines: diffLines(parent?.commit.files[c.path] ?? "", culprit.commit.files[c.path] ?? "").filter((l) => l.kind !== "same") }));
  }, [culprit, h]);

  const changedFns = culprit ? culprit.analysis.nodes.filter((n) => n.kind === "symbol" && (n.changeStatus === "modified" || n.changeStatus === "added")) : [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-auto pr-1">
      <header>
        <p className="font-mono text-[11px] text-[#9a90ad]">regression hunt</p>
        <h2 className="display text-[clamp(1.4rem,2.2vw,2rem)] text-white">Which commit broke it?</h2>
        <p className="mt-1 max-w-[46rem] text-[13px] leading-relaxed text-[#c9c0d8]">
          Pick a test, a commit where it passed and a commit where it fails. GitPrism runs the test for real at each commit bisect chooses (TypeScript stripped,
          executed in an isolated sandbox on the server) and halves the range until one commit is left.
        </p>
      </header>

      <form
        className="hud grid gap-3 p-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!running) void run();
        }}
      >
        <Field label="Test">
          <select value={test} onChange={(e) => setTest(e.target.value)} disabled={running} className="tf-input">
            {tests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.path.split("/").pop()} › {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Known good">
          <CommitSelect value={good} onChange={setGood} disabled={running} />
        </Field>
        <Field label="Known bad">
          <CommitSelect value={bad} onChange={setBad} disabled={running} />
        </Field>
        {running ? (
          <button type="button" onClick={() => (cancel.current = true)} className="flex h-10 items-center justify-center gap-2 rounded-full border border-white/15 px-5 text-[13px] text-white">
            <Loader2 size={15} className="animate-spin" /> Stop
          </button>
        ) : (
          <button type="submit" className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#9D7BFF] px-5 text-[13px] font-medium text-[#0b0816] hover:bg-[#b49cff]">
            <Search size={15} /> Start bisect
          </button>
        )}
      </form>

      {bisect && (
        <ol className="flex flex-col gap-1.5" aria-label="Bisect steps" aria-live="polite">
          {bisect.probes.map((p, k) => {
            const ui = STATUS_UI[p.outcome.status];
            const c = h.snapshots[p.index].commit;
            const role = p.index === bisect.good ? "known good" : p.index === bisect.bad ? "known bad" : `step ${k - 1}`;
            return (
              <motion.li
                key={`${p.index}-${k}`}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="grid grid-cols-[1.25rem_5.5rem_1fr] items-baseline gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-[12.5px] md:grid-cols-[1.25rem_5.5rem_1fr_auto]"
              >
                <ui.icon size={14} style={{ color: ui.color }} className="translate-y-0.5" aria-label={ui.label} />
                <span className="font-mono text-[11px] text-[#9a90ad]">{role}</span>
                <span className="min-w-0">
                  <span className="font-mono" style={{ color: C.amber }}>
                    {short(c.oid)}
                  </span>{" "}
                  <span className="text-white">{c.message}</span>
                  <span className="block truncate font-mono text-[11px]" style={{ color: ui.color }}>
                    {ui.label}
                    {p.outcome.status !== "pass" && ` · ${p.outcome.detail}`}
                  </span>
                </span>
                <span className="hidden font-mono text-[11px] text-[#9a90ad] md:block">{p.outcome.ms} ms</span>
              </motion.li>
            );
          })}
          {running && (
            <li className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-[#9a90ad]">
              <Loader2 size={14} className="animate-spin" /> Running the test at {short(h.snapshots[nextProbe(bisect) ?? bisect.bad].commit.oid)}…
            </li>
          )}
        </ol>
      )}

      {result?.kind === "invalid" && (
        <p className="rounded-xl border border-[#FFC15C]/30 bg-[#FFC15C]/10 p-4 text-[13px] text-[#FFD99A]">{result.reason}</p>
      )}

      {result?.kind === "ambiguous" && (
        <p className="rounded-xl border border-[#FFC15C]/30 bg-[#FFC15C]/10 p-4 text-[13px] text-[#FFD99A]">
          The test couldn&apos;t run at some commits in the range, so the first bad commit is one of:{" "}
          {result.candidates.map((i) => short(h.snapshots[i].commit.oid)).join(", ")}.
        </p>
      )}

      {culprit && culpritProbe && lastGood && (
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="hud p-4"
          aria-label="Bisect result"
        >
          <p className="font-mono text-[11px]" style={{ color: C.red }}>
            first bad commit (candidate)
          </p>
          <h3 className="mt-1 text-[17px] font-semibold text-white">
            <span className="font-mono" style={{ color: C.amber }}>
              {short(culprit.commit.oid)}
            </span>{" "}
            {culprit.commit.message}
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[#c9c0d8]">
            The test passes at {short(lastGood.commit.oid)}, the commit before it, and fails here with “{culpritProbe.outcome.detail}”. Found by
            running it at {bisect!.probes.length} of {bisect!.bad - bisect!.good + 1} commits. This pins down where the behaviour changed; whether the change was
            intended is for you to judge.
          </p>

          {culpritDiff.map((f) => (
            <div key={f.path} className="mt-3 overflow-hidden rounded-lg border border-white/8">
              <p className="border-b border-white/8 bg-white/[0.03] px-3 py-1.5 font-mono text-[11.5px] text-[#c9c0d8]">{f.path}</p>
              <pre className="overflow-x-auto py-1.5 font-mono text-[12px] leading-[1.65]">
                {f.lines.map((l, k) => (
                  <div key={k} className="px-3" style={{ background: l.kind === "add" ? "rgb(0 217 149 / 0.1)" : "rgb(255 0 122 / 0.1)", color: l.kind === "add" ? "#bff5df" : "#ffc2d1" }}>
                    {l.kind === "add" ? "+ " : "− "}
                    {l.text}
                  </div>
                ))}
              </pre>
            </div>
          ))}

          {changedFns.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[#9a90ad]">
              Follow a changed function:
              {changedFns.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setLineage(h.lineageOf.get(n.id) ?? n.id);
                    setIndex(culprit.index);
                    setMode("dna");
                  }}
                  className="rounded-full border border-white/15 px-2.5 py-1 font-mono text-[11.5px] text-[#c9c0d8] hover:border-[#9D7BFF] hover:text-white"
                >
                  {n.name}()
                </button>
              ))}
            </div>
          )}
        </motion.section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[11.5px] text-[#9a90ad]">
      {label}
      {children}
    </label>
  );
}

function CommitSelect({ value, onChange, disabled }: { value: number; onChange: (i: number) => void; disabled?: boolean }) {
  const { h } = useTimeFold();
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} className="tf-input">
      {h.snapshots.map((s) => (
        <option key={s.commit.oid} value={s.index}>
          {short(s.commit.oid)} {s.commit.message}
        </option>
      ))}
    </select>
  );
}
