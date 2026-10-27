"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Check, CircleDashed, CircleSlash, Download, Loader2, ShieldCheck, X } from "lucide-react";
import { commitText, hashCommit, short } from "@/lib/git";
import { usePrefersReducedMotion } from "@/lib/theme";
import { AUTHOR, writeBlob, writeTree } from "@/features/repository/engine";
import type { GitObject } from "@/features/repository/types";
import { FIXTURE } from "@/features/impact-analysis/fixture";
import { isTestFile, parseFile } from "@/features/impact-analysis/source-analysis";
import { compareDiagnostics, unifiedPatch } from "@/features/mergelab/merge";
import { impactPreview } from "@/features/mergelab/semantic";
import type { TestOutcome } from "@/features/testing/harness";
import { runInWorker } from "./run-in-worker";
import { M, useMergeLab } from "./store";

type Diag = { path: string; line: number; column: number; code: number; message: string };
type Status = "pending" | "running" | "pass" | "fail" | "skip";
type Check = { id: string; label: string; status: Status; detail?: string; items?: { label: string; status: Status; detail?: string }[] };

const API = `/api/repos/${FIXTURE.owner}/${FIXTURE.repo}/merge-check`;

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

const ICON: Record<Status, { icon: typeof Check; color: string; label: string }> = {
  pending: { icon: CircleDashed, color: M.ink3, label: "waiting" },
  running: { icon: Loader2, color: M.base, label: "running" },
  pass: { icon: Check, color: M.resolved, label: "passed" },
  fail: { icon: X, color: M.red, label: "failed" },
  skip: { icon: CircleSlash, color: M.ink3, label: "not run" },
};

