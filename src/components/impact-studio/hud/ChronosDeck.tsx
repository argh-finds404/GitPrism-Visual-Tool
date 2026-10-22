"use client";

import { forwardRef, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Command, Pause, Play } from "lucide-react";
import { parseCommand, EXAMPLES, type CommandAction } from "@/features/impact-analysis/commands";
import { chronosFileStatus } from "../lens-layouts";
import { useStudio } from "../store";
import { short } from "@/lib/git";
import { usePrefersReducedMotion } from "@/lib/theme";
import { STATUS_STYLE } from "./ui";
import type { ChangeStatus } from "@/features/impact-analysis/types";

export function ChronosDeck({ commandRef, compact = false }: { commandRef: React.RefObject<HTMLInputElement | null>; compact?: boolean }) {
  const s = useStudio();
  const reduce = usePrefersReducedMotion();
  const [playing, setPlaying] = useState(false);
  const steps = useMemo(() => [s.history.base, ...s.history.commits], [s.history]);
  const last = steps.length - 1;
  const step = s.chronosStep;
  const active = playing && step < last;
  const { setChronosStep } = s;

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setChronosStep(step + 1), reduce ? 500 : 1400);
    return () => clearTimeout(t);
  }, [active, step, setChronosStep, reduce]);

  const go = (i: number) => {
    s.setChronosStep(Math.max(0, Math.min(last, i)));
    if (s.lens !== 5) s.setLens(5);
  };

  // Files that changed in the commit at this step, compared with the step before.
  const changedHere = useMemo(() => {
    if (step === 0) return [];
    const now = steps[step].files;
    const prev = steps[step - 1].files;
    return [...new Set([...Object.keys(now), ...Object.keys(prev)])]
      .filter((p) => now[p] !== prev[p])
      .map((p) => ({ path: p, status: chronosFileStatus(p, now, prev) as ChangeStatus }));
  }, [step, steps]);

  return (
    <section aria-label="Chronos timeline and commands" className="hud p-2.5">
      {!compact && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-[#FFB800]">Chronos</span>
          <button type="button" onClick={() => go(step - 1)} disabled={step === 0} aria-label="Previous commit" className="grid h-6 w-6 place-items-center rounded text-[#c9c0d8] hover:bg-white/8 disabled:opacity-30">
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (step >= last) go(0);
              else if (s.lens !== 5) s.setLens(5);
              setPlaying(!active);
            }}
            aria-label={active ? "Pause" : "Play"}
            className="grid h-6 w-6 place-items-center rounded bg-[#FFB800] text-[#100E16]"
          >
            {active ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button type="button" onClick={() => go(step + 1)} disabled={step === last} aria-label="Next commit" className="grid h-6 w-6 place-items-center rounded text-[#c9c0d8] hover:bg-white/8 disabled:opacity-30">
            <ChevronRight size={14} />
          </button>

          <ol className="relative mx-2 mb-3 flex flex-1 items-center justify-between" aria-label="Commits in range">
            <span className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/12" aria-hidden="true" />
            <span
              className="absolute left-2 top-1/2 h-px -translate-y-1/2 bg-[#FFB800] transition-[width] duration-500"
              style={{ width: `calc(${(step / last) * 100}% - ${(step / last) * 16}px)` }}
              aria-hidden="true"
            />
            {steps.map((c, i) => (
              <li key={c.oid} className="relative">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === step ? "step" : undefined}
                  title={`${short(c.oid)} ${c.message}`}
                  className="group flex flex-col items-center"
                >
                  <span className={`block h-3 w-3 rotate-45 rounded-[2px] border transition-colors ${i === step ? "border-[#FFB800] bg-[#FFB800] shadow-[0_0_10px_#FFB800]" : i < step ? "border-[#FFB800] bg-[#2a2232]" : "border-white/30 bg-[#1A1623]"}`} />
                  <span
                    className={`absolute top-4 whitespace-nowrap font-mono text-[10px] ${
                      i === step ? "text-[#FFD166]" : "hidden text-[#7d748f] group-hover:block group-focus-visible:block"
                    }`}
                  >
                    {i === 0 ? "base" : short(c.oid)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      {!compact && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[#c9c0d8]">
          <span className="font-mono text-[#FFD166]">{step === 0 ? "base" : `${step}/${last}`}</span>
          <span className="truncate">{steps[step].message}</span>
          {changedHere.map((f) => (
            <button
              key={f.path}
              type="button"
              onClick={() => s.select(`file:${f.path}`, { tab: "source" })}
              className="flex items-center gap-1 rounded bg-white/6 px-1.5 font-mono text-[10.5px] hover:bg-white/12"
            >
              <span className={STATUS_STYLE[f.status].cls.split(" ").find((c) => c.startsWith("text-"))}>{STATUS_STYLE[f.status].letter}</span>
              {f.path.split("/").pop()}
            </button>
          ))}
        </p>
      )}
      <CommandBar ref={commandRef} />
    </section>
  );
}

const CommandBar = forwardRef<HTMLInputElement>(function CommandBar(_, ref) {
  const s = useStudio();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);

  const runAction = (a: CommandAction) => {
    const r = s.result!;
    const ids = (list: string[]) => new Set(list);
    switch (a.type) {
      case "callers": {
        const callers = r.edges.filter((e) => e.target === a.nodeId && e.kind !== "tests").map((e) => e.source);
        s.setHighlight({ ids: ids([a.nodeId, ...callers]), label: "Direct callers" });
        if (s.lens === 5) s.setLens(1);
        s.select(a.nodeId, { tab: "calls" });
        break;
      }
      case "tests": {
        const node = r.nodes.find((n) => n.id === a.nodeId)!;
        const targets = node.kind === "file" ? r.nodes.filter((n) => n.fileId === node.id).map((n) => n.id) : [node.id];
        const tests = r.edges.filter((e) => e.kind === "tests" && targets.includes(e.target)).map((e) => e.source);
        s.setHighlight({ ids: ids([a.nodeId, ...targets, ...tests]), label: "Related tests" });
        if (s.lens === 5 || s.lens === 3) s.setLens(1);
        s.select(a.nodeId, { tab: "tests" });
        break;
      }
      case "changed":
        s.setHighlight({ ids: ids(r.nodes.filter((n) => n.changeStatus !== "unchanged").map((n) => n.id)), label: "Changed since base" });
        s.setLens(1);
        s.requestFit();
        break;
      case "cycles":
        s.setHighlight({ ids: ids(r.cycles.flat()), label: "Import cycles" });
        s.setLens(3);
        break;
      case "compare":
        s.select(a.nodeId, { tab: "source" });
        s.setSourceCompare(true);
        break;
      case "focus":
        s.select(a.nodeId);
        break;
      case "lens":
        s.setLens(a.lens as 1 | 2 | 3 | 4 | 5);
        break;
    }
  };

  const submit = (value: string) => {
    const res = parseCommand(value, s.result);
    if (res.ok) {
      runAction(res.action);
      setMsg({ ok: true, text: res.label });
      setText("");
      setOpen(false);
    } else setMsg({ ok: false, text: res.message });
  };

  return (
    <div className="relative mt-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-2.5 focus-within:border-[#7C3AED]"
      >
        <Command size={13} className="shrink-0 text-[#9a90ad]" />
        <label htmlFor="studio-command" className="sr-only">
          Command
        </label>
        <input
          ref={ref}
          id="studio-command"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => e.key === "Escape" && (e.currentTarget.blur(), setOpen(false))}
          placeholder="Find changed symbols, test gaps or dependency paths…"
          autoComplete="off"
          className="h-9 min-w-0 flex-1 bg-transparent text-[12.5px] text-white placeholder:text-[#7d748f] focus:outline-none"
        />
        <span className="kbd hidden sm:inline-grid">Ctrl K</span>
      </form>
      {open && (
        <ul className="hud absolute bottom-full left-0 right-0 mb-2 p-1.5" role="listbox" aria-label="Suggestions">
          {EXAMPLES.filter((e) => !text || e.toLowerCase().includes(text.toLowerCase())).map((e) => (
            <li key={e}>
              <button type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => submit(e)} className="w-full rounded-lg px-2.5 py-1.5 text-left text-[12px] text-[#c9c0d8] hover:bg-white/8 hover:text-white">
                {e}
              </button>
            </li>
          ))}
          {text && <li className="px-2.5 py-1 text-[11px] text-[#7d748f]">Press Enter to run “{text}”. Symbol and file names also work.</li>}
        </ul>
      )}
      {msg && (
        <p className={`mt-1.5 px-1 text-[11.5px] ${msg.ok ? "text-[#3DE0A6]" : "text-[#FFD166]"}`} role="status">
          {msg.ok ? `Showing: ${msg.text}` : msg.text}
        </p>
      )}
    </div>
  );
});
