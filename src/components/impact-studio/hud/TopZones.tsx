"use client";

import Link from "next/link";
import { Activity, Bot, Check, ChevronDown, CircleAlert, Cuboid, Gauge, GitBranch, Link2, Loader2, RefreshCw, SlidersHorizontal, Square } from "lucide-react";
import { FIXTURE } from "@/features/impact-analysis/fixture";
import { PrismMark } from "@/components/brand/PrismMark";
import { short } from "@/lib/git";
import { LENSES, type LensId, type Projection } from "../lens-layouts";
import { useStudio, type AnalysisStatus } from "../store";
import { HudButton, Popover } from "./ui";

const STATUS: Record<AnalysisStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  idle: { label: "Not analyzed", cls: "text-[#9a90ad]", icon: <Square size={11} /> },
  analyzing: { label: "Analyzing", cls: "text-[#FFB800]", icon: <Loader2 size={12} className="animate-spin" /> },
  ready: { label: "Analysis ready", cls: "text-[#3DE0A6]", icon: <Check size={12} /> },
  stale: { label: "Stale, head changed", cls: "text-[#FFB800]", icon: <CircleAlert size={12} /> },
  error: { label: "Analysis failed", cls: "text-[#FF7A90]", icon: <CircleAlert size={12} /> },
};

/* ------------------------------------------------------------------ */
/* Zone A — repository and review context                             */
/* ------------------------------------------------------------------ */

