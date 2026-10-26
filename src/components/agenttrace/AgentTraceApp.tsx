"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Equal,
  Eye,
  FileDiff,
  Flag,
  Info,
  MessageSquareQuote,
  ShieldCheck,
  SkipForward,
  SplitSquareHorizontal,
  Terminal,
} from "lucide-react";
import { DiffLines, ModeSwitch } from "@/components/diff/DiffLines";
import { PrismMark } from "@/components/brand/PrismMark";
import { SectionTitle } from "@/components/impact-studio/hud/ui";
import { attempts, failed, replay, touchedPaths, type AgentEvent, type AgentSession, type EventKind } from "@/features/agenttrace/events";
import { compareSessions } from "@/features/agenttrace/compare";
import type { DiffLine } from "@/lib/git";
import { short } from "@/lib/git";

/**
 * AgentTrace — read the session, not just the diff.
 *
 * The event log is the only input. File states, the diff and every line's attribution are
 * derived from it by replay, so what the timeline claims and what the diff shows cannot drift
 * apart. Replay re-applies recorded edits; it never re-runs a command.
 */

const KINDS: { id: EventKind; label: string }[] = [
  { id: "read", label: "Reads" },
  { id: "edit", label: "Edits" },
  { id: "command", label: "Commands" },
  { id: "validation", label: "Results" },
  { id: "note", label: "Notes" },
];

const clock = (ms: number) => new Date(ms).toISOString().slice(11, 19);

const elapsed = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