export function ResultPanel() {
  const [tab, setTab] = useState<"validate" | "history">("validate");
  const { log } = useMergeLab();
  return (
    <aside className="hud flex min-h-0 flex-col overflow-hidden" aria-label="Result">
      <div role="tablist" className="flex border-b border-white/8 px-2 pt-2">
        {(
          [
            ["validate", "Validate & export"],
            ["history", `History (${log.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="-mb-px border-b-2 border-transparent px-3 pb-2 text-[12.5px] text-[#9a90ad] aria-selected:border-[#3DE0A6] aria-selected:text-white"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">{tab === "validate" ? <Validate /> : <History />}</div>
    </aside>
  );
}

function Validate() {
  const { candidate, sides, refs, revision, places, select } = useMergeLab();
  const reduce = usePrefersReducedMotion();
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [ranAt, setRanAt] = useState<{ revision: number; time: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [diags, setDiags] = useState<{ introduced: Diag[]; existing: Diag[] } | null>(null);
  const [baseline, setBaseline] = useState<Diag[] | null>(null);
  const resolved = candidate.unresolved.length === 0;
  const stale = ranAt !== null && ranAt.revision !== revision;

  const preview = useMemo(() => (resolved ? impactPreview(sides.ours, candidate.files) : null), [resolved, sides.ours, candidate.files]);

  const run = async () => {
    setRunning(true);
    setDiags(null);
    const files = candidate.files;
    const testList = Object.entries(files)
      .filter(([p]) => isTestFile(p) && /\.[tj]sx?$/.test(p))
      .flatMap(([p, src]) => parseFile(p, src, new Set(Object.keys(files))).tests.map((t) => ({ path: p, name: t.name })));
    let list: Check[] = [
      { id: "markers", label: "No conflict markers left", status: "pending" },
      { id: "compile", label: "Every source file parses", status: "pending" },
      { id: "types", label: "Type check (strict)", status: "pending" },
      { id: "tests", label: `Tests (${testList.length})`, status: "pending", items: testList.map((t) => ({ label: t.name, status: "pending" as Status })) },
    ];
    const set = (id: string, patch: Partial<Check>) => {
      list = list.map((c) => (c.id === id ? { ...c, ...patch } : c));
      setChecks(list);
    };
    setChecks(list);

    // 1. Markers: every conflict resolved and no marker lines left in hand-edited files.
    set("markers", { status: "running" });
    const marked = Object.entries(files).filter(([, t]) => /^(<{7}|={7}|>{7})( |$)/m.test(t)).map(([p]) => p);
    set("markers", marked.length ? { status: "fail", detail: `Marker lines remain in ${marked.join(", ")}.` } : { status: "pass", detail: "No marker lines in any file." });

    // 2. Parse every source file on the server (nothing is executed there).
    set("compile", { status: "running" });
    let modules: Record<string, string> | null = null;
    try {
      const { results } = await post<{ results: ({ path: string; ok: true; js: string } | { path: string; ok: false; error: string })[] }>({ check: "compile", files });
      const bad = results.filter((r) => !r.ok) as { path: string; error: string }[];
      if (bad.length) set("compile", { status: "fail", detail: bad.map((b) => `${b.path}: ${b.error}`).join("\n\n") });
      else {
        set("compile", { status: "pass", detail: `${results.length} source files parsed.` });
        modules = Object.fromEntries(results.map((r) => [r.path, (r as { js: string }).js]));
      }
    } catch (e) {
      set("compile", { status: "fail", detail: (e as Error).message });
    }

    // 3. Type check the candidate, and our branch once, to tell new errors from existing ones.
    set("types", { status: "running" });
    try {
      type TC = { result: { available: true; diagnostics: Diag[]; ms: number } | { available: false; reason: string } };
      const base = baseline ?? (await post<TC>({ check: "types", files: sides.ours })).result;
      const now = (await post<TC>({ check: "types", files })).result;
      if (!now.available || !("diagnostics" in base)) set("types", { status: "skip", detail: now.available ? "Could not type-check our branch." : now.reason });
      else {
        if (!baseline) setBaseline(base.diagnostics);
        const split = compareDiagnostics(base.diagnostics, sides.ours, now.diagnostics, files);
        setDiags(split);
        set("types", {
          status: split.introduced.length ? "fail" : "pass",
          detail: `${split.introduced.length} new error${split.introduced.length === 1 ? "" : "s"} from this merge; ${split.existing.length} already on ${refs.ours}. ${now.ms} ms.`,
        });
      }
    } catch (e) {
      set("types", { status: "fail", detail: (e as Error).message });
    }

    // 4. Tests, each in a fresh worker in this browser.
    if (!modules) set("tests", { status: "skip", detail: "Not run: a file didn't parse.", items: list.find((c) => c.id === "tests")!.items!.map((i) => ({ ...i, status: "skip" })) });
    else {
      set("tests", { status: "running" });
      const items = [...list.find((c) => c.id === "tests")!.items!];
      for (let k = 0; k < testList.length; k++) {
        items[k] = { ...items[k], status: "running" };
        set("tests", { items: [...items] });
        const o: TestOutcome = await runInWorker(modules, testList[k].path, testList[k].name);
        items[k] = { ...items[k], status: o.status === "pass" ? "pass" : o.status === "fail" ? "fail" : "skip", detail: `${o.detail} · ${o.ms} ms` };
        set("tests", { items: [...items] });
      }
      const failed = items.filter((i) => i.status !== "pass").length;
      set("tests", { status: failed ? "fail" : "pass", detail: failed ? `${failed} of ${items.length} did not pass.` : `All ${items.length} passed, run in this browser.` });
    }
    setRanAt({ revision, time: Math.floor(Date.now() / 1000) });
    setRunning(false);
  };

  const allPass = !!checks && checks.every((c) => c.status === "pass") && !stale && !running;

  // The commit Git would write for this result. Nothing is written anywhere.
  const commit = useMemo(() => {
    if (!allPass || !ranAt) return null;
    const objects: Record<string, GitObject> = {};
    const tree = writeTree(objects, Object.fromEntries(Object.entries(candidate.files).map(([p, t]) => [p, writeBlob(objects, t)])));
    const input = { tree, parents: [refs.oursOid, refs.theirsOid], message: `Merge branch '${refs.theirs}' into ${refs.ours}`, author: AUTHOR, time: ranAt.time };
    return { oid: hashCommit(input), text: commitText(input) };
  }, [allPass, ranAt, candidate.files, refs]);

  const download = () => {
    const blob = new Blob([unifiedPatch(sides.ours, candidate.files)], { type: "text/x-patch" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `merge-${refs.theirs.replace(/\//g, "-")}-into-${refs.ours.replace(/\//g, "-")}.patch`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4 text-[12.5px]">
      {!resolved ? (
        <div className="rounded-xl border border-[#FF7A90]/30 bg-[#FF7A90]/[0.07] p-3 text-[#ffd0d8]">
          <p className="font-medium text-white">
            {candidate.unresolved.length} conflict{candidate.unresolved.length > 1 ? "s" : ""} still open
          </p>
          <ul className="mt-1 space-y-0.5">
            {candidate.unresolved.map((id) => (
              <li key={id}>
                <button type="button" onClick={() => select({ kind: "conflict", id })} className="font-mono text-[11.5px] underline decoration-dotted hover:text-white">
                  {places.get(id)!.symbols.map((s) => `${s}()`).join(", ") || id}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px]">Checks run once every conflict has a decision.</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#3DE0A6] text-[13px] font-medium text-[#06110c] disabled:opacity-60"
        >
          {running ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          {running ? "Validating…" : checks ? "Validate again" : "Validate the result"}
        </button>
      )}

      {stale && <p className="text-[11.5px] text-[#FFD99A]">The result changed after this run. These results are out of date.</p>}
      {candidate.handEdited && resolved && (
        <p className="text-[11.5px] text-[#9a90ad]">Includes hand-written code. It is parsed and type-checked on the server and only executed in this browser&apos;s test worker.</p>
      )}

      {checks && (
        <ol className={`space-y-2 ${stale ? "opacity-50" : ""}`} aria-label="Checks" aria-live="polite">
          {checks.map((c) => {
            const ic = ICON[c.status];
            return (
              <motion.li key={c.id} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
                <div className="flex items-center gap-2">
                  <ic.icon size={14} style={{ color: ic.color }} className={c.status === "running" ? "animate-spin" : ""} aria-label={ic.label} />
                  <span className="text-white">{c.label}</span>
                </div>
                {c.detail && <p className="mt-1 whitespace-pre-wrap pl-6 font-mono text-[11px] leading-relaxed text-[#9a90ad]">{c.detail}</p>}
                {c.id === "types" && diags && diags.introduced.length + diags.existing.length > 0 && (
                  <ul className="mt-1.5 space-y-1 pl-6">
                    {[...diags.introduced.map((d) => ({ d, isNew: true })), ...diags.existing.map((d) => ({ d, isNew: false }))].map(({ d, isNew }, k) => (
                      <li key={k} className="font-mono text-[11px] leading-snug">
                        <span style={{ color: isNew ? M.red : M.ink3 }}>{isNew ? "new" : `already on ${refs.ours}`}</span>{" "}
                        <span className="text-[#e7e1f2]">
                          {d.path}:{d.line}
                        </span>{" "}
                        <span className="text-[#c9c0d8]">{d.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {c.items && c.items.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 pl-6">
                    {c.items.map((it, k) => {
                      const ii = ICON[it.status];
                      return (
                        <li key={k} className="flex items-start gap-1.5 text-[11.5px]">
                          <ii.icon size={12} style={{ color: ii.color }} className={`mt-0.5 shrink-0 ${it.status === "running" ? "animate-spin" : ""}`} aria-label={ii.label} />
                          <span className="min-w-0">
                            <span className="text-[#e7e1f2]">{it.label}</span>
                            {it.detail && it.status !== "pass" && <span className="block font-mono text-[10.5px] text-[#9a90ad]">{it.detail}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </motion.li>
            );
          })}
        </ol>
      )}

      {preview && (
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold text-[#9a90ad]">Merge impact on {refs.ours}</h3>
          {preview.signatures.length === 0 ? (
            <p className="text-[#9a90ad]">No function signatures change compared with {refs.ours}.</p>
          ) : (
            <ul className="space-y-1">
              {preview.signatures.map((s) => (
                <li key={s.id} className="font-mono text-[11.5px] text-[#e7e1f2]">
                  {s.name}(<span className="text-[#9a90ad]">{s.from}</span>) → ({s.to})
                </li>
              ))}
            </ul>
          )}
          {preview.callSites.length > 0 && (
            <>
              <p className="mt-2 text-[11.5px] text-[#9a90ad]">Calls to changed signatures. Argument counts are checked against the new parameters; types are checked above.</p>
              <ul className="mt-1 space-y-1">
                {preview.callSites.map((c, k) => (
                  <li key={k} className="rounded-md border border-white/8 px-2 py-1 font-mono text-[11px]">
                    <span style={{ color: c.fits ? M.resolved : M.red }}>{c.fits ? "args ok" : `${c.args} args, needs ${c.min === c.max ? c.min : `${c.min}–${c.max}`}`}</span>{" "}
                    <span className="text-[#9a90ad]">
                      {c.path}:{c.line}
                    </span>
                    <span className="block truncate text-[#e7e1f2]">{c.text}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {preview.tests.length > 0 && (
            <p className="mt-2 text-[11.5px] text-[#9a90ad]">
              Tests that call changed functions: {[...new Set(preview.tests.map((t) => `“${t.name}”`))].join(", ")}.
            </p>
          )}
          <p className="mt-2 text-[11px] text-[#6f6782]">A preview from static analysis, not proof that the merge is correct.</p>
        </section>
      )}

      {resolved && (
        <section className="border-t border-white/8 pt-3">
          <h3 className="mb-1.5 text-[11px] font-semibold text-[#9a90ad]">Export</h3>
          <button type="button" onClick={download} className="flex h-9 w-full items-center justify-center gap-2 rounded-full border border-white/15 text-[12.5px] text-white hover:border-[#3DE0A6]">
            <Download size={14} /> Download patch for {refs.ours}
          </button>
          <p className="mt-1.5 text-[11px] text-[#9a90ad]">
            Apply it with <code className="font-mono text-[#c9c0d8]">git apply</code>. Nothing here changes a branch.
          </p>
          {commit ? (
            <div className="mt-3 rounded-lg border border-[#3DE0A6]/30 bg-[#3DE0A6]/[0.06] p-3">
              <p className="text-[11px] text-[#7ff0c4]">Validated. The merge commit Git would write (not written anywhere):</p>
              <p className="mt-1 font-mono text-[12px]" style={{ color: M.base }}>
                {short(commit.oid)}
              </p>
              <pre className="mt-1 overflow-x-auto whitespace-pre font-mono text-[10.5px] leading-relaxed text-[#c9c0d8]">{commit.text}</pre>
              <p className="mt-1 text-[10.5px] text-[#9a90ad]">The ID depends on the time; this one uses the moment validation finished.</p>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-[#6f6782]">The merge commit preview appears after every check passes.</p>
          )}
        </section>
      )}
    </div>
  );
}

function History() {
  const { log, places, reset } = useMergeLab();
  const [confirming, setConfirming] = useState(false);
  const name = (target: string) => {
    const p = places.get(target);
    return p ? `${p.symbols.map((s) => `${s}()`).join(", ") || target} · ${target.split("/").pop()}` : target;
  };
  return (
    <div className="space-y-3 text-[12.5px]">
      <p className="text-[11.5px] text-[#9a90ad]">Every decision, in order. Kept in this browser only.</p>
      {log.length === 0 ? (
        <p className="text-[#9a90ad]">No decisions yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {[...log].reverse().map((e, k) => (
            <li key={k} className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-1.5">
              <p className="flex justify-between gap-2">
                <span className="text-white">{e.action}</span>
                <span className="font-mono text-[10.5px] text-[#6f6782]">{new Date(e.at).toLocaleTimeString()}</span>
              </p>
              <p className="truncate font-mono text-[11px] text-[#9a90ad]">{name(e.target)}</p>
              {e.note && <p className="mt-0.5 text-[11.5px] text-[#c9c0d8]">“{e.note}”</p>}
            </li>
          ))}
        </ol>
      )}
      {confirming ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => (reset(), setConfirming(false))} className="h-8 rounded-full bg-[#FF7A90] px-3 text-[12px] font-medium text-[#1a0509]">
            Clear all decisions
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="h-8 rounded-full border border-white/15 px-3 text-[12px] text-[#c9c0d8]">
            Keep them
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="h-8 rounded-full border border-white/15 px-3 text-[12px] text-[#c9c0d8] hover:text-white">
          Start over
        </button>
      )}
    </div>
  );
}
