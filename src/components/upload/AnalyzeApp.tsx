"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileCode2, FolderOpen, Link2Off, Loader2, Lock, RefreshCw, Repeat, ShieldCheck } from "lucide-react";
import { analyze } from "@/features/impact-analysis/analysis-service";
import type { AnalysisResult } from "@/features/impact-analysis/types";
import { collect, LIMITS, type Collected } from "@/features/upload/collect";
import { SaveProject } from "./SaveProject";
import { FindingBadge } from "@/components/impact-studio/hud/ui";
import { PrismMark } from "@/components/brand/PrismMark";
import { StudioSwitch } from "@/components/site/StudioSwitch";

/**
 * Analyse a project the user picked from their own machine.
 *
 * The files are read and analysed in this browser; nothing is uploaded. The analyser only ever
 * parses, so no code from the chosen folder is executed — the one thing this application runs is
 * its own bundled fixture.
 */

type State =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "error"; message: string }
  | { status: "done"; picked: Collected; result: AnalysisResult; name?: string };

/** The picked folder's own name, which collect() strips from the analysed paths. */
function relativeRoot(file: File) {
  const full = (file as File & { webkitRelativePath?: string }).webkitRelativePath || "";
  return full.split("/")[0] || "project";
}

export function AnalyzeApp({ initial }: { initial?: { name: string; files: Record<string, string> } }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>(() => {
    if (!initial) return { status: "idle" };
    const picked: Collected = {
      files: initial.files,
      skipped: { ignored: 0, notSource: 0, secret: 0, tooBig: 0 },
      truncated: false,
      bytes: Object.values(initial.files).reduce((n, c) => n + c.length, 0),
    };
    return {
      status: "done",
      picked,
      result: analyze(initial.files, initial.files, { base: "upload", head: "upload", layers: [], rules: [] }),
      name: initial.name,
    };
  });

  const onPick = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setState({ status: "reading" });
    try {
      const picked = await collect(list);
      if (Object.keys(picked.files).length === 0) {
        setState({
          status: "error",
          message: "No source files in that folder. GitPrism reads .ts, .tsx, .js and .jsx, and skips node_modules, build output and anything that looks like a secret.",
        });
        return;
      }
      // Same snapshot on both sides: there is no "before", so this is structure, not a diff.
      const result = analyze(picked.files, picked.files, { base: "upload", head: "upload", layers: [], rules: [] });
      setState({ status: "done", picked, result, name: list[0] ? relativeRoot(list[0]) : "project" });
    } catch (e) {
      setState({ status: "error", message: (e as Error).message || "That folder could not be read." });
    }
  };

  return (
    <main className="studio min-h-[100dvh]">
      <header className="border-b border-[var(--line)] px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/" aria-label="GitPrism home">
            <PrismMark className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-[15px] font-semibold leading-tight">Analyse your project</h1>
            <p className="font-mono text-[11px] text-[var(--ink-3)]">
              {state.status === "done" ? `${Object.keys(state.result.headFiles).length} files read in this browser` : "your own folder, read locally"}
            </p>
          </div>
          <StudioSwitch current="review" />
          <span className="mr-auto" />
          {state.status === "done" && (
            <button type="button" onClick={() => input.current?.click()} className="btn btn-ghost btn-sm">
              <RefreshCw size={14} /> Pick another
            </button>
          )}
        </div>
      </header>

      {/* webkitdirectory is how a browser offers a folder; it is not a standard attribute name. */}
      <input
        ref={input}
        type="file"
        multiple
        // @ts-expect-error -- directory picking is non-standard but supported where it matters
        webkitdirectory=""
        directory=""
        className="sr-only"
        onChange={(e) => onPick(e.target.files)}
      />

      <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6">
        {state.status === "idle" && <Idle onPick={() => input.current?.click()} />}
        {state.status === "reading" && <Reading />}
        {state.status === "error" && <Failed message={state.message} onRetry={() => input.current?.click()} />}
        {state.status === "done" && <Report picked={state.picked} result={state.result} name={state.name ?? "project"} />}
      </div>
    </main>
  );
}

function Idle({ onPick }: { onPick: () => void }) {
  return (
    <div className="hud mx-auto max-w-2xl p-8 text-center">
      <FolderOpen size={26} className="mx-auto text-[var(--violet)]" />
      <h2 className="mt-4 text-lg font-semibold">Pick a project folder</h2>
      <p className="mx-auto mt-3 max-w-prose text-[13.5px] leading-relaxed text-[var(--ink-2)]">
        GitPrism parses your TypeScript and JavaScript, builds the dependency graph, and reports what it
        finds: import cycles, imports that resolve to nothing, and which files everything leans on.
      </p>
      <button type="button" onClick={onPick} className="btn btn-primary btn-md mx-auto mt-6">
        <FolderOpen size={16} /> Choose a folder
      </button>
      <div className="mt-6 space-y-1.5 text-left">
        <p className="flex items-start gap-2 text-[12.5px] text-[var(--ink-2)]">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#3DE0A6]" />
          Read and analysed in this browser. Your files are not uploaded anywhere.
        </p>
        <p className="flex items-start gap-2 text-[12.5px] text-[var(--ink-2)]">
          <Lock size={14} className="mt-0.5 shrink-0 text-[#3DE0A6]" />
          Nothing from your folder is executed. The analyser only reads code.
        </p>
        <p className="flex items-start gap-2 text-[12.5px] text-[var(--ink-3)]">
          <FileCode2 size={14} className="mt-0.5 shrink-0" />
          Up to {LIMITS.files} source files, {Math.round(LIMITS.bytes / 1000)} KB total. node_modules, build output and
          secrets are skipped.
        </p>
      </div>
    </div>
  );
}