export function AgentTraceApp({ sessions, baseFiles }: { sessions: AgentSession[]; baseFiles: Record<string, string> }) {
  const [view, setView] = useState(sessions[0]?.id ?? "");
  const session = sessions.find((s) => s.id === view);
  const canCompare = sessions.length > 1;

  return (
    <main className="studio min-h-[100dvh]">
      <header className="border-b border-[var(--line)] px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/" aria-label="GitPrism home">
            <PrismMark className="h-6 w-6" />
          </Link>
          <div className="mr-auto">
            <h1 className="text-[15px] font-semibold leading-tight">AgentTrace</h1>
            <p className="font-mono text-[11px] text-[var(--ink-3)]">
              {sessions[0]?.repo.owner}/{sessions[0]?.repo.repo}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Which attempt to read">
            {sessions.map((s) => (
              <button key={s.id} type="button" aria-pressed={view === s.id} onClick={() => setView(s.id)} className="chip h-7 px-2.5 text-[11.5px]">
                {s.title}
              </button>
            ))}
            {canCompare && (
              <button type="button" aria-pressed={view === "compare"} onClick={() => setView("compare")} className="chip h-7 gap-1.5 px-2.5 text-[11.5px]">
                <SplitSquareHorizontal size={13} /> Compare
              </button>
            )}
          </div>

          <span className="rounded-full border border-[#FFB800]/35 bg-[#FFB800]/10 px-2.5 py-1 text-[11px] text-[#FFD166]">
            {sessions[0]?.label}
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-5 md:px-6">
        <Disclosure />
        {session ? (
          <SingleSession key={session.id} session={session} baseFiles={baseFiles} />
        ) : (
          <Compare sessions={sessions} baseFiles={baseFiles} />
        )}
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------- */
/* One session                                                       */
/* ---------------------------------------------------------------- */

function SingleSession({ session, baseFiles }: { session: AgentSession; baseFiles: Record<string, string> }) {
  const [hidden, setHidden] = useState<EventKind[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"unified" | "split">("unified");
  const [scope, setScope] = useState<"session" | "step">("session");
  const [traced, setTraced] = useState<{ line: DiffLine; eventId: string | null } | null>(null);

  const prov = useMemo(() => replay(baseFiles, session.events), [baseFiles, session.events]);
  const groups = useMemo(() => attempts(session.events), [session.events]);
  const path = touchedPaths(session.events)[0];

  const shown = session.events.filter((e) => !hidden.includes(e.kind as EventKind));
  const index = selected ? session.events.findIndex((e) => e.id === selected) : -1;
  const current = index >= 0 ? session.events[index] : null;
  const isEdit = current?.kind === "edit";

  // Replay: stepping moves through the log, it does not re-execute anything.
  const step = (dir: 1 | -1) => {
    const pool = shown.length ? shown : session.events;
    const at = pool.findIndex((e) => e.id === selected);
    const next = pool[Math.min(Math.max(at + dir, 0), pool.length - 1)] ?? pool[0];
    setSelected(next.id);
    setTraced(null);
  };

  const firstFailure = session.events.find((e) => e.kind === "validation" && (e.status === "fail" || e.status === "error"));

  // "This step" shows what one edit changed; "whole session" shows base against the final state.
  const before = scope === "step" && isEdit ? (prov.snapshots[index][current.path] ?? "") : (baseFiles[path] ?? "");
  const after = scope === "step" && isEdit ? current.content : (prov.head[path] ?? "");

  const trace = (line: DiffLine) => {
    const id =
      line.kind === "add"
        ? (prov.addedBy[path]?.[line.b - 1] ?? null)
        : line.kind === "del"
          ? (prov.removedBy[path]?.[line.a] ?? null)
          : null;
    setTraced({ line, eventId: id });
    if (id && scope === "session") setSelected(id);
  };

  return (
    <>
      <p className="mt-4 font-mono text-[11px] text-[var(--ink-3)]">
        {session.title} · {short(session.baseCommit)}..{session.headCommit ? short(session.headCommit) : "uncommitted"}
      </p>

      <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <section className="hud flex min-h-0 flex-col p-4" aria-labelledby="at-timeline">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line-2)] pb-3">
            <h2 id="at-timeline" className="mr-auto text-[14px] font-semibold">
              Session timeline
            </h2>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => step(-1)} className="chip h-7 px-2" aria-label="Previous event">
                <ChevronLeft size={14} />
              </button>
              <button type="button" onClick={() => step(1)} className="chip h-7 px-2" aria-label="Next event">
                <ChevronRight size={14} />
              </button>
              {firstFailure && (
                <button
                  type="button"
                  onClick={() => {
                    setSelected(firstFailure.id);
                    setTraced(null);
                  }}
                  className="chip h-7 gap-1.5 px-2.5 text-[11.5px]"
                >
                  <SkipForward size={13} /> First failure
                </button>
              )}
            </div>
          </div>

          <Filters hidden={hidden} setHidden={setHidden} />

          <ol className="mt-3 max-h-[64vh] space-y-1.5 overflow-auto pr-1">
            {shown.length === 0 && (
              <li className="py-8 text-center text-[13px] text-[var(--ink-3)]">Every kind of event is hidden. Turn a filter back on.</li>
            )}
            {shown.map((e) => (
              <EventRow
                key={e.id}
                event={e}
                selected={e.id === selected}
                traced={traced?.eventId === e.id}
                onSelect={() => {
                  setSelected(e.id);
                  setTraced(null);
                }}
              />
            ))}
          </ol>

          <Attempts groups={groups} />
        </section>

        <section className="hud flex min-h-0 flex-col overflow-hidden p-0" aria-labelledby="at-diff">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line-2)] p-4">
            <h2 id="at-diff" className="mr-auto text-[14px] font-semibold">
              {scope === "step" && isEdit ? "What this step changed" : "What the session changed"}
            </h2>
            <div className="flex rounded-lg border border-[var(--line-2)] p-0.5" role="group" aria-label="Diff scope">
              {(["session", "step"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={scope === s}
                  disabled={s === "step" && !isEdit}
                  onClick={() => setScope(s)}
                  className="h-6 rounded-md px-2 text-[11.5px] text-[var(--ink-3)] disabled:opacity-35 aria-pressed:bg-[var(--ink)] aria-pressed:text-[var(--paper)]"
                >
                  {s === "session" ? "Whole session" : "This step"}
                </button>
              ))}
            </div>
            <ModeSwitch mode={mode} setMode={setMode} />
          </div>

          <p className="border-b border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--ink-3)]">{path}</p>

          <div className="min-h-0 flex-1 overflow-auto">
            <DiffLines before={before} after={after} mode={mode} onLine={trace} emptyText="This step changed nothing in the file." />
          </div>

          <TraceReadout traced={traced} events={session.events} scope={scope} />
          <Detail event={current} />
        </section>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- */