export function ReviewContext({ compact = false }: { compact?: boolean }) {
  const s = useStudio();
  const r = s.result;
  const st = STATUS[s.status];
  const head = s.history.commits.find((c) => c.oid === s.headOid)!;
  const changedSymbols = r?.nodes.filter((n) => n.kind === "symbol" && n.changeStatus !== "unchanged").length ?? 0;
  const testsLinked = r ? new Set(r.edges.filter((e) => e.kind === "tests").map((e) => e.source)).size : 0;

  return (
    <section aria-label="Review context" className="hud p-3">
      <div className="flex items-center gap-2">
        <Link href="/" aria-label="GitPrism home" className="shrink-0 rounded-md">
          <PrismMark className="h-6 w-6" />
        </Link>
        <Popover
          label="Switch repository"
          className="flex min-w-0 items-center gap-1 rounded-md px-1 text-left text-[13px] font-semibold hover:bg-white/8"
          panel={() => (
            <div className="text-[12px]">
              <p className="font-semibold">Repositories in this build</p>
              <p className="mt-2 flex items-center justify-between rounded-lg bg-white/6 px-2 py-1.5 font-mono">
                {FIXTURE.owner}/{FIXTURE.repo}
                <span className="rounded bg-[#FFB800]/15 px-1.5 text-[10px] text-[#FFD166]">fixture</span>
              </p>
              <p className="mt-2 leading-relaxed text-[#9a90ad]">
                Reviewing your own GitHub or GitLab pull requests needs a repository provider, which isn&apos;t configured yet. This fixture is a real
                small TypeScript project with a real four-commit pull request.
              </p>
            </div>
          )}
        >
          <span className="truncate font-mono">
            {FIXTURE.owner}/<span className="text-white">{FIXTURE.repo}</span>
          </span>
          <ChevronDown size={13} className="shrink-0 text-[#9a90ad]" />
        </Popover>
        <Link href="/lab" className="ml-auto shrink-0 rounded-md px-1.5 py-px text-[11px] text-[#c9c0d8] hover:bg-white/8 hover:text-white">
          Lab
        </Link>
        <Link
          href={`/timefold/${FIXTURE.owner}/${FIXTURE.repo}`}
          className="shrink-0 rounded-md px-1.5 py-px text-[11px] text-[#c9c0d8] hover:bg-white/8 hover:text-white"
        >
          History
        </Link>
        <Link
          href={`/mergelab/${FIXTURE.owner}/${FIXTURE.repo}`}
          className="shrink-0 rounded-md px-1.5 py-px text-[11px] text-[#c9c0d8] hover:bg-white/8 hover:text-white"
        >
          Merge
        </Link>
        <span className="shrink-0 rounded bg-[#FFB800]/15 px-1.5 py-px text-[10px] text-[#FFD166]" title="Sample data analyzed in your browser">
          Fixture
        </span>
      </div>

      {!compact && (
        <p className="mt-2 text-[13.5px] font-medium leading-snug">
          <span className="font-mono text-[#9a90ad]">#{FIXTURE.number}</span> {FIXTURE.title}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Popover
          label="Choose base and head"
          className="flex h-7 items-center gap-1.5 rounded-lg bg-white/6 px-2 font-mono text-[11.5px] hover:bg-white/10"
          panelClassName="w-[22rem]"
          panel={(close) => (
            <div className="text-[12px]">
              <p className="font-semibold">Comparison range</p>
              <p className="mt-2 text-[#9a90ad]">Base (tip of {FIXTURE.target})</p>
              <p className="mt-1 rounded-lg bg-white/6 px-2 py-1.5 font-mono">
                {short(s.history.base.oid)} {s.history.base.message}
              </p>
              <p className="mt-3 text-[#9a90ad]">Head ({FIXTURE.source})</p>
              <ul className="mt-1 space-y-0.5" role="radiogroup" aria-label="Head commit">
                {s.history.commits.map((c, i) => (
                  <li key={c.oid}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={c.oid === s.headOid}
                      onClick={() => {
                        s.setHeadOid(c.oid);
                        close();
                        if (c.oid !== s.result?.head) s.notify("Head changed. Re-analyze to update the results.");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/8 aria-checked:bg-[#7C3AED]/25"
                    >
                      <span className="font-mono text-[#FFD166]">{short(c.oid)}</span>
                      <span className="min-w-0 flex-1 truncate">{c.message}</span>
                      <span className="text-[10.5px] text-[#9a90ad]">{i + 1}/{s.history.commits.length}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-[#9a90ad]">Changing the head marks the current analysis stale until you re-analyze.</p>
            </div>
          )}
        >
          <GitBranch size={12} className="text-[#00F0FF]" />
          {FIXTURE.source} → {FIXTURE.target}
        </Popover>

        <Popover
          label={`Analysis status: ${st.label}`}
          className={`flex h-7 items-center gap-1.5 rounded-lg bg-white/6 px-2 text-[11.5px] hover:bg-white/10 ${st.cls}`}
          panelClassName="w-80"
          panel={() => (
            <div className="text-[12px]">
              <p className={`font-semibold ${st.cls}`}>{st.label}</p>
              {s.status === "analyzing" && <p className="mt-1 text-[#9a90ad]">{s.stageLabel}</p>}
              {s.error && <p className="mt-1 text-[#FF7A90]">{s.error}</p>}
              {r && (
                <dl className="mt-2 space-y-1 text-[#c9c0d8]">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#9a90ad]">Ran at</dt>
                    <dd>{new Date(r.analyzedAt).toLocaleTimeString()}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#9a90ad]">Analyzed head</dt>
                    <dd className="font-mono">{short(r.head)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#9a90ad]">Selected head</dt>
                    <dd className="font-mono">{short(s.headOid)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#9a90ad]">Analysis version</dt>
                    <dd className="font-mono">{r.version}</dd>
                  </div>
                </dl>
              )}
              {r && (
                <>
                  <p className="mt-3 text-[11px] font-semibold text-[#9a90ad]">Measured stage timings</p>
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                    {r.stages.map((st) => (
                      <li key={st.id} className="flex justify-between gap-2">
                        <span className="truncate font-sans">{st.label}</span>
                        <span>{st.ms.toFixed(1)} ms</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <button type="button" onClick={s.runAnalysis} disabled={s.status === "analyzing"} className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#7C3AED] text-[12px] font-medium text-white disabled:opacity-40">
                <RefreshCw size={12} /> Re-analyze
              </button>
            </div>
          )}
        >
          {st.icon}
          {st.label}
        </Popover>
      </div>

      {!compact && (
        <>
          <p className="mt-2 font-mono text-[11px] text-[#9a90ad]">
            base {short(s.history.base.oid)} · head {short(head.oid)}
          </p>
          <dl className="mt-2.5 grid grid-cols-3 gap-1.5">
            {[
              { k: "Changed files", v: r?.changes.length },
              { k: "Changed symbols", v: changedSymbols },
              { k: "Tests linked", v: testsLinked },
            ].map((m) => (
              <div key={m.k} className="rounded-lg bg-white/5 px-2 py-1.5">
                <dt className="text-[10.5px] text-[#9a90ad]">{m.k}</dt>
                <dd className="font-mono text-[17px] text-white">{r ? m.v : "—"}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Zone B — lens dock                                                  */
/* ------------------------------------------------------------------ */

export function LensDock() {
  const s = useStudio();
  return (
    <nav aria-label="Analysis lenses" className="hud flex max-w-full gap-0.5 overflow-x-auto p-1">
      {LENSES.map((l) => (
        <button
          key={l.id}
          type="button"
          aria-pressed={s.lens === l.id}
          onClick={() => s.setLens(l.id as LensId)}
          title={`${l.label}: ${l.purpose} (press ${l.id})`}
          className="group flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/6 aria-pressed:bg-white/10"
        >
          <span className="h-2 w-2 rounded-full" style={{ background: l.color, boxShadow: s.lens === l.id ? `0 0 10px ${l.color}` : undefined }} />
          <span className="text-[12px] text-[#c9c0d8] group-aria-pressed:text-white">
            <span className="font-mono xl:hidden">{l.id}</span>
            <span className="hidden xl:inline 2xl:hidden">{l.tiny}</span>
            <span className="hidden 2xl:inline">{l.short}</span>
          </span>
          <span className="hidden 2xl:inline">
            <span className="kbd">{l.id}</span>
          </span>
        </button>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Zone C — telemetry and controls                                     */
/* ------------------------------------------------------------------ */

export function Telemetry({ projection, fps }: { projection: Projection | null; fps: number | null }) {
  const s = useStudio();
  const nodes = projection ? [...projection.nodes.values()].filter((p) => p.emphasis !== "dim").length : 0;
  const edges = projection?.edges.length ?? 0;

  const share = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("lens", String(s.lens));
    if (s.selected) url.searchParams.set("node", s.selected);
    else url.searchParams.delete("node");
    try {
      await navigator.clipboard.writeText(url.toString());
      s.notify("Review permalink copied.");
    } catch {
      s.notify(url.toString());
    }
  };

  return (
    <section aria-label="Analysis controls" className="hud flex flex-wrap items-center gap-0.5 p-1">
      <span className="flex h-8 items-center gap-1.5 px-2 font-mono text-[11px] text-[#c9c0d8]" title="Nodes and edges in the current view">
        <Activity size={12} className="text-[#00F0FF]" />
        {nodes}n · {edges}e
      </span>
      <HudButton label={s.showFps ? "Hide rendering performance" : "Show rendering performance"} pressed={s.showFps} onClick={() => s.setShowFps(!s.showFps)}>
        <Gauge size={14} />
        {s.showFps && <span className="font-mono text-[11px]">{fps ?? "…"} fps</span>}
      </HudButton>
      <Popover
        label="Filters"
        align="right"
        className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] text-[#c9c0d8] hover:bg-white/8"
        panelClassName="w-64"
        panel={() => (
          <div className="text-[12px]">
            <p className="font-semibold">Relationships</p>
            {(["imports", "calls", "tests"] as const).map((k) => (
              <label key={k} className="mt-1.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="h-[3px] w-4 rounded-full" style={{ background: k === "imports" ? "#00F0FF" : k === "calls" ? "#9D7BFF" : "#41B27F" }} />
                  {k === "imports" ? "Imports" : k === "calls" ? "Calls" : "Tests"}
                </span>
                <input type="checkbox" checked={s.layers[k]} onChange={(e) => s.setLayers({ [k]: e.target.checked })} className="accent-[#7C3AED]" />
              </label>
            ))}
            <label className="mt-3 block">
              <span className="flex justify-between">
                Blast-radius depth <span className="font-mono">{s.depth}</span>
              </span>
              <input type="range" min={1} max={4} value={s.depth} onChange={(e) => s.setDepth(Number(e.target.value))} className="mt-1 w-full accent-[#FF007A]" />
            </label>
          </div>
        )}
      >
        <SlidersHorizontal size={14} /> <span className="hidden 2xl:inline">Filters</span>
      </Popover>
      <HudButton label={s.view3d ? "Switch to 2D view" : "Switch to 3D view"} onClick={() => s.setView3d(!s.view3d)}>
        <Cuboid size={14} />
        <span className="font-mono text-[11px]">{s.view3d ? "3D" : "2D"}</span>
      </HudButton>
      <HudButton
        label="Re-analyze"
        onClick={s.runAnalysis}
        disabled={s.status === "analyzing"}
        className={s.status === "stale" ? "text-[#FFD166]" : ""}
      >
        <RefreshCw size={14} className={s.status === "analyzing" ? "animate-spin" : ""} />
      </HudButton>
      <HudButton label="Copy review permalink" onClick={share}>
        <Link2 size={14} />
      </HudButton>
      <HudButton label="Open Agent Hub" pressed={s.agentOpen} onClick={() => s.setAgentOpen(!s.agentOpen)} className="text-white">
        <Bot size={14} /> <span className="hidden lg:inline">Agent Hub</span>
      </HudButton>
    </section>
  );
}
