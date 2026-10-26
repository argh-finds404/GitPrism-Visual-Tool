"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CircleHelp, FlaskConical, Loader2, Play, ScanSearch, ShieldQuestion } from "lucide-react";
import type { Candidate } from "@/features/changeverse/candidates";
import type { Preflight, SymbolVerdict, TestComparison, TestVerdict } from "@/features/changeverse/preflight";
import type { Finding } from "@/features/impact-analysis/types";
import { FindingBadge, SectionTitle, StatusBadge } from "@/components/impact-studio/hud/ui";
import { PrismMark } from "@/components/brand/PrismMark";
import { short } from "@/lib/git";

/**
 * ChangeVerse — the preflight screen.
 *
 * Two kinds of claim, kept apart on purpose: what the analysis predicts from reading the code,
 * and what the tests reported when they actually ran at both revisions. Nothing here combines
 * them into a score, and the copy never lets a green suite stand for a safe change.
 */

type Run =
  | { status: "idle" }
  | { status: "running" }
  | { status: "error"; message: string }
  | { status: "done"; candidate: string; result: Preflight; findings: Finding[] };

const TEST_STYLE: Record<TestVerdict, { label: string; cls: string; evidence: boolean }> = {
  "newly-failing": { label: "Newly failing", cls: "border-[#FF007A]/40 bg-[#FF007A]/12 text-[#FF8FB0]", evidence: true },
  "newly-passing": { label: "Newly passing", cls: "border-[#00D995]/35 bg-[#00D995]/12 text-[#3DE0A6]", evidence: true },
  "still-passing": { label: "Still passing", cls: "border-white/10 bg-white/4 text-[#9a90ad]", evidence: true },
  "still-failing": { label: "Failing before and after", cls: "border-[#FFB800]/35 bg-[#FFB800]/10 text-[#FFD166]", evidence: true },
  "new-test": { label: "New test", cls: "border-[#00F0FF]/30 bg-[#00F0FF]/10 text-[#7DF5FF]", evidence: false },
  removed: { label: "Removed", cls: "border-white/10 bg-white/4 text-[#9a90ad]", evidence: false },
  unavailable: { label: "Unavailable", cls: "border-white/12 bg-white/5 text-[#9a90ad]", evidence: false },
};

const SYMBOL_STYLE: Record<SymbolVerdict, { label: string; cls: string; blurb: string }> = {
  confirmed: {
    label: "Confirmed by a test",
    cls: "border-[#FF007A]/40 bg-[#FF007A]/12 text-[#FF8FB0]",
    blurb: "A test that reaches this symbol passed at base and fails at head.",
  },
  "not-reproduced": {
    label: "Not reproduced",
    cls: "border-[#FFB800]/35 bg-[#FFB800]/10 text-[#FFD166]",
    blurb: "Tests that reach it ran and still pass. That is not the same as the prediction being wrong.",
  },
  unverified: {
    label: "Unverified",
    cls: "border-white/12 bg-white/5 text-[#c9c0d8]",
    blurb: "No test that reaches it produced a usable result, so there is no evidence either way.",
  },
};

