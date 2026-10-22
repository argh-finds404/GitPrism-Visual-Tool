"use client";

import { useEffect, useMemo, useRef } from "react";
import { ArrowRight, FlaskConical, GitCompareArrows, X } from "lucide-react";
import { blastRadius, callees, directCallers, linkedTests, pathToCenter } from "@/features/impact-analysis/blast-radius";
import type { AnalysisResult, Finding, ImpactNode } from "@/features/impact-analysis/types";
import { DiffLines } from "@/components/diff/DiffLines";
import { diffLines } from "@/lib/git";
import { useStudio, type InspectorTab } from "../store";
import { FindingBadge, SectionTitle, StatusBadge } from "./ui";

const TABS: { id: InspectorTab; label: string }[] = [
  { id: "impact", label: "Impact" },
  { id: "calls", label: "Call graph" },
  { id: "tests", label: "Tests" },
  { id: "source", label: "Source" },
  { id: "evidence", label: "Evidence" },
];

export function ImpactInspector({ onClose }: { onClose?: () => void }) {
  const s = useStudio();
  const r = s.result;
  const node = r?.nodes.find((n) => n.id === s.selected) ?? null;

  return (
    <section aria-label="Impact inspector" className="hud flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
        <h2 className="text-[12px] font-semibold">{node ? "Selected" : "Review summary"}</h2>
        <span className="flex items-center gap-1.5">
          <span className="kbd">]</span>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close inspector" className="grid h-6 w-6 place-items-center rounded text-[#9a90ad] hover:text-white">
              <X size={14} />
            </button>
          )}
        </span>
      </div>
      {!r ? (
        <p className="p-3 text-[12px] text-[#9a90ad]">{s.status === "error" ? s.error : "Waiting for analysis…"}</p>
      ) : node ? (
        <NodeView r={r} node={node} />
      ) : (
        <Summary r={r} />
      )}
    </section>
  );
}

function useFindingNav() {
  const s = useStudio();
  return (f: Finding) => {
    s.setHighlight({ ids: new Set(f.nodeIds), label: f.title });
    s.select(f.nodeIds[0], { tab: "source" });
    s.setSourceLine(f.locations[0]?.line ?? null);
  };
}

function FindingCard({ f }: { f: Finding }) {
  const go = useFindingNav();
  return (
    <li>
      <button type="button" onClick={() => go(f)} className="w-full rounded-xl border border-white/8 bg-white/4 p-2.5 text-left hover:border-white/20">
        <span className="flex items-start justify-between gap-2">
          <span className="text-[12.5px] font-medium leading-snug text-white">{f.title}</span>
          <FindingBadge kind={f.kind} />
        </span>
        <span className="mt-1 block text-[11.5px] leading-relaxed text-[#c9c0d8]">{f.detail}</span>
        <span className="mt-1.5 block font-mono text-[10.5px] text-[#9a90ad]">{f.locations.map((l) => `${l.path}:${l.line}`).join(", ")}</span>
      </button>
    </li>
  );
}

function Summary({ r }: { r: AnalysisResult }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <p className="text-[12px] leading-relaxed text-[#c9c0d8]">
        {r.changes.length} files changed between base and head. Select a node, or open a finding to jump to its source.
      </p>
      <ul className="mt-3 space-y-2">
        {r.findings.map((f) => (
          <FindingCard key={f.id} f={f} />
        ))}
      </ul>
      <Limitations r={r} />
    </div>
  );
}

