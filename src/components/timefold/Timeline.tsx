"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { short } from "@/lib/git";
import { usePrefersReducedMotion } from "@/lib/theme";
import { C, LANE_COLOR, useTimeFold } from "./store";

const H = 104;
const LANE_Y: Record<string, number> = { main: 70, "feat/auth": 34 };
const PAD = 30;

export function relativeDay(ts: number, ref: number) {
  const d = Math.round((ref - ts) / 86400);
  const hrs = Math.round((ts - ref) / 3600);
  if (d === 0 && hrs > 0) return `${hrs} h after base`;
  if (d === 0) return "base";
  return `${d} day${d === 1 ? "" : "s"} before base`;
}

export function Timeline() {
  const s = useTimeFold();
  const { h, index, setIndex, preview, setPreview, visible, relevant, playing, setPlaying, speed, setSpeed, mode, bisect, onlyRelevant, setOnlyRelevant, dna } =
    s;
  const reduce = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  // Unknown until measured; the track is drawn only once the width is real, so nothing slides in from a guess.
  const [measured, setW] = useState<number | null>(null);
  const w = measured ?? 0;

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const xOf = (k: number) => (visible.length < 2 ? w / 2 : PAD + ((w - PAD * 2) * k) / (visible.length - 1));
  const pos = new Map(visible.map((i, k) => [i, xOf(k)]));
  const nearest = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    const x = clientX - r.left;
    let best = visible[0];
    for (const i of visible) if (Math.abs(pos.get(i)! - x) < Math.abs(pos.get(best)! - x)) best = i;
    return best;
  };
  // When the current commit is filtered out, the playhead sits at the nearest visible one before it.
  const anchor = (i: number) => (pos.has(i) ? i : ([...visible].reverse().find((v) => v <= i) ?? visible[0]));
  const shown = preview ?? index;
  const headX = pos.get(anchor(shown)) ?? 0;

  const step = (dir: 1 | -1, list = visible) => {
    const next = dir > 0 ? list.find((i) => i > index) : [...list].reverse().find((i) => i < index);
    if (next !== undefined) setIndex(next);
  };

  // Playback walks the visible commits and stops at the end.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = visible.find((i) => i > index);
      if (next === undefined) setPlaying(false);
      else setIndex(next);
    }, 1400 / speed);
    return () => clearInterval(id);
  }, [playing, index, visible, speed, setIndex, setPlaying]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "Home") setIndex(visible[0]);
    else if (e.key === "End") setIndex(visible.at(-1)!);
    else return;
    e.preventDefault();
  };

  const current = h.snapshots[shown].commit;
  const baseTs = h.snapshots.findLast((x) => x.commit.lane === "main")!.commit.timestamp;
  const hidden = h.snapshots.length - visible.length;

  // Lines between consecutive visible commits; dashed where hidden commits sit between them.
  const segs = visible.slice(1).map((i, k) => {
    const prev = visible[k];
    const a = h.snapshots[prev].commit.lane;
    const b = h.snapshots[i].commit.lane;
    const x1 = pos.get(prev)!;
    const x2 = pos.get(i)!;
    const y1 = LANE_Y[a];
    const y2 = LANE_Y[b];
    const d = a === b ? `M${x1} ${y1}H${x2}` : `M${x1} ${y1}C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;
    return { key: `${prev}-${i}`, d, color: LANE_COLOR[b], gap: i - prev > 1 };
  });

  const probes = new Map((mode === "bisect" ? (bisect?.probes ?? []) : []).map((p) => [p.index, p.outcome.status]));
  const range = mode === "bisect" && bisect && !bisect.result ? [bisect.lo, bisect.hi] : null;

  return (
    <div className="hud flex flex-col gap-2 px-3 pb-2 pt-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-0.5" role="group" aria-label="Playback">
          <TButton label="Previous change to this function" onClick={() => step(-1, relevant)} disabled={!relevant.some((i) => i < index)}>
            <SkipBack size={14} />
          </TButton>
          <TButton label="Previous commit" onClick={() => step(-1)} disabled={visible[0] >= index}>
            <ChevronLeft size={16} />
          </TButton>
          <TButton label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)} primary>
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </TButton>
          <TButton label="Next commit" onClick={() => step(1)} disabled={visible.at(-1)! <= index}>
            <ChevronRight size={16} />
          </TButton>
          <TButton label="Next change to this function" onClick={() => step(1, relevant)} disabled={!relevant.some((i) => i > index)}>
            <SkipForward size={14} />
          </TButton>
          <button
            type="button"
            onClick={() => setSpeed(speed === 4 ? 1 : ((speed * 2) as 2 | 4))}
            className="ml-1 h-7 rounded-md border border-white/10 px-2 font-mono text-[11px] text-[#c9c0d8] hover:text-white"
            aria-label={`Playback speed ${speed}×`}
          >
            {speed}×
          </button>
        </div>

        <p className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#c9c0d8]" aria-live="polite">
          <span style={{ color: C.amber }}>{short(current.oid)}</span> <span className="text-white">{current.message}</span>
          <span className="text-[#9a90ad]">
            {" "}
            · {current.lane} · {relativeDay(current.timestamp, baseTs)}
          </span>
        </p>

        {mode === "dna" && (
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#c9c0d8]">
            <input type="checkbox" checked={onlyRelevant} onChange={(e) => setOnlyRelevant(e.target.checked)} className="accent-[#9D7BFF]" />
            Only commits that change {dna.findLast((d) => d.fn)?.fn?.name ?? "this function"}
            {onlyRelevant && hidden > 0 && <span className="text-[#9a90ad]">({hidden} hidden)</span>}
          </label>
        )}
      </div>

      <div
        ref={box}
        role="slider"
        tabIndex={0}
        aria-label="Commit timeline"
        aria-valuemin={0}
        aria-valuemax={h.snapshots.length - 1}
        aria-valuenow={index}
        aria-valuetext={`${short(h.snapshots[index].commit.oid)} ${h.snapshots[index].commit.message}`}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setPlaying(false);
          setPreview(nearest(e.clientX));
        }}
        onPointerMove={(e) => preview !== null && setPreview(nearest(e.clientX))}
        onPointerUp={() => {
          if (preview !== null) setIndex(preview);
          setPreview(null);
        }}
        onPointerCancel={() => setPreview(null)}
        className="relative cursor-pointer touch-none select-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#9D7BFF]"
        style={{ height: H }}
      >
        {measured !== null && (
          <svg width={w} height={H} className="absolute inset-0" aria-hidden="true">
            {/* Lane labels */}
            {Object.entries(LANE_Y).map(([lane, y]) => (
              <text key={lane} x={4} y={y - 9} fontSize={9.5} fill={LANE_COLOR[lane]} opacity={0.7} fontFamily="var(--font-mono)">
                {lane}
              </text>
            ))}

            {range && pos.has(range[0]) && pos.has(range[1]) && (
              <rect
                x={pos.get(range[0])!}
                y={14}
                width={pos.get(range[1])! - pos.get(range[0])!}
                height={H - 26}
                rx={8}
                fill="rgb(255 193 92 / 0.08)"
                stroke="rgb(255 193 92 / 0.35)"
                strokeDasharray="3 4"
              />
            )}

            {segs.map((sg) => (
              <path key={sg.key} d={sg.d} fill="none" stroke={sg.color} strokeOpacity={0.55} strokeWidth={1.6} strokeDasharray={sg.gap ? "2 5" : undefined} />
            ))}

            {visible.map((i) => {
              const c = h.snapshots[i].commit;
              const x = pos.get(i)!;
              const y = LANE_Y[c.lane];
              const touched = dna[i].events.length > 0;
              const on = i === anchor(shown);
              const r = on ? 8 : touched ? 6 : 4.5;
              const status = probes.get(i);
              const color = LANE_COLOR[c.lane];
              return (
                <g key={c.oid}>
                  <path
                    d={`M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`}
                    fill={touched || on ? color : "#120e20"}
                    stroke={color}
                    strokeWidth={1.4}
                    opacity={mode === "dna" && !touched && !on ? 0.55 : 1}
                  />
                  {status && (
                    <text
                      x={x}
                      y={y + 24}
                      textAnchor="middle"
                      fontSize={11}
                      fontFamily="var(--font-mono)"
                      fill={status === "pass" ? C.green : status === "fail" ? C.red : C.ink3}
                    >
                      {status === "pass" ? "✓" : status === "fail" ? "✗" : "↷"}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Playhead */}
            <motion.g
              initial={false}
              animate={{ x: headX }}
              transition={{
                duration: reduce || preview !== null ? 0 : 0.3,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <line x1={0} x2={0} y1={8} y2={H - 6} stroke={C.amber} strokeWidth={1.2} strokeDasharray="1 3" />
              <circle cx={0} cy={8} r={3.5} fill={C.amber} />
            </motion.g>
          </svg>
        )}

        {preview !== null && (
          <div
            className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#120e20] px-2 py-1 font-mono text-[11px]"
            style={{ left: Math.min(Math.max(headX, 90), w - 90) }}
          >
            <span style={{ color: C.amber }}>{short(h.snapshots[preview].commit.oid)}</span> {h.snapshots[preview].commit.message}
          </div>
        )}
      </div>
    </div>
  );
}

function TButton({
  children,
  label,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid h-7 w-7 place-items-center rounded-md transition-colors disabled:opacity-30 ${
        primary ? "bg-[#9D7BFF] text-[#0b0816] hover:bg-[#b49cff]" : "text-[#c9c0d8] hover:bg-white/8 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