function Reading() {
  return (
    <div className="hud mx-auto max-w-2xl p-8 text-center" aria-live="polite">
      <Loader2 size={26} className="mx-auto animate-spin text-[var(--violet)]" />
      <h2 className="mt-4 text-lg font-semibold">Reading your project</h2>
      <p className="mt-2 text-[13.5px] text-[var(--ink-2)]">Parsing imports, functions and tests.</p>
    </div>
  );
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="hud mx-auto max-w-2xl p-8 text-center" role="alert">
      <AlertTriangle size={26} className="mx-auto text-[#FFD166]" />
      <h2 className="mt-4 text-lg font-semibold">Nothing to analyse</h2>
      <p className="mx-auto mt-2 max-w-prose text-[13.5px] leading-relaxed text-[var(--ink-2)]">{message}</p>
      <button type="button" onClick={onRetry} className="btn btn-ghost btn-sm mx-auto mt-5">
        Choose another folder
      </button>
    </div>
  );
}

function Report({ picked, result, name }: { picked: Collected; result: AnalysisResult; name: string }) {
  const files = result.nodes.filter((n) => n.kind === "file");
  const symbols = result.nodes.filter((n) => n.kind === "symbol");
  const tests = result.nodes.filter((n) => n.kind === "test");

  // Who leans on whom: an import edge points from the importer to the imported file.
  const hubs = useMemo(() => {
    const count = new Map<string, number>();
    for (const e of result.edges) if (e.kind === "imports") count.set(e.target, (count.get(e.target) ?? 0) + 1);
    return files
      .map((f) => ({ path: f.path, importedBy: count.get(f.id) ?? 0 }))
      .sort((a, b) => b.importedBy - a.importedBy)
      .slice(0, 8);
  }, [result, files]);

  const skippedTotal = Object.values(picked.skipped).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Stat n={files.length} label="source files" />
        <Stat n={symbols.length} label="functions" />
        <Stat n={result.edges.filter((e) => e.kind === "imports").length} label="imports" />
        <Stat n={tests.length} label="test cases" />
        <Stat n={result.cycles.length} label="import cycles" tone={result.cycles.length ? "warn" : undefined} />
        <Stat n={result.unresolved.length} label="unresolved imports" tone={result.unresolved.length ? "warn" : undefined} />
      </div>

      {(picked.truncated || skippedTotal > 0) && (
        <p className="rounded-xl border border-[var(--line-2)] bg-white/[0.02] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
          {picked.truncated && (
            <>
              <strong className="font-semibold text-[#FFD166]">This is a partial read.</strong> The limit of {LIMITS.files} files
              or {Math.round(LIMITS.bytes / 1000)} KB was reached, so what you see below describes only part of the project.{" "}
            </>
          )}
          Skipped {skippedTotal}: {picked.skipped.ignored} in ignored directories, {picked.skipped.notSource} not source,{" "}
          {picked.skipped.secret} that looked like secrets, {picked.skipped.tooBig} too large.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="hud p-4" aria-labelledby="an-findings">
          <h2 id="an-findings" className="border-b border-[var(--line-2)] pb-3 text-[14px] font-semibold">
            What the analyser found
          </h2>
          {result.findings.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[var(--ink-3)]">
              No cycles and no unresolved imports. That is what was checked — not a clean bill of health.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {result.findings.slice(0, 12).map((f) => (
                <li key={f.id} className="rounded-lg border border-[var(--line)] bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <FindingBadge kind={f.kind} />
                    <span className="min-w-0 flex-1 text-[12.5px] text-[var(--ink)]">{f.title}</span>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--ink-2)]">{f.detail}</p>
                  {f.locations[0] && (
                    <p className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">
                      {f.locations[0].path}:{f.locations[0].line}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="hud p-4" aria-labelledby="an-hubs">
          <h2 id="an-hubs" className="border-b border-[var(--line-2)] pb-3 text-[14px] font-semibold">
            What the project leans on
          </h2>
          <p className="mt-1.5 text-[12.5px] text-[var(--ink-3)]">
            Files with the most importers. A change in one of these reaches furthest.
          </p>
          <ul className="mt-3 space-y-1.5">
            {hubs.map((h) => (
              <li key={h.path} className="flex items-center gap-3 rounded-lg border border-[var(--line)] bg-white/[0.02] px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--ink)]">{h.path}</span>
                <span className="shrink-0 font-mono text-[11px] text-[var(--ink-3)]">
                  {h.importedBy} importer{h.importedBy === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <SaveProject name={name} files={result.headFiles} />

      <div className="hud p-4">
        <h2 className="text-[11px] font-semibold text-[var(--ink-3)]">What this does not tell you</h2>
        <ul className="mt-2 space-y-1.5">
          {[
            "Relationships come from explicit relative imports and direct calls by name. Package imports, dynamic imports, re-exports and method calls are not followed.",
            "Nothing was executed. No test was run and no behaviour was observed — this is what the code says, not what it does.",
            "Only TypeScript and JavaScript are parsed. Other languages in the project are invisible here.",
          ].map((l) => (
            <li key={l} className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
              <Link2Off size={13} className="mt-0.5 shrink-0 text-[var(--ink-3)]" />
              {l}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "warn" }) {
  return (
    <span
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
        tone === "warn" ? "border-[#FFB800]/35 bg-[#FFB800]/10 text-[#FFD166]" : "border-[var(--line-2)] bg-white/[0.02] text-[var(--ink)]"
      }`}
    >
      {tone === "warn" ? <Repeat size={14} /> : null}
      <span className="font-mono text-[17px] leading-none">{n}</span>
      <span className="text-[12px] text-[var(--ink-3)]">{label}</span>
    </span>
  );
}
