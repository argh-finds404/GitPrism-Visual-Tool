"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Check, ClipboardCopy, FileText, Lock, MessageSquareText, Plug, ShieldAlert, X } from "lucide-react";
import { buildPack, defaultItems, estimateTokens, type PackItem } from "@/features/impact-analysis/context-packager";
import { FIXTURE } from "@/features/impact-analysis/fixture";
import type { AnalysisResult, Finding } from "@/features/impact-analysis/types";
import { useStudio } from "../store";
import { FindingBadge, SectionTitle } from "./ui";

type Task = "review" | "tests" | null;

/**
 * The Agent Hub. In this build it has a built-in, rules-based review engine and
 * a context packager. Live MCP connections need a server-side bridge that isn't
 * configured, so the hub says so instead of pretending to be connected.
 */
export function AgentHub() {
  const s = useStudio();
  const r = s.result;
  const [task, setTask] = useState<Task>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [mcpUrl, setMcpUrl] = useState("");
  const [mcpMsg, setMcpMsg] = useState<string | null>(null);
  const [approve, setApprove] = useState(false);

  const run = async (t: Task) => {
    if (!r) return;
    setTask(t);
    setProgress([]);
    const steps = [
      `Gathered the diff: ${r.changes.length} files, base ${r.base.slice(0, 7)} → head ${r.head.slice(0, 7)}`,
      `Read ${r.edges.length} relationships and ${r.nodes.filter((n) => n.kind === "test").length} test cases from analysis ${r.version}`,
      "Applied built-in review rules locally. Nothing left your browser.",
    ];
    for (const st of steps) {
      await new Promise((res) => setTimeout(res, 0));
      setProgress((p) => [...p, st]);
    }
  };

  const comment = r ? reviewComment(r) : "";

  return (
    <section aria-label="Agent Hub" className="hud flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
        <h2 className="flex items-center gap-2 text-[12px] font-semibold">
          <Bot size={14} className="text-[#9D7BFF]" /> Agent Hub
        </h2>
        <button type="button" onClick={() => s.setAgentOpen(false)} aria-label="Close Agent Hub" className="grid h-6 w-6 place-items-center rounded text-[#9a90ad] hover:text-white">
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between rounded-xl bg-white/5 p-2.5">
          <span>
            <span className="block text-[12.5px] text-white">Review assistant</span>
            <span className="text-[11px] text-[#9a90ad]">Built-in rules engine, read-only</span>
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-[#9a90ad]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7d748f]" /> MCP not connected
          </span>
        </div>

        <SectionTitle>Choose an analysis task</SectionTitle>
        <div className="space-y-1.5">
          {[
            { id: "review" as const, title: "Review this change", body: "Find possible regressions and explain the evidence." },
            { id: "tests" as const, title: "Suggest missing tests", body: "Compare changed behaviour with related tests." },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={!r}
              onClick={() => run(t.id)}
              aria-pressed={task === t.id}
              className="w-full rounded-xl border border-white/8 p-2.5 text-left hover:border-white/25 aria-pressed:border-[#7C3AED] aria-pressed:bg-[#7C3AED]/12 disabled:opacity-40"
            >
              <span className="block text-[12.5px] text-white">{t.title}</span>
              <span className="text-[11.5px] text-[#9a90ad]">{t.body}</span>
            </button>
          ))}
          <button type="button" disabled={!r} onClick={() => s.setPackOpen(true)} className="w-full rounded-xl border border-white/8 p-2.5 text-left hover:border-white/25 disabled:opacity-40">
            <span className="block text-[12.5px] text-white">Build context pack</span>
            <span className="text-[11.5px] text-[#9a90ad]">Prepare selected code and evidence for an external AI assistant.</span>
          </button>
        </div>

        {task && r && (
          <>
            <SectionTitle>Progress</SectionTitle>
            <ol className="space-y-1">
              {progress.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[11.5px] text-[#c9c0d8]">
                  <Check size={12} className="mt-0.5 shrink-0 text-[#3DE0A6]" /> {p}
                </li>
              ))}
            </ol>
            {progress.length === 3 && (task === "review" ? <ReviewResults r={r} /> : <TestSuggestions r={r} />)}
          </>
        )}

        <SectionTitle>Actions that need approval</SectionTitle>
        <button
          type="button"
          disabled={!r}
          onClick={() => setApprove(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-white/8 p-2.5 text-left text-[12px] hover:border-white/25 disabled:opacity-40"
        >
          <MessageSquareText size={14} className="text-[#FFD166]" />
          <span className="flex-1">Post review comment to #{FIXTURE.number}</span>
          <Lock size={12} className="text-[#9a90ad]" />
        </button>

        <SectionTitle>Connection settings</SectionTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const u = new URL(mcpUrl);
              setMcpMsg(
                `${u.host} wasn't contacted. Live MCP connections need a server-side bridge with authentication and permission checks, which this build doesn't include.`,
              );
            } catch {
              setMcpMsg("Enter a full server URL, for example https://mcp.example.com/sse.");
            }
          }}
          className="rounded-xl border border-white/8 p-2.5"
        >
          <label htmlFor="mcp-url" className="text-[11.5px] text-[#9a90ad]">
            MCP server URL
          </label>
          <div className="mt-1 flex gap-1.5">
            <input
              id="mcp-url"
              value={mcpUrl}
              onChange={(e) => setMcpUrl(e.target.value)}
              placeholder="https://"
              className="h-8 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/25 px-2 font-mono text-[11.5px] text-white focus:border-[#7C3AED] focus:outline-none"
            />
            <button type="submit" className="flex h-8 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-[11.5px] hover:bg-white/15">
              <Plug size={12} /> Connect
            </button>
          </div>
          {mcpMsg && <p className="mt-2 text-[11.5px] leading-relaxed text-[#FFD166]">{mcpMsg}</p>}
          <p className="mt-2 text-[11px] text-[#7d748f]">Available tools: not loaded. Review permissions before enabling write access.</p>
        </form>

        <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-[#7d748f]">
          <ShieldAlert size={13} className="mt-0.5 shrink-0" />
          Read-only isn&apos;t risk-free: reading code can still expose it. Secret files are never packed, and nothing is sent without your action.
        </p>
      </div>

      <ApproveDialog open={approve} onClose={() => setApprove(false)} comment={comment} />
    </section>
  );
}