export function ChangeVerseApp({ owner, repo, list }: { owner: string; repo: string; list: Candidate[] }) {
  const [selected, setSelected] = useState(list[0]?.id ?? "");
  const [run, setRun] = useState<Run>({ status: "idle" });

  // A finished run describes the change it was run against, not whatever is picked now.
  const stale = run.status === "done" && run.candidate !== selected;
  const current = list.find((c) => c.id === selected);

  const go = async () => {
    setRun({ status: "running" });
    try {
      const res = await fetch(`/api/repos/${owner}/${repo}/preflight`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate: selected }),
      });
      const data = await res.json();
      if (!res.ok) return setRun({ status: "error", message: data.error ?? `The preflight failed (${res.status}).` });
      setRun({ status: "done", candidate: data.candidate, result: data.result, findings: data.findings });
    } catch {
      setRun({ status: "error", message: "Could not reach the preflight service. Nothing was run." });
    }
  };

  return (
    <main className="studio min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[#08070f]/92 px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-3">
          <Link href="/" aria-label="GitPrism home" className="flex items-center gap-2">
            <PrismMark className="h-6 w-6" />
          </Link>
          <div className="mr-auto">
            <h1 className="text-[15px] font-semibold leading-tight">ChangeVerse</h1>
            <p className="font-mono text-[11px] text-[var(--ink-3)]">
              {owner}/{repo}
            </p>
          </div>

          <label htmlFor="cv-candidate" className="sr-only">
            Change to preflight
          </label>
          <select
            id="cv-candidate"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="tf-input max-w-[22rem] flex-1 text-[12.5px]"
          >
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.kind === "pull" ? c.label : `commit · ${c.label}`}
              </option>
            ))}
          </select>
          <button type="button" onClick={go} disabled={run.status === "running"} className="btn btn-primary btn-sm">
            {run.status === "running" ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {run.status === "running" ? "Running" : "Run preflight"}
          </button>
        </div>
        {current && <p className="mx-auto mt-2 max-w-[1400px] font-mono text-[11px] text-[var(--ink-3)]">{current.detail}</p>}
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        {run.status === "idle" && <Idle />}
        {run.status === "running" && <Running />}
        {run.status === "error" && <Failed message={run.message} onRetry={go} />}
        {run.status === "done" && <Report result={run.result} findings={run.findings} stale={stale} onRerun={go} />}
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- */
/* States before a result                                            */
/* ---------------------------------------------------------------- */

function Idle() {
  return (
    <div className="hud mx-auto max-w-2xl p-8 text-center">
      <ScanSearch size={26} className="mx-auto text-[var(--violet)]" />
      <h2 className="mt-4 text-lg font-semibold">Nothing has been run yet</h2>
      <p className="mx-auto mt-3 max-w-prose text-[13.5px] leading-relaxed text-[var(--ink-2)]">
        Pick a change and run the preflight. GitPrism analyses the diff to predict what could be affected, then runs the
        repository&apos;s tests at both the base and the candidate revision, so you can see what actually changed next to
        what was merely expected.
      </p>
      <p className="mt-4 font-mono text-[11px] text-[var(--ink-3)]">
        Tests execute in a sandbox with a one second limit, on committed fixture code only.
      </p>
    </div>
  );
}

function Running() {
  return (
    <div className="hud mx-auto max-w-2xl p-8 text-center" aria-live="polite">
      <Loader2 size={26} className="mx-auto animate-spin text-[var(--violet)]" />
      <h2 className="mt-4 text-lg font-semibold">Running the preflight</h2>
      <p className="mt-2 text-[13.5px] text-[var(--ink-2)]">Analysing the diff, then running each test at base and at head.</p>
    </div>
  );
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="hud mx-auto max-w-2xl p-8 text-center" role="alert">
      <AlertTriangle size={26} className="mx-auto text-[#FFD166]" />
      <h2 className="mt-4 text-lg font-semibold">The preflight didn&apos;t run</h2>
      <p className="mt-2 text-[13.5px] text-[var(--ink-2)]">{message}</p>
      <p className="mt-2 text-[12.5px] text-[var(--ink-3)]">No results are shown, because none were produced.</p>
      <button type="button" onClick={onRetry} className="btn btn-ghost btn-sm mx-auto mt-5">
        Try again
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* The report                                                        */
/* ---------------------------------------------------------------- */

function Report({ result, findings, stale, onRerun }: { result: Preflight; findings: Finding[]; stale: boolean; onRerun: () => void }) {
  const ran = result.tests.filter((t) => TEST_STYLE[t.verdict].evidence);
  const newlyFailing = result.tests.filter((t) => t.verdict === "newly-failing");
  const unavailable = result.tests.filter((t) => t.verdict === "unavailable");
  const confirmed = result.predicted.filter((s) => s.verdict === "confirmed");
  const unverified = result.predicted.filter((s) => s.verdict === "unverified");
  const missed = result.tests.filter((t) => result.missedByForecast.includes(t.id));

  return (
    <div className="space-y-5">
      {stale && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#FFB800]/35 bg-[#FFB800]/10 px-4 py-3 text-[13px] text-[#FFD166]" role="status">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="mr-auto">
            These results are from a different change than the one selected. They describe{" "}
            <span className="font-mono">
              {short(result.base)}..{short(result.head)}
            </span>
            .
          </span>
          <button type="button" onClick={onRerun} className="btn btn-ghost btn-sm">
            Run the selected change
          </button>
        </div>
      )}

      {/* The rule this whole screen is built on, stated once, in the open. */}
      <div className="hud flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">
          <strong className="font-semibold text-[var(--ink)]">Predicted</strong> comes from reading the code.{" "}
          <strong className="font-semibold text-[var(--ink)]">Observed</strong> comes from running the tests. Neither one
          stands in for the other.
        </p>
        <p className="shrink-0 font-mono text-[11px] text-[var(--ink-3)] md:ml-auto md:text-right">
          analysis {result.analysisVersion}
          <br />
          {short(result.base)}..{short(result.head)}
        </p>
      </div>

      {/* The headline the product exists to deliver. */}
      <Headline newlyFailing={newlyFailing.length} ran={ran.length} unverified={unverified.length} confirmed={confirmed.length} />

      {missed.length > 0 && (
        <div className="rounded-xl border border-[#FF007A]/40 bg-[#FF007A]/10 p-4">
          <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#FF8FB0]">
            <AlertTriangle size={15} /> {missed.length} test{missed.length > 1 ? "s" : ""} broke that the forecast never pointed at
          </h3>
          <ul className="mt-2 space-y-1">
            {missed.map((t) => (
              <li key={t.id} className="font-mono text-[12px] text-[var(--ink-2)]">
                {t.path} — {t.name}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12.5px] text-[var(--ink-2)]">
            Static analysis missed this path. That is a gap in the prediction, not in the test.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Predicted result={result} findings={findings} />
        <Observed tests={result.tests} unavailable={unavailable.length} />
      </div>

      <div className="hud p-4">
        <SectionTitle>What this run does not tell you</SectionTitle>
        <ul className="space-y-1.5">
          {result.limitations.map((l) => (
            <li key={l} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              <CircleHelp size={13} className="mt-0.5 shrink-0 text-[var(--ink-3)]" />
              {l}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** The one sentence a reviewer should leave with. */
function Headline({ newlyFailing, ran, unverified, confirmed }: { newlyFailing: number; ran: number; unverified: number; confirmed: number }) {
  const green = newlyFailing === 0;
  return (
    <div className={`rounded-xl border p-4 ${green ? "border-white/10 bg-white/4" : "border-[#FF007A]/40 bg-[#FF007A]/10"}`}>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <Stat n={ran} label="tests produced a result" />
        <Stat n={newlyFailing} label="newly failing" tone={newlyFailing ? "bad" : undefined} />
        <Stat n={confirmed} label="predictions confirmed" tone={confirmed ? "bad" : undefined} />
        <Stat n={unverified} label="changed symbols unverified" tone={unverified ? "warn" : undefined} />
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--ink-2)]">
        {green ? (
          unverified > 0 ? (
            <>
              No test broke. That is not the same as this change being safe —{" "}
              <strong className="font-semibold text-[var(--ink)]">{unverified}</strong> changed symbol
              {unverified > 1 ? "s have" : " has"} no test that reaches {unverified > 1 ? "them" : "it"}, so nothing was
              checked there.
            </>
          ) : (
            <>No test broke, and every changed symbol had at least one test reach it. The tests still only cover what they cover.</>
          )
        ) : (
          <>
            Running the change broke tests that passed before. Those are observations, not predictions: the failures below
            happened.
          </>
        )}
      </p>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "bad" | "warn" }) {
  const color = tone === "bad" ? "text-[#FF8FB0]" : tone === "warn" ? "text-[#FFD166]" : "text-[var(--ink)]";
  return (
    <span className="flex items-baseline gap-1.5">
      <span className={`font-mono text-[22px] leading-none ${color}`}>{n}</span>
      <span className="text-[12.5px] text-[var(--ink-3)]">{label}</span>
    </span>
  );
}

function Predicted({ result, findings }: { result: Preflight; findings: Finding[] }) {
  return (
    <section className="hud p-4" aria-labelledby="cv-predicted">
      <header className="border-b border-dashed border-[var(--line-2)] pb-3">
        <h2 id="cv-predicted" className="flex items-center gap-2 text-[14px] font-semibold">
          <ShieldQuestion size={16} className="text-[#FFD166]" /> Predicted
        </h2>
        <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">
          From reading the diff and the call graph. These are expectations, not results.
        </p>
      </header>

      {result.predicted.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--ink-3)]">This change touched no function the analyser recognises.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {result.predicted.map((s) => {
            const v = SYMBOL_STYLE[s.verdict];
            return (
              <li key={s.id} className="rounded-lg border border-l-2 border-[var(--line)] border-l-[#FFB800]/50 bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13px] text-[var(--ink)]">{s.name}()</span>
                  <StatusBadge status={s.changeStatus} />
                  {s.signatureChanged && (
                    <span className="rounded bg-[#FF007A]/15 px-1.5 py-px font-mono text-[10.5px] text-[#FF8FB0]">signature changed</span>
                  )}
                  <span className={`ml-auto rounded-full border px-2 py-px text-[10.5px] ${v.cls}`}>{v.label}</span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">{s.path}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{v.blurb}</p>
                {s.dependents.length > 0 && (
                  <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--ink-3)]">
                    <ArrowRight size={12} className="shrink-0" />
                    <span>may affect</span>
                    {s.dependents.slice(0, 6).map((d) => (
                      <span key={d.id} className="rounded bg-white/5 px-1.5 py-px font-mono text-[11px] text-[var(--ink-2)]">
                        {d.name}
                        <span className="text-[var(--ink-3)]"> ·{d.distance}</span>
                      </span>
                    ))}
                    {s.dependents.length > 6 && <span>and {s.dependents.length - 6} more</span>}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {findings.length > 0 && (
        <>
          <SectionTitle>Static findings for this change</SectionTitle>
          <ul className="space-y-1.5">
            {findings.slice(0, 6).map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
                <FindingBadge kind={f.kind} />
                <span>{f.title}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Observed({ tests, unavailable }: { tests: TestComparison[]; unavailable: number }) {
  return (
    <section className="hud p-4" aria-labelledby="cv-observed">
      <header className="border-b border-[var(--line-2)] pb-3">
        <h2 id="cv-observed" className="flex items-center gap-2 text-[14px] font-semibold">
          <FlaskConical size={16} className="text-[#3DE0A6]" /> Observed
        </h2>
        <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">
          Each test executed twice: once at the base revision, once at the candidate.
        </p>
      </header>

      {tests.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--ink-3)]">
          This revision has no tests the runner recognises, so nothing was observed. That is an absence of evidence, not a
          clean result.
        </p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {tests.map((t) => {
            const s = TEST_STYLE[t.verdict];
            return (
              <li key={t.id} className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-[var(--ink)]">{t.name}</span>
                  <span className={`ml-auto rounded-full border px-2 py-px text-[10.5px] ${s.cls}`}>{s.label}</span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">{t.path}</p>
                <p className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[11.5px]">
                  <Outcome label="base" status={t.base.status} />
                  <ArrowRight size={12} className="text-[var(--ink-3)]" />
                  <Outcome label="head" status={t.head.status} />
                  <span className="text-[var(--ink-3)]">{t.head.ms} ms</span>
                </p>
                {t.head.status !== "pass" && (
                  <p className="mt-1.5 rounded bg-black/30 px-2 py-1.5 font-mono text-[11.5px] leading-relaxed text-[var(--ink-2)]">
                    {t.head.detail}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {unavailable > 0 && (
        <p className="mt-3 rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
          {unavailable} test{unavailable > 1 ? "s" : ""} could not be executed by this runner. {unavailable > 1 ? "They are" : "It is"}{" "}
          reported as unavailable rather than failing, and {unavailable > 1 ? "they count" : "it counts"} as no evidence
          either way.
        </p>
      )}
    </section>
  );
}

const OUTCOME_COLOR: Record<string, string> = {
  pass: "text-[#3DE0A6]",
  fail: "text-[#FF8FB0]",
  missing: "text-[var(--ink-3)]",
  error: "text-[#FFD166]",
};

function Outcome({ label, status }: { label: string; status: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[var(--ink-3)]">{label}</span>
      <span className={OUTCOME_COLOR[status] ?? "text-[var(--ink-2)]"}>{status}</span>
    </span>
  );
}
