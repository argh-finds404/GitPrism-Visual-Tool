"use client";

import { useMemo, type ReactNode } from "react";
import { short } from "@/lib/git";
import { commitStory } from "@/features/timefold/history";
import { STATUS_STYLE } from "@/components/impact-studio/hud/ui";
import { C, LANE_COLOR, useTimeFold } from "./store";

const nameOf = (id: string) => id.replace(/^(sym|test|file):/, "").split("#").pop()!.split("/").pop()!;

/** The selected commit, explained from its diff and the parsed source. No generated text. */
export function StoryDrawer() {
  const { h, index, setLineage, setMode } = useTimeFold();
  const snap = h.snapshots[index];
  const story = useMemo(() => commitStory(h, index), [h, index]);
  const c = snap.commit;
  const parent = c.parents[0];
  const date = new Date(c.timestamp * 1000).toISOString().slice(0, 16).replace("T", " ");
  const follow = (id: string) => {
    setLineage(h.lineageOf.get(id) ?? id);
    setMode("dna");
  };

  return (
    <aside className="hud flex min-h-0 flex-col overflow-hidden" aria-label="Commit story">
      <div className="border-b border-white/8 p-4">
        <p className="font-mono text-[11px] text-[#9a90ad]">commit story</p>
        <h2 className="mt-1 text-[16px] font-semibold leading-snug text-white">{c.message}</h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[11.5px]">
          <dt className="text-[#9a90ad]">commit</dt>
          <dd className="truncate" style={{ color: C.amber }} title={c.oid}>
            {c.oid}
          </dd>
          <dt className="text-[#9a90ad]">parent</dt>
          <dd className="text-[#c9c0d8]">{parent ? short(parent) : "none (root commit)"}</dd>
          <dt className="text-[#9a90ad]">branch</dt>
          <dd style={{ color: LANE_COLOR[c.lane] }}>{c.lane}</dd>
          <dt className="text-[#9a90ad]">author</dt>
          <dd className="truncate text-[#c9c0d8]">{c.author.replace(/\s*<.*>/, "")}</dd>
          <dt className="text-[#9a90ad]">date</dt>
          <dd className="text-[#c9c0d8]">{date} UTC</dd>
        </dl>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 text-[12.5px]">
        <Section title="Files" count={story.files.length}>
          {story.files.map((f) => (
            <li key={f.path} className="flex items-center gap-2">
              <span className={`rounded px-1 font-mono text-[10px] ${STATUS_STYLE[f.status].cls}`}>{STATUS_STYLE[f.status].letter}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[#e7e1f2]" title={f.path}>
                {f.path}
              </span>
              <span className="font-mono text-[11px]" style={{ color: C.green }}>
                +{f.added}
              </span>
              <span className="font-mono text-[11px]" style={{ color: C.red }}>
                −{f.removed}
              </span>
            </li>
          ))}
        </Section>

        <Section
          title="Functions"
          count={story.symbols.added.length + story.symbols.modified.length + story.symbols.deleted.length + story.symbols.renamed.length}
        >
          {story.symbols.renamed.map((r) => (
            <Item key={r.id} color={C.amber} label={r.kind} onClick={() => follow(r.id)}>
              {nameOf(r.from)} → {nameOf(r.id)} <span className="text-[#9a90ad]">({r.evidence})</span>
            </Item>
          ))}
          {story.symbols.added.map((n) => (
            <Item key={n.id} color={C.green} label="added" onClick={() => follow(n.id)}>
              {n.name}({n.params})
            </Item>
          ))}
          {story.symbols.modified.map((n) => (
            <Item key={n.id} color={C.magenta} label={n.signatureChanged ? "signature" : "changed"} onClick={() => follow(n.id)}>
              {n.name}
              {n.signatureChanged ? (
                <span className="text-[#9a90ad]">
                  {" "}
                  ({n.baseParams}) → ({n.params})
                </span>
              ) : (
                "()"
              )}
            </Item>
          ))}
          {story.symbols.deleted.map((n) => (
            <Item key={n.id} color={C.red} label="deleted">
              {n.name}()
            </Item>
          ))}
        </Section>

        <Section title="Dependencies" count={story.edges.added.length + story.edges.removed.length}>
          {story.edges.added.map((e) => (
            <Item key={e.id} color={C.green} label={`+ ${e.kind}`}>
              {nameOf(e.source)} → {nameOf(e.target)}
            </Item>
          ))}
          {story.edges.removed.map((e) => (
            <Item key={e.id} color={C.red} label={`− ${e.kind}`}>
              {nameOf(e.source)} → {nameOf(e.target)}
            </Item>
          ))}
        </Section>

        <Section title="Tests touched" count={story.tests.length}>
          {story.tests.map((t) => (
            <Item key={t.id} color={C.green} label={t.changeStatus === "added" ? "added" : "changed"}>
              “{t.name}” <span className="text-[#9a90ad]">{t.path.split("/").pop()}</span>
            </Item>
          ))}
        </Section>

        <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3 text-[11.5px] leading-relaxed text-[#9a90ad]">
          <p className="mb-1 font-medium text-[#c9c0d8]">What this doesn&apos;t tell you</p>
          No tests were run to build this story; run them in Regression hunt. Relationships come from explicit imports and direct calls, so method calls and
          dynamic imports are not seen. Everything here is computed from the diff and the parsed source; none of it is generated text.
        </div>
      </div>
    </aside>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-[#9a90ad]">
        {title}
        <span className="font-mono font-normal">{count}</span>
      </h3>
      {count ? <ul className="space-y-1">{children}</ul> : <p className="text-[12px] text-[#6f6782]">None in this commit.</p>}
    </section>
  );
}

function Item({ color, label, children, onClick }: { color: string; label: string; children: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <span className="w-[4.6rem] shrink-0 font-mono text-[10.5px]" style={{ color }}>
        {label}
      </span>
      <span className="min-w-0 flex-1 break-words font-mono text-[11.5px] text-[#e7e1f2]">{children}</span>
    </>
  );
  return (
    <li>
      {onClick ? (
        <button type="button" onClick={onClick} className="flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left hover:bg-white/5" title="Follow this function">
          {body}
        </button>
      ) : (
        <div className="flex items-baseline gap-2 px-1 py-0.5">{body}</div>
      )}
    </li>
  );
}