function Limitations({ r }: { r: AnalysisResult }) {
  return (
    <details className="mt-4 rounded-xl border border-white/8 p-2.5 text-[11.5px] text-[#9a90ad]">
      <summary className="cursor-pointer text-[#c9c0d8]">What this analysis can and can&apos;t see</summary>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        {r.limitations.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </details>
  );
}

function NodeView({ r, node }: { r: AnalysisResult; node: ImpactNode }) {
  const s = useStudio();
  const radius = useMemo(() => (node.changeStatus === "deleted" ? null : blastRadius(r, node.id, s.depth)), [r, node, s.depth]);
  const dependents = radius ? radius.distance.size - 1 : 0;
  const tests = radius?.tests.length ?? 0;
  const findings = r.findings.filter((f) => f.nodeIds.includes(node.id));
  const needsReview = findings.some((f) => f.kind === "static-warning");
  const line = node.sourceRange?.startLine;

  return (
    <>
      <div className="border-b border-white/8 p-3">
        <p className="text-[10.5px] text-[#9a90ad]">{node.kind === "file" ? "File" : node.kind === "test" ? "Test case" : "Symbol"}</p>
        <h3 className="mt-0.5 break-all font-mono text-[15px] text-white">{node.kind === "symbol" ? `${node.name}()` : node.name}</h3>
        <p className="mt-0.5 font-mono text-[11px] text-[#9a90ad]">
          {node.path}
          {line ? `:${line}` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={node.changeStatus} />
          {needsReview && <span className="rounded border border-[#FFB800]/30 bg-[#FFB800]/10 px-1.5 py-px text-[10.5px] text-[#FFD166]">Needs review</span>}
          {node.signatureChanged && <span className="rounded border border-[#FF007A]/30 bg-[#FF007A]/10 px-1.5 py-px text-[10.5px] text-[#FF7AB6]">Signature changed</span>}
          {s.lens === 4 && (
            <button type="button" onClick={() => s.toggleContext(node.id)} className="rounded border border-[#9D7BFF]/40 px-1.5 py-px text-[10.5px] text-[#C4B3FF] hover:bg-[#9D7BFF]/15">
              {s.context.has(node.id) ? "Remove from context" : "Add to context"}
            </button>
          )}
        </div>
        <dl className="mt-2.5 grid grid-cols-3 gap-1.5">
          <div className="rounded-lg bg-white/5 px-2 py-1.5">
            <dt className="text-[10.5px] text-[#9a90ad]">Dependents</dt>
            <dd className="font-mono text-[16px]">{radius ? dependents : "—"}</dd>
          </div>
          <div className="rounded-lg bg-white/5 px-2 py-1.5">
            <dt className="text-[10.5px] text-[#9a90ad]">Tests found</dt>
            <dd className="font-mono text-[16px]">{radius ? tests : "—"}</dd>
          </div>
          <div className="rounded-lg bg-white/5 px-2 py-1.5">
            <dt className="text-[10.5px] text-[#9a90ad]">Findings</dt>
            <dd className="font-mono text-[16px]">{findings.length}</dd>
          </div>
        </dl>
      </div>

      <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-white/8 px-2 py-1.5" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={s.inspectorTab === t.id}
            onClick={() => s.setInspectorTab(t.id)}
            className="h-7 shrink-0 rounded-md px-2.5 text-[11.5px] text-[#9a90ad] hover:text-white aria-selected:bg-white/10 aria-selected:text-white"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3" role="tabpanel">
        {s.inspectorTab === "impact" && <ImpactTab r={r} node={node} radius={radius} />}
        {s.inspectorTab === "calls" && <CallsTab r={r} node={node} />}
        {s.inspectorTab === "tests" && <TestsTab r={r} node={node} radius={radius} />}
        {s.inspectorTab === "source" && <SourceTab r={r} node={node} />}
        {s.inspectorTab === "evidence" && <EvidenceTab r={r} node={node} findings={findings} />}
      </div>
    </>
  );
}

function NodeLink({ r, id, suffix }: { r: AnalysisResult; id: string; suffix?: React.ReactNode }) {
  const s = useStudio();
  const n = r.nodes.find((x) => x.id === id);
  if (!n) return null;
  return (
    <button type="button" onClick={() => s.select(id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/6">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${n.kind === "file" ? "bg-[#8F7FE0]" : n.kind === "test" ? "bg-[#41B27F]" : "bg-[#3FB8D0]"}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[11.5px] text-white">{n.kind === "symbol" ? `${n.name}()` : n.name}</span>
        <span className="block truncate font-mono text-[10.5px] text-[#7d748f]">{n.path}</span>
      </span>
      {suffix}
    </button>
  );
}

function ImpactTab({ r, node, radius }: { r: AnalysisResult; node: ImpactNode; radius: ReturnType<typeof blastRadius> | null }) {
  const s = useStudio();
  if (!radius)
    return <p className="text-[12px] leading-relaxed text-[#c9c0d8]">This {node.kind} was deleted, so it has no dependents at head. Earlier callers are listed in Evidence if any remained.</p>;
  const byDist = new Map<number, string[]>();
  radius.distance.forEach((d, id) => d > 0 && (byDist.get(d) ?? byDist.set(d, []).get(d)!).push(id));
  const direct = byDist.get(1)?.length ?? 0;
  const transitive = radius.distance.size - 1 - direct;

  return (
    <div>
      <SectionTitle>Why this node is highlighted</SectionTitle>
      <p className="text-[12px] leading-relaxed text-[#c9c0d8]">
        {node.changeStatus === "unchanged" ? "This node didn't change in the pull request. " : `This ${node.kind} ${node.changeStatus === "added" ? "was added" : "changed"} in the pull request. `}
        {direct} direct and {transitive} transitive dependent{transitive === 1 ? "" : "s"} were found within {s.depth} hop{s.depth > 1 ? "s" : ""}, and {radius.tests.length} test case
        {radius.tests.length === 1 ? "" : "s"} call into that area.{" "}
        {node.signatureChanged ? "Its parameters changed, so check every direct caller." : ""} This shows potential impact, not confirmed breakage.
      </p>
      {node.signatureChanged && (
        <div className="mt-3 rounded-xl border border-white/8 bg-black/20 p-2.5 font-mono text-[11px]">
          <p className="text-[#FF7A90]">− {node.name}({node.baseParams})</p>
          <p className="text-[#3DE0A6]">+ {node.name}({node.params})</p>
        </div>
      )}
      {[...byDist.entries()].sort(([a], [b]) => a - b).map(([d, ids]) => (
        <div key={d}>
          <SectionTitle aside={<span className="font-mono text-[10.5px] text-[#FF7AB6]">ring {d}</span>}>{d === 1 ? "Direct dependents" : `${d} hops away`}</SectionTitle>
          <ul>
            {ids.map((id) => (
              <li key={id}>
                <NodeLink
                  r={r}
                  id={id}
                  suffix={
                    <span className="max-w-[45%] truncate font-mono text-[10px] text-[#9a90ad]" title="Path to the selected node">
                      {pathToCenter(radius, id)
                        .map((e) => r.nodes.find((n) => n.id === e.target)?.name)
                        .join(" → ")}
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {radius.distance.size === 1 && <p className="mt-3 text-[12px] text-[#9a90ad]">Nothing in the analyzed code calls or imports this.</p>}
      {node.changeStatus !== "unchanged" && (
        <button type="button" onClick={() => (s.setInspectorTab("source"), s.setSourceCompare(true))} className="mt-4 flex w-full items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-left text-[12px] hover:border-white/25">
          <span>
            <span className="block text-white">Open source diff</span>
            <span className="text-[#9a90ad]">Jump to the changed lines.</span>
          </span>
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

function CallsTab({ r, node }: { r: AnalysisResult; node: ImpactNode }) {
  const isFile = node.kind === "file";
  const incoming = directCallers(r, node.id).filter((e) => (isFile ? e.kind === "imports" : e.kind === "calls"));
  const outgoing = isFile ? r.edges.filter((e) => e.source === node.id && e.kind === "imports") : callees(r, node.id);
  const symbols = isFile ? r.nodes.filter((n) => n.fileId === node.id && n.kind === "symbol") : [];
  const Edge = ({ id, loc }: { id: string; loc: { path: string; line: number; text: string } }) => (
    <li>
      <NodeLink r={r} id={id} />
      <p className="mb-1 ml-6 truncate font-mono text-[10.5px] text-[#7d748f]" title={loc.text}>
        {loc.path.split("/").pop()}:{loc.line} {loc.text}
      </p>
    </li>
  );
  return (
    <div>
      <SectionTitle>{isFile ? "Imported by" : "Callers"}</SectionTitle>
      {incoming.length ? <ul>{incoming.map((e) => <Edge key={e.id} id={e.source} loc={e.location} />)}</ul> : <p className="text-[12px] text-[#9a90ad]">None found in the analyzed code.</p>}
      <SectionTitle>{isFile ? "Imports" : "Callees"}</SectionTitle>
      {outgoing.length ? <ul>{outgoing.map((e) => <Edge key={e.id} id={e.target} loc={e.location} />)}</ul> : <p className="text-[12px] text-[#9a90ad]">None.</p>}
      {isFile && (
        <>
          <SectionTitle>Functions in this file</SectionTitle>
          <ul>
            {symbols.map((n) => (
              <li key={n.id}>
                <NodeLink r={r} id={n.id} suffix={n.changeStatus !== "unchanged" ? <StatusBadge status={n.changeStatus} short /> : undefined} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function TestsTab({ r, node, radius }: { r: AnalysisResult; node: ImpactNode; radius: ReturnType<typeof blastRadius> | null }) {
  const s = useStudio();
  const direct = linkedTests(r, node.id);
  const nearby = (radius?.tests ?? []).filter((t) => !direct.some((d) => d.source === t.id));
  const changed = node.changeStatus === "added" || node.changeStatus === "modified";
  return (
    <div>
      <SectionTitle>Tests that call this directly</SectionTitle>
      {direct.length ? (
        <ul>
          {direct.map((e) => (
            <li key={e.id}>
              <NodeLink r={r} id={e.source} />
              <p className="mb-1 ml-6 truncate font-mono text-[10.5px] text-[#7d748f]">
                {e.location.path}:{e.location.line}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`flex items-start gap-2 rounded-lg p-2 text-[12px] ${changed ? "bg-[#FFB800]/10 text-[#FFD166]" : "text-[#9a90ad]"}`}>
          <FlaskConical size={14} className="mt-0.5 shrink-0" />
          {changed ? "No test calls this changed code directly. Consider adding one." : "No test calls this directly."}
        </p>
      )}
      <SectionTitle>Tests reaching its dependents</SectionTitle>
      {nearby.length ? (
        <ul>
          {nearby.map((t) => (
            <li key={t.id}>
              <NodeLink r={r} id={t.id} suffix={<span className="font-mono text-[10px] text-[#9a90ad]">via {r.nodes.find((n) => n.id === t.reaches)?.name}</span>} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-[#9a90ad]">None within depth {s.depth}.</p>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-[#7d748f]">A link means a test calls the code by name. No coverage data was collected, so this isn&apos;t proof the behaviour is tested.</p>
    </div>
  );
}

function SourceTab({ r, node }: { r: AnalysisResult; node: ImpactNode }) {
  const s = useStudio();
  const box = useRef<HTMLDivElement>(null);
  const deleted = node.changeStatus === "deleted" || r.changes.find((c) => c.path === node.path)?.status === "deleted";
  const src = (deleted ? r.baseFiles[node.path] : r.headFiles[node.path]) ?? "";
  const change = r.changes.find((c) => c.path === node.path);
  const changed = new Set(change?.changedLines ?? []);
  const range = node.sourceRange;
  const target = s.sourceLine ?? range?.startLine ?? null;

  useEffect(() => {
    if (!target || s.sourceCompare) return;
    box.current?.querySelector(`[data-line="${target}"]`)?.scrollIntoView({ block: "center" });
  }, [target, node.id, s.sourceCompare]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="truncate font-mono text-[11px] text-[#9a90ad]">
          {node.path} {deleted ? "(base)" : "(head)"}
        </p>
        {change && change.status === "modified" && (
          <button
            type="button"
            aria-pressed={s.sourceCompare}
            onClick={() => s.setSourceCompare(!s.sourceCompare)}
            className="flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-white/10 px-2 text-[11px] text-[#c9c0d8] hover:border-white/25 aria-pressed:bg-white/10 aria-pressed:text-white"
          >
            <GitCompareArrows size={12} /> Compare with base
          </button>
        )}
      </div>
      {s.sourceCompare && change?.status === "modified" ? (
        <div className="overflow-hidden rounded-xl border border-white/8 bg-black/25 py-1">
          <DiffLines before={r.baseFiles[node.path]} after={r.headFiles[node.path]} mode="unified" />
          <p className="px-3 py-1.5 text-[10.5px] text-[#7d748f]">
            {diffLines(r.baseFiles[node.path], r.headFiles[node.path]).filter((l) => l.kind !== "same").length} changed lines in this file.
          </p>
        </div>
      ) : (
        <div ref={box} className="max-h-[52vh] overflow-auto rounded-xl border border-white/8 bg-black/25 py-1.5 font-mono text-[11.5px] leading-[1.6]">
          {src.split("\n").map((l, i) => {
            const n = i + 1;
            const inRange = range && n >= range.startLine && n <= range.endLine;
            return (
              <div
                key={i}
                data-line={n}
                className={`grid grid-cols-[2.4rem_0.9rem_1fr] ${n === target ? "bg-[#FFB800]/12" : inRange ? "bg-[#7C3AED]/12" : ""}`}
              >
                <span className="select-none pr-2 text-right text-[#5f5870]">{n}</span>
                <span className="select-none text-[#3DE0A6]">{!deleted && changed.has(n) ? "+" : ""}</span>
                <span className={`whitespace-pre-wrap break-all pr-3 ${!deleted && changed.has(n) ? "text-[#bff5dd]" : "text-[#d9d1e6]"}`}>{l || " "}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EvidenceTab({ r, node, findings }: { r: AnalysisResult; node: ImpactNode; findings: Finding[] }) {
  const edges = r.edges.filter((e) => e.source === node.id || e.target === node.id);
  return (
    <div>
      <SectionTitle>Findings about this node</SectionTitle>
      {findings.length ? (
        <ul className="space-y-2">
          {findings.map((f) => (
            <FindingCard key={f.id} f={f} />
          ))}
        </ul>
      ) : (
        <p className="text-[12px] text-[#9a90ad]">No findings reference this node.</p>
      )}
      {findings.length > 0 && (
        <>
          <SectionTitle>Method</SectionTitle>
          <ul className="list-disc space-y-1 pl-4 text-[11.5px] text-[#c9c0d8]">
            {[...new Set(findings.map((f) => f.method))].map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </>
      )}
      <SectionTitle>Relationships and where they appear</SectionTitle>
      <ul className="space-y-1">
        {edges.map((e) => (
          <li key={e.id} className="rounded-lg bg-white/4 px-2 py-1.5 font-mono text-[10.5px]">
            <span className="text-[#c9c0d8]">{e.kind}</span> <span className="text-[#3DE0A6]">{e.evidence}</span>
            <span className="block truncate text-[#9a90ad]" title={e.location.text}>
              {e.location.path}:{e.location.line} {e.location.text}
            </span>
          </li>
        ))}
        {!edges.length && <li className="text-[12px] text-[#9a90ad]">None.</li>}
      </ul>
      <p className="mt-3 font-mono text-[10.5px] text-[#7d748f]">analysis {node.analysisVersion}</p>
      <Limitations r={r} />
    </div>
  );
}