/* Two sessions, side by side                                        */
/* ---------------------------------------------------------------- */

function Compare({ sessions, baseFiles }: { sessions: AgentSession[]; baseFiles: Record<string, string> }) {
  const [hidden, setHidden] = useState<EventKind[]>(["validation"]);
  const [mode, setMode] = useState<"unified" | "split">("split");
  const [a, b] = sessions;
  const c = useMemo(() => compareSessions(baseFiles, a, b), [baseFiles, a, b]);
  const differing = c.files.filter((f) => !f.same);

  if (!c.sameTask || !c.sameBase) {
    return (
      <div className="hud mt-4 p-6 text-center text-[13px] text-[var(--ink-2)]">
        These attempts started from different tasks or different revisions, so putting their results side by side would
        not compare like with like.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-5">
      {/* The claim, stated before any detail. */}
      <div className={`rounded-xl border p-4 ${c.sameCode ? "border-white/10 bg-white/4" : "border-[#FFB800]/35 bg-[#FFB800]/10"}`}>
        <h2 className="flex items-center gap-2 text-[14px] font-semibold">
          {c.sameCode ? <Equal size={16} className="text-[#3DE0A6]" /> : <SplitSquareHorizontal size={16} className="text-[#FFD166]" />}
          {c.bothGreen
            ? c.sameCode
              ? "Both attempts ended green, and left the same code."
              : "Both attempts ended green, and left different code."
            : "The attempts did not end the same way."}
        </h2>
        <p className="mt-2 max-w-prose text-[12.5px] leading-relaxed text-[var(--ink-2)]">
          {c.bothGreen && !c.sameCode ? (
            <>
              Every test agrees across the two runs, so the suite cannot tell them apart. The difference is in the code
              they left behind, and choosing between them is a judgement the tests do not make for you.
            </>
          ) : c.bothGreen ? (
            <>Both runs finished with the tests they ran passing, and reached the same file contents by different routes.</>
          ) : (
            <>Read the per-test results below before comparing the diffs: the attempts disagree about what passes.</>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
          <Versus label="edits" a={c.counts.edits[0]} b={c.counts.edits[1]} />
          <Versus label="test runs" a={c.counts.attempts[0]} b={c.counts.attempts[1]} />
          <Versus label="runs with a failure" a={c.counts.failedAttempts[0]} b={c.counts.failedAttempts[1]} />
          <Versus label="files read" a={c.counts.reads[0]} b={c.counts.reads[1]} />
          <Versus label="recorded time" a={elapsed(c.elapsed[0])} b={elapsed(c.elapsed[1])} />
        </div>
        <p className="mt-2 text-[11.5px] text-[var(--ink-3)]">
          Counts describe what each run did. Fewer steps is not the same as a better result.
        </p>
      </div>

      {/* Parallel tracks. */}
      <section className="hud p-4" aria-labelledby="at-tracks">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line-2)] pb-3">
          <h2 id="at-tracks" className="mr-auto text-[14px] font-semibold">
            How each attempt got there
          </h2>
          <Filters hidden={hidden} setHidden={setHidden} />
        </div>
        <div className="grid gap-5 pt-3 md:grid-cols-2">
          {[a, b].map((s) => {
            const shown = s.events.filter((e) => !hidden.includes(e.kind as EventKind));
            const groups = attempts(s.events);
            return (
              <div key={s.id} className="min-w-0">
                <h3 className="text-[12.5px] font-semibold text-[var(--ink)]">{s.title}</h3>
                <p className="mt-0.5 font-mono text-[11px] text-[var(--ink-3)]">
                  {short(s.baseCommit)}..{s.headCommit ? short(s.headCommit) : "uncommitted"}
                </p>
                <ol className="mt-2.5 max-h-[46vh] space-y-1.5 overflow-auto pr-1">
                  {shown.map((e) => (
                    <EventRow key={e.id} event={e} selected={false} traced={false} />
                  ))}
                </ol>
                <Attempts groups={groups} />
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">
          Open an attempt on its own to step through it and trace a line back to the step that wrote it.
        </p>
      </section>

      {/* Converging: the tests, then the code. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <section className="hud p-4" aria-labelledby="at-tests">
          <h2 id="at-tests" className="border-b border-[var(--line-2)] pb-3 text-[14px] font-semibold">
            What the tests said
          </h2>
          <ul className="mt-3 space-y-1.5">
            {c.tests.map((t) => (
              <li key={t.key} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white/[0.02] px-2.5 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-[var(--ink)]">{t.name}</span>
                  <span className="block truncate font-mono text-[10.5px] text-[var(--ink-3)]">{t.path}</span>
                </span>
                <Status status={t.a} />
                <Status status={t.b} />
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
            Left column is {a.title}, right is {b.title}. A test that never ran in an attempt shows as a dash, which is
            an absence of evidence rather than a pass.
          </p>
        </section>

        <section className="hud flex flex-col overflow-hidden p-0" aria-labelledby="at-result">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line-2)] p-4">
            <h2 id="at-result" className="mr-auto text-[14px] font-semibold">
              {differing.length ? "Where the results differ" : "The code they both reached"}
            </h2>
            <ModeSwitch mode={mode} setMode={setMode} />
          </div>
          {differing.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[var(--ink-3)]">
              Both attempts left identical contents in every file either of them touched.
            </p>
          ) : (
            differing.map((f) => (
              <div key={f.path} className="min-w-0">
                <p className="border-b border-[var(--line)] px-4 py-2 font-mono text-[11px] text-[var(--ink-3)]">
                  {f.path} — {a.title} on the left, {b.title} on the right
                </p>
                <DiffLines before={f.a} after={f.b} mode={mode} emptyText="No differences." />
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function Versus({ label, a, b }: { label: string; a: number | string; b: number | string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-mono text-[15px] text-[var(--ink)]">{a}</span>
      <span className="text-[var(--ink-3)]">/</span>
      <span className="font-mono text-[15px] text-[var(--ink)]">{b}</span>
      <span className="text-[12px] text-[var(--ink-3)]">{label}</span>
    </span>
  );
}

const STATUS_CLS: Record<string, string> = {
  pass: "border-[#00D995]/35 bg-[#00D995]/12 text-[#3DE0A6]",
  fail: "border-[#FF007A]/40 bg-[#FF007A]/12 text-[#FF8FB0]",
  error: "border-[#FFB800]/35 bg-[#FFB800]/10 text-[#FFD166]",
  missing: "border-white/12 bg-white/5 text-[var(--ink-3)]",
};

function Status({ status }: { status: string | null }) {
  if (!status) return <span className="w-14 shrink-0 text-center font-mono text-[11px] text-[var(--ink-3)]">—</span>;
  return (
    <span className={`w-14 shrink-0 rounded-full border px-1.5 py-px text-center font-mono text-[10.5px] ${STATUS_CLS[status] ?? STATUS_CLS.missing}`}>
      {status}
    </span>
  );
}

/* ---------------------------------------------------------------- */
/* Shared pieces                                                     */
/* ---------------------------------------------------------------- */

function Filters({ hidden, setHidden }: { hidden: EventKind[]; setHidden: (f: (h: EventKind[]) => EventKind[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-3" role="group" aria-label="Filter events">
      {KINDS.map((k) => {
        const on = !hidden.includes(k.id);
        return (
          <button
            key={k.id}
            type="button"
            aria-pressed={on}
            onClick={() => setHidden((h) => (on ? [...h, k.id] : h.filter((x) => x !== k.id)))}
            className="chip h-7 px-2.5 text-[11.5px]"
          >
            {k.label}
          </button>
        );
      })}
    </div>
  );
}

function Disclosure() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--line-2)] bg-white/[0.02] p-4 md:flex-row md:items-start md:gap-4">
      <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#3DE0A6]" />
      <div className="space-y-1.5 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
        <p>
          <strong className="font-semibold text-[var(--ink)]">These sessions are reconstructions.</strong> No coding
          agent was recorded to produce them, and GitPrism captures nothing from your machine, your editor or your own
          agent sessions.
        </p>
        <p>
          What is real: every file state is fixture repository content, the base is a genuine commit, and every test
          result below was produced by executing that code — including the wrong attempt, which really fails when run.
        </p>
        <p className="text-[var(--ink-3)]">
          A log records observable actions and their results only. Nothing here claims access to a model&apos;s internal
          reasoning, because nothing exposes it.
        </p>
      </div>
    </div>
  );
}

const STYLE: Record<EventKind, { icon: typeof Eye; cls: string }> = {
  "session-start": { icon: Flag, cls: "text-[#C4B3FF]" },
  read: { icon: Eye, cls: "text-[#7DF5FF]" },
  edit: { icon: FileDiff, cls: "text-[#FF8FB0]" },
  command: { icon: Terminal, cls: "text-[var(--ink-2)]" },
  validation: { icon: CircleCheck, cls: "text-[#3DE0A6]" },
  note: { icon: MessageSquareQuote, cls: "text-[#FFD166]" },
  "session-end": { icon: Flag, cls: "text-[#C4B3FF]" },
};

function EventRow({
  event,
  selected,
  traced,
  onSelect,
}: {
  event: AgentEvent;
  selected: boolean;
  traced: boolean;
  /** Omitted where the track is read-only, so nothing offers a click that does nothing. */
  onSelect?: () => void;
}) {
  const bad = event.kind === "validation" && (event.status === "fail" || event.status === "error");
  const Icon = bad ? CircleX : STYLE[event.kind as EventKind].icon;
  const cls = bad ? "text-[#FF8FB0]" : STYLE[event.kind as EventKind].cls;

  const body = (
    <>
      <Icon size={14} className={`mt-0.5 shrink-0 ${cls}`} />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] leading-snug text-[var(--ink)]">{headline(event)}</span>
        {detailLine(event) && <span className="mt-0.5 block font-mono text-[11px] leading-snug text-[var(--ink-3)]">{detailLine(event)}</span>}
      </span>
      <span className="shrink-0 font-mono text-[10.5px] text-[var(--ink-3)]">{clock(event.at)}</span>
    </>
  );

  const shell = `flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left ${
    selected
      ? "border-[var(--violet)]/60 bg-[var(--violet-wash)]"
      : traced
        ? "border-[#FFB800]/50 bg-[#FFB800]/8"
        : "border-transparent"
  }`;

  return (
    <li>
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-current={selected}
          className={`${shell} transition-colors ${
            selected || traced ? "" : "hover:border-[var(--line-2)] hover:bg-white/[0.03]"
          }`}
        >
          {body}
        </button>
      ) : (
        <div className={`${shell} ${selected || traced ? "" : "border-[var(--line)]/60 bg-white/[0.02]"}`}>{body}</div>
      )}
    </li>
  );
}

function headline(e: AgentEvent) {
  switch (e.kind) {
    case "session-start":
      return `${e.agent} started: ${e.task}`;
    case "read":
      return `Read ${e.path.split("/").pop()}`;
    case "edit":
      return e.summary;
    case "command":
      return e.command;
    case "validation":
      return e.test;
    case "note":
      return e.text;
    case "session-end":
      return e.outcome === "completed" ? "Session ended — task completed" : "Session ended — abandoned";
  }
}

function detailLine(e: AgentEvent) {
  switch (e.kind) {
    case "session-start":
      return `base ${short(e.baseCommit)}`;
    case "read":
      return e.path;
    case "edit":
      return e.path;
    case "command":
      return `exit ${e.exitCode} · ${e.summary}`;
    case "validation":
      return `${e.status} · ${e.path} · ${e.ms} ms`;
    case "note":
      return "stated by the agent";
    case "session-end":
      return e.headCommit ? `head ${short(e.headCommit)}` : "nothing committed";
  }
}

function Attempts({ groups }: { groups: ReturnType<typeof attempts> }) {
  if (!groups.length) return null;
  return (
    <div className="mt-3 border-t border-[var(--line)] pt-3">
      <SectionTitle>Attempts</SectionTitle>
      <ol className="space-y-1">
        {groups.map((g) => {
          const bad = failed(g);
          const broke = g.results.filter((r) => r.status !== "pass").length;
          return (
            <li key={g.index} className="flex items-center gap-2 text-[12px]">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${bad ? "bg-[#FF8FB0]" : "bg-[#3DE0A6]"}`} />
              <span className="text-[var(--ink-2)]">{g.afterEvent === null ? "Before any edit" : `After edit ${g.index}`}</span>
              <span className={`ml-auto font-mono text-[11px] ${bad ? "text-[#FF8FB0]" : "text-[#3DE0A6]"}`}>
                {bad ? `${broke} of ${g.results.length} failed` : `${g.results.length} passed`}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TraceReadout({ traced, events, scope }: { traced: { line: DiffLine; eventId: string | null } | null; events: AgentEvent[]; scope: string }) {
  if (!traced) {
    return (
      <p className="flex items-center gap-2 border-t border-[var(--line)] px-4 py-2.5 text-[12px] text-[var(--ink-3)]">
        <Info size={13} /> Click a changed line to see which step produced it.
      </p>
    );
  }
  const source = traced.eventId ? events.find((e) => e.id === traced.eventId) : null;
  return (
    <div className="border-t border-[var(--line)] bg-white/[0.02] px-4 py-2.5 text-[12px] leading-relaxed text-[var(--ink-2)]">
      <span className="font-mono text-[11px] text-[var(--ink-3)]">
        {traced.line.kind === "add" ? `+ line ${traced.line.b}` : traced.line.kind === "del" ? `− line ${traced.line.a}` : "unchanged"}
      </span>{" "}
      {source ? (
        <>
          {traced.line.kind === "add" ? "written by" : "removed by"}{" "}
          <strong className="font-semibold text-[var(--ink)]">{headline(source)}</strong>
          {scope === "session" && <span className="text-[var(--ink-3)]"> — selected in the timeline.</span>}
        </>
      ) : (
        <span className="text-[var(--ink-3)]">came from the base revision; no step in this session touched it.</span>
      )}
    </div>
  );
}

function Detail({ event }: { event: AgentEvent | null }) {
  if (!event) return null;
  if (event.kind === "validation" && event.status !== "pass") {
    return (
      <div className="border-t border-[var(--line)] px-4 py-3">
        <p className="font-mono text-[11.5px] leading-relaxed text-[#FF8FB0]">{event.detail}</p>
      </div>
    );
  }
  if (event.kind === "note") {
    return (
      <div className="border-t border-[var(--line)] px-4 py-3">
        <p className="text-[12.5px] leading-relaxed text-[var(--ink-2)]">&ldquo;{event.text}&rdquo;</p>
        <p className="mt-1 text-[11px] text-[var(--ink-3)]">The agent&apos;s own words, recorded as stated. Not an explanation of why it acted.</p>
      </div>
    );
  }
  return null;
}
