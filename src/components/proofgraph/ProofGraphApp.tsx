"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CircleHelp, Clock, Link2Off, Loader2, Play, Sparkles, Spline, Target } from "lucide-react";
import type { Candidate } from "@/features/changeverse/candidates";
import { evaluate, type EvaluatedSymbol, type ProofGraph, type SymbolState } from "@/features/proofgraph/evidence";
import { StatusBadge } from "@/components/impact-studio/hud/ui";
import { PrismMark } from "@/components/brand/PrismMark";
import { short } from "@/lib/git";

/**
 * ProofGraph — what evidence stands behind a change.
 *
 * Grouped by how much each connection is worth, gaps first, because the symbols nothing reaches
 * are the ones a reviewer has to think about. Nothing on this screen is added up: there is no
 * score, and "verified" rates the link, never the correctness of the code.
 */

type Run =
  | { status: "idle" }
  | { status: "running" }
  | { status: "error"; message: string }
  | { status: "done"; candidate: string; graph: ProofGraph };

/** Order is the reading order: what was never checked comes before what was. */
const SECTIONS: { state: SymbolState; title: string; blurb: string; icon: typeof Target; cls: string; rule: string }[] = [
  {
    state: "missing",
    title: "No evidence found",
    blurb:
      "Nothing in this repository was found that reaches these. That is the limit of the search, not a verdict: a test somewhere else, or one that reaches them dynamically, would be invisible here.",
    icon: Link2Off,
    cls: "text-[#FFD166] border-[#FFB800]/35 bg-[#FFB800]/10",
    rule: "border-[#FFB800]/50",
  },
  {
    state: "stale",
    title: "Stale evidence",
    blurb: "These results were recorded at a different revision, so they describe code that is no longer the code in front of you.",
    icon: Clock,
    cls: "text-[var(--ink-2)] border-white/12 bg-white/5",
    rule: "border-white/20",
  },
  {
    state: "inferred",
    title: "Reached only indirectly",
    blurb:
      "A test exercises something that calls these, so they are covered by deduction rather than demonstration. Whether execution really reaches them is an inference — but read the results anyway, because an indirect test can still fail.",
    icon: Spline,
    cls: "text-[#7DF5FF] border-[#00F0FF]/30 bg-[#00F0FF]/10",
    rule: "border-[#00F0FF]/40",
  },
  {
    state: "verified",
    title: "Called directly by a test",
    blurb:
      "A test calls these by name and ran at this revision, so the connection is demonstrated rather than deduced. That rates the link, not the code: a verified symbol can still be wrong, and a passing test still only checks what it checks.",
    icon: Target,
    cls: "text-[#3DE0A6] border-[#00D995]/35 bg-[#00D995]/12",
    rule: "border-[#00D995]/45",
  },
];

const RESULT_CLS: Record<string, string> = {
  pass: "text-[#3DE0A6]",
  fail: "text-[#FF8FB0]",
  error: "text-[#FFD166]",
  missing: "text-[var(--ink-3)]",
};