function ReviewResults({ r }: { r: AnalysisResult }) {
  const s = useStudio();
  const groups: { kind: Finding["kind"]; title: string }[] = [
    { kind: "fact", title: "Source-backed facts" },
    { kind: "static-warning", title: "Static-analysis warnings" },
    { kind: "hypothesis", title: "Hypotheses to check" },
  ];
  return (
    <div className="mt-2">
      {groups.map((g) => {
        const list = r.findings.filter((f) => f.kind === g.kind);
        if (!list.length) return null;
        return (
          <div key={g.kind}>
            <SectionTitle aside={<FindingBadge kind={g.kind} />}>{g.title}</SectionTitle>
            <ul className="space-y-1">
              {list.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      s.setHighlight({ ids: new Set(f.nodeIds), label: f.title });
                      s.select(f.nodeIds[0], { tab: "source" });
                      s.setSourceLine(f.locations[0]?.line ?? null);
                    }}
                    className="w-full rounded-lg bg-white/4 px-2 py-1.5 text-left text-[11.5px] text-[#e6def2] hover:bg-white/8"
                  >
                    {f.title}
                    <span className="block font-mono text-[10.5px] text-[#7d748f]">{f.locations[0] && `${f.locations[0].path}:${f.locations[0].line}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function TestSuggestions({ r }: { r: AnalysisResult }) {
  const gaps = r.nodes.filter((n) => n.kind === "symbol" && (n.changeStatus === "added" || n.changeStatus === "modified") && !r.edges.some((e) => e.kind === "tests" && e.target === n.id));
  return (
    <div className="mt-2">
      <SectionTitle aside={<FindingBadge kind="hypothesis" />}>Suggested test outlines</SectionTitle>
      {!gaps.length && <p className="text-[12px] text-[#9a90ad]">Every changed symbol has at least one test that calls it.</p>}
      {gaps.map((n) => {
        const callers = r.edges.filter((e) => e.target === n.id && e.kind === "calls").map((e) => r.nodes.find((x) => x.id === e.source)?.name);
        const deps = r.edges.filter((e) => e.source === n.id && e.kind === "calls").map((e) => r.nodes.find((x) => x.id === e.target)?.name);
        return (
          <div key={n.id} className="mb-2 rounded-lg bg-white/4 p-2">
            <p className="font-mono text-[11.5px] text-white">
              {n.name}({n.params})
            </p>
            <pre className="mt-1.5 whitespace-pre-wrap rounded bg-black/30 p-2 font-mono text-[10.5px] leading-5 text-[#d9d1e6]">{`import { ${n.name} } from "../${n.path.replace(/\.ts$/, "")}";

test("${n.name} works for a valid input", () => {
  // Arrange: ${deps.length ? `stub ${deps.join(", ")}` : "build the inputs"}
  // Act: call ${n.name}(…)
  // Assert: the result your callers (${callers.join(", ") || "none yet"}) rely on
});`}</pre>
          </div>
        );
      })}
      <p className="text-[11px] text-[#7d748f]">Outlines come from the symbol&apos;s signature and call graph. They are starting points, not verified tests.</p>
    </div>
  );
}

function reviewComment(r: AnalysisResult) {
  return [
    `GitPrism review for #${FIXTURE.number} (analysis ${r.version})`,
    "",
    ...r.findings.filter((f) => f.kind !== "hypothesis").map((f) => `- ${f.title} (${f.locations.map((l) => `${l.path}:${l.line}`).join(", ")})`),
    "",
    "Generated by GitPrism's built-in rules from static analysis. Potential impact, not confirmed breakage.",
  ].join("\n");
}

function ApproveDialog({ open, onClose, comment }: { open: boolean; onClose: () => void; comment: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} className="studio m-auto w-[min(92vw,520px)] rounded-2xl border border-white/10 bg-[#1A1623] p-0 text-[#F3EEF8] backdrop:bg-black/60">
      <div className="p-5">
        <h2 className="text-[15px] font-semibold">Approve posting a review comment?</h2>
        <dl className="mt-3 space-y-1 text-[12px]">
          <div className="flex gap-2">
            <dt className="w-24 text-[#9a90ad]">Destination</dt>
            <dd>
              {FIXTURE.owner}/{FIXTURE.repo}#{FIXTURE.number}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 text-[#9a90ad]">Provider</dt>
            <dd className="text-[#FFD166]">None connected</dd>
          </div>
        </dl>
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-5 text-[#d9d1e6]">{comment}</pre>
        <p className="mt-3 text-[12px] leading-relaxed text-[#c9c0d8]">
          No review provider is connected, so this can&apos;t be posted. You can copy the comment and post it yourself.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-8 rounded-lg border border-white/15 px-3 text-[12px]">
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(comment);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {}
            }}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3 text-[12px] font-medium text-white"
          >
            {copied ? <Check size={13} /> : <ClipboardCopy size={13} />} {copied ? "Copied" : "Copy comment"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Context packager                                                    */
/* ------------------------------------------------------------------ */

export function ContextPackager() {
  const s = useStudio();
  const r = s.result;
  const ref = useRef<HTMLDialogElement>(null);
  const [budget, setBudget] = useState(8000);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (s.packOpen && !d.open) d.showModal();
    if (!s.packOpen && d.open) d.close();
  }, [s.packOpen]);

  const items: PackItem[] = useMemo(() => {
    if (!r) return [];
    const defaults = new Map(defaultItems(r).map((i) => [i.nodeId, i]));
    return [...s.context]
      .map((id) => defaults.get(id) ?? { nodeId: id, reason: "selected" as const, priority: 4 })
      .sort((a, b) => a.priority - b.priority);
  }, [r, s.context]);
  const pack = useMemo(() => (r ? buildPack(r, items, budget, `${FIXTURE.repo}#${FIXTURE.number} ${FIXTURE.title}`) : null), [r, items, budget]);

  return (
    <dialog
      ref={ref}
      onClose={() => s.setPackOpen(false)}
      className="studio m-auto h-[min(88vh,760px)] w-[min(94vw,980px)] rounded-2xl border border-white/10 bg-[#1A1623] p-0 text-[#F3EEF8] backdrop:bg-black/60"
    >
      {r && pack && (
        <div className="grid h-full md:grid-cols-[320px_1fr]">
          <div className="flex min-h-0 flex-col border-b border-white/8 md:border-b-0 md:border-r">
            <div className="p-4">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                <FileText size={15} className="text-[#9D7BFF]" /> Context pack
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-[#9a90ad]">
                A bounded Markdown summary to paste into an AI assistant of your choice. Nothing is sent from here.
              </p>
              <label className="mt-4 block text-[12px]">
                <span className="flex justify-between">
                  Token budget <span className="font-mono">{budget.toLocaleString()}</span>
                </span>
                <input type="range" min={2000} max={32000} step={1000} value={budget} onChange={(e) => setBudget(Number(e.target.value))} className="mt-1 w-full accent-[#7C3AED]" />
              </label>
              <p className="mt-2 text-[12px]">
                <span className="font-mono text-white">≈ {pack.estimatedTokens.toLocaleString()}</span>{" "}
                <span className="text-[#9a90ad]">tokens, estimated as characters ÷ 4 (not a model tokenizer)</span>
              </p>
              {pack.estimatedTokens > budget && <p className="mt-1 text-[11.5px] text-[#FFD166]">The diff alone exceeds this budget. It is always kept, because it is the reason for the review.</p>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <SectionTitle aside={<span className="text-[10.5px] text-[#9a90ad]">priority order</span>}>Included code</SectionTitle>
              <ul className="space-y-1">
                {items.map((it) => {
                  const n = r.nodes.find((x) => x.id === it.nodeId);
                  const inc = pack.included.find((x) => x.nodeId === it.nodeId);
                  return (
                    <li key={it.nodeId} className="flex items-center gap-2 rounded-lg bg-white/4 px-2 py-1.5 text-[11.5px]">
                      <input type="checkbox" checked onChange={() => s.toggleContext(it.nodeId)} aria-label={`Include ${n?.name}`} className="accent-[#7C3AED]" />
                      <span className="min-w-0 flex-1 truncate font-mono">{n?.name}</span>
                      <span className="text-[10.5px] text-[#9a90ad]">{it.reason}</span>
                      <span className={`text-[10.5px] ${inc?.mode === "full" ? "text-[#3DE0A6]" : inc ? "text-[#FFD166]" : "text-[#FF7A90]"}`}>
                        {inc?.mode === "full" ? "full" : inc ? "summary" : "dropped"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <button type="button" onClick={s.resetContext} className="mt-2 text-[11.5px] text-[#C4B3FF] hover:underline">
                Reset to recommended
              </button>
              <SectionTitle>Never included</SectionTitle>
              <ul className="space-y-1">
                {pack.excluded.map((e) => (
                  <li key={e.path} className="flex items-center gap-2 text-[11.5px] text-[#c9c0d8]">
                    <Lock size={11} className="text-[#FF7A90]" />
                    <span className="font-mono">{e.path}</span>
                    <span className="text-[#7d748f]">{e.reason}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-[#9a90ad]">{pack.redactions ? `${pack.redactions} secret-like value(s) redacted.` : "No secret-like values found in the included code."}</p>
            </div>
          </div>
          <div className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
              <span className="text-[12px] text-[#9a90ad]">Preview ({estimateTokens(pack.markdown).toLocaleString()} est. tokens)</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pack.markdown);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    } catch {}
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-lg bg-[#7C3AED] px-3 text-[12px] font-medium text-white"
                >
                  {copied ? <Check size={13} /> : <ClipboardCopy size={13} />} {copied ? "Copied" : "Copy Markdown"}
                </button>
                <button type="button" onClick={() => s.setPackOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/8">
                  <X size={15} />
                </button>
              </div>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-[11px] leading-5 text-[#d9d1e6]">{pack.markdown}</pre>
          </div>
        </div>
      )}
    </dialog>
  );
}