export function ProofGraphApp({ owner, repo, list }: { owner: string; repo: string; list: Candidate[] }) {
  const [selected, setSelected] = useState(list[0]?.id ?? "");
  const [run, setRun] = useState<Run>({ status: "idle" });

  const current = list.find((c) => c.id === selected);
  // Evidence is always rated against the revision being read, never the one it was collected at.
  const ev = useMemo(
    () => (run.status === "done" && current ? evaluate(run.graph, current.head) : null),
    [run, current],
  );

  const go = async () => {
    setRun({ status: "running" });
    try {
      const res = await fetch(`/api/repos/${owner}/${repo}/proofgraph`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate: selected }),
      });
      const data = await res.json();
      if (!res.ok) return setRun({ status: "error", message: data.error ?? `Evidence collection failed (${res.status}).` });
      setRun({ status: "done", candidate: data.candidate, graph: data.graph });
    } catch {
      setRun({ status: "error", message: "Could not reach the evidence service. Nothing was collected." });
    }
  };

  return (
    <main className="studio min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[#08070f]/92 px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-3">
          <Link href="/" aria-label="GitPrism home">
            <PrismMark className="h-6 w-6" />
          </Link>
          <div className="mr-auto">
            <h1 className="text-[15px] font-semibold leading-tight">ProofGraph</h1>
            <p className="font-mono text-[11px] text-[var(--ink-3)]">
              {owner}/{repo}
            </p>
          </div>

          <label htmlFor="pg-candidate" className="sr-only">
            Change to collect evidence for
          </label>
          <select id="pg-candidate" value={selected} onChange={(e) => setSelected(e.target.value)} className="tf-input max-w-[22rem] flex-1 text-[12.5px]">
            {list.map((c) => (
              <option key={c.id} value={c.id}>
                {c.kind === "pull" ? c.label : `commit · ${c.label}`}
              </option>
            ))}
          </select>
          <button type="button" onClick={go} disabled={run.status === "running"} className="btn btn-primary btn-sm">
            {run.status === "running" ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {run.status === "running" ? "Collecting" : "Collect evidence"}
          </button>
        </div>
        {current && <p className="mx-auto mt-2 max-w-[1200px] font-mono text-[11px] text-[var(--ink-3)]">{current.detail}</p>}
      </header>

      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6">
        {run.status === "idle" && <Idle />}
        {run.status === "running" && <Running />}
        {run.status === "error" && <Failed message={run.message} onRetry={go} />}
        {run.status === "done" && ev && <Report ev={ev} onRecollect={go} />}
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- */

function Idle() {
  return (
    <div className="hud mx-auto max-w-2xl p-8 text-center">
      <Sparkles size={26} className="mx-auto text-[var(--violet)]" />
      <h2 className="mt-4 text-lg font-semibold">No evidence collected yet</h2>
      <p className="mx-auto mt-3 max-w-prose text-[13.5px] leading-relaxed text-[var(--ink-2)]">
        Pick a change and collect its evidence. GitPrism finds every test that reaches each changed
        function, runs it, and rates the connection by how much it is actually worth — separating what a test
        demonstrates from what it merely implies, and showing what nothing reaches at all.
      </p>
      <p className="mt-4 font-mono text-[11px] text-[var(--ink-3)]">No score is produced. Tests run in a sandbox, on committed fixture code only.</p>
    </div>
  );
}

function Running() {
  return (
    <div className="hud mx-auto max-w-2xl p-8 text-center" aria-live="polite">
      <Loader2 size={26} className="mx-auto animate-spin text-[var(--violet)]" />
      <h2 className="mt-4 text-lg font-semibold">Collecting evidence</h2>
      <p className="mt-2 text-[13.5px] text-[var(--ink-2)]">Finding the tests that reach each changed function, then running them.</p>
    </div>
  );
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="hud mx-auto max-w-2xl p-8 text-center" role="alert">
      <AlertTriangle size={26} className="mx-auto text-[#FFD166]" />
      <h2 className="mt-4 text-lg font-semibold">No evidence was collected</h2>
      <p className="mt-2 text-[13.5px] text-[var(--ink-2)]">{message}</p>
      <p className="mt-2 text-[12.5px] text-[var(--ink-3)]">Nothing is shown, because nothing was gathered.</p>
      <button type="button" onClick={onRetry} className="btn btn-ghost btn-sm mx-auto mt-5">
        Try again
      </button>
    </div>
  );
}

function Report({ ev, onRecollect }: { ev: NonNullable<ReturnType<typeof evaluate>>; onRecollect: () => void }) {
  const total = ev.symbols.length;

  return (
    <div className="space-y-5">
      {ev.stale && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#FFB800]/35 bg-[#FFB800]/10 px-4 py-3 text-[13px] text-[#FFD166]" role="status">
          <Clock size={16} className="shrink-0" />
          <span className="mr-auto">
            This evidence was collected at <span className="font-mono">{short(ev.graph.revision)}</span>, and you are reading{" "}
            <span className="font-mono">{short(ev.currentRevision)}</span>. Every result below is stale until it is collected again.
          </span>
          <button type="button" onClick={onRecollect} className="btn btn-ghost btn-sm">
            Collect for this revision
          </button>
        </div>
      )}

      <div className="hud flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <p className="text-[13px] leading-relaxed text-[var(--ink-2)]">
          {total === 0 ? (
            <>This change touched no function the analyser recognises, so there is nothing to stand evidence behind.</>
          ) : ev.counts.missing > 0 ? (
            <>
              <strong className="font-semibold text-[var(--ink)]">
                {ev.counts.missing} of {total}
              </strong>{" "}
              changed {total === 1 ? "symbol has" : "symbols have"} no test that reaches {ev.counts.missing === 1 ? "it" : "them"}. That is
              the shape of what was checked — not a verdict on whether the code is right.
            </>
          ) : (
            <>Every changed symbol has at least one test reaching it. What that is worth depends on whether the connection is direct or inferred.</>
          )}
        </p>
        <p className="shrink-0 font-mono text-[11px] text-[var(--ink-3)] md:ml-auto md:text-right">
          analysis {ev.graph.analysisVersion}
          <br />
          {short(ev.graph.base)}..{short(ev.graph.revision)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <span key={s.state} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${s.cls}`}>
            <s.icon size={15} />
            <span className="font-mono text-[17px] leading-none">{ev.counts[s.state]}</span>
            <span className="text-[12px] opacity-90">{s.title.toLowerCase()}</span>
          </span>
        ))}
      </div>

      {SECTIONS.map((section) => {
        const rows = ev.symbols.filter((s) => s.state === section.state);
        if (!rows.length) return null;
        return (
          <section key={section.state} className="hud p-4" aria-labelledby={`pg-${section.state}`}>
            <header className="border-b border-[var(--line-2)] pb-3">
              <h2 id={`pg-${section.state}`} className="flex items-center gap-2 text-[14px] font-semibold">
                <section.icon size={16} className={section.cls.split(" ")[0]} /> {section.title}
                <span className="font-mono text-[12px] font-normal text-[var(--ink-3)]">{rows.length}</span>
              </h2>
              <p className="mt-1.5 max-w-prose text-[12.5px] leading-relaxed text-[var(--ink-3)]">{section.blurb}</p>
            </header>
            <ul className="mt-3 space-y-2.5">
              {rows.map((s) => (
                <SymbolRow key={s.id} symbol={s} rule={section.rule} />
              ))}
            </ul>
          </section>
        );
      })}

      <div className="hud p-4">
        <h2 className="text-[11px] font-semibold text-[var(--ink-3)]">What this evidence does not tell you</h2>
        <ul className="mt-2 space-y-1.5">
          {ev.graph.limitations.map((l) => (
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

function SymbolRow({ symbol, rule }: { symbol: EvaluatedSymbol; rule: string }) {
  return (
    <li className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[13px] text-[var(--ink)]">{symbol.name}()</span>
        <StatusBadge status={symbol.changeStatus} />
        {symbol.signatureChanged && (
          <span className="rounded bg-[#FF007A]/15 px-1.5 py-px font-mono text-[10.5px] text-[#FF8FB0]">signature changed</span>
        )}
        <span className="ml-auto font-mono text-[11px] text-[var(--ink-3)]">{symbol.path}</span>
      </div>

      {/* The connection itself: a rule whose style says how much the link is worth. */}
      {symbol.links.length === 0 ? (
        <p className={`mt-2.5 border-l-2 border-dashed ${rule} pl-3 text-[12.5px] text-[var(--ink-3)]`}>
          No test reaches this symbol.
        </p>
      ) : (
        <ul className={`mt-2.5 space-y-2 border-l-2 ${symbol.state === "verified" ? "" : "border-dashed"} ${rule} pl-3`}>
          {symbol.links.map((l) => (
            <li key={l.id}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[12.5px] text-[var(--ink)]">{l.testName}</span>
                <span className="font-mono text-[11px] text-[var(--ink-3)]">{l.testPath}</span>
                <span className="rounded bg-white/5 px-1.5 py-px font-mono text-[10.5px] text-[var(--ink-3)]">
                  {l.direct ? "calls it directly" : `${l.distance} hop${l.distance === 1 ? "" : "s"} away`}
                </span>
                <span className={`ml-auto font-mono text-[11px] ${RESULT_CLS[l.result.status] ?? ""}`}>
                  {l.result.status}
                  <span className="text-[var(--ink-3)]"> at {short(l.result.revision)}</span>
                </span>
              </div>
              {l.result.status !== "pass" && (
                <p className="mt-1 rounded bg-black/30 px-2 py-1 font-mono text-[11px] leading-relaxed text-[var(--ink-2)]">{l.result.detail}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
