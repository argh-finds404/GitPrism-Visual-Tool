"use client";

import dynamic from "next/dynamic";
import { useMemo, type ReactNode } from "react";
import { ArrowLeftRight, FileText, GitBranch, Route, ScanSearch, Sparkles } from "lucide-react";
import { useRepository } from "@/features/repository/RepositoryProvider";
import { ancestors, catFile, currentBranch, getCommit, headCommitId, referencesTo } from "@/features/repository/engine";
import type { GitObject } from "@/features/repository/types";
import { pathToObject } from "@/lib/graph/build-graph";
import { useWorkbench } from "@/components/workbench/WorkbenchContext";
import { formatTime, Glyph, kindName, Oid, type GlyphKind } from "@/components/workbench/bits";
import { PrismMark } from "@/components/brand/PrismMark";
import { usePrefersReducedMotion } from "@/lib/theme";
import { short } from "@/lib/git";

const PrismLens = dynamic(() => import("@/components/three/PrismLens"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center">
      <PrismMark className="h-10 w-10" />
    </div>
  ),
});

const lensColor: Record<GlyphKind | "none", string> = {
  commit: "#9579f5",
  tree: "#4cc38a",
  blob: "#68d9f5",
  branch: "#f0b75a",
  head: "#f0b75a",
  none: "#b6a0ff",
};
const turnOf: Record<GlyphKind | "none", number> = { none: 0, commit: 1, tree: 2, blob: 3, branch: 4, head: 4 };

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[11.5px] text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-ink">{children}</dd>
    </div>
  );
}

function Action({ icon, children, onClick, disabled }: { icon: ReactNode; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 items-center gap-1.5 rounded-full border border-line-2 px-3 text-[12px] text-ink-2 transition-colors hover:border-violet hover:text-violet-ink disabled:pointer-events-none disabled:opacity-40"
    >
      {icon}
      {children}
    </button>
  );
}

function ObjLink({ oid, onClick }: { oid: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border border-line-2 px-1.5 py-0.5 font-mono text-[11.5px] text-ink-2 hover:border-violet hover:text-violet-ink">
      {short(oid)}
    </button>
  );
}

export function PrismInspector() {
  const { state } = useRepository();
  const wb = useWorkbench();
  const reduce = usePrefersReducedMotion();
  const sel = wb.selection;
  const obj: GitObject | undefined = sel?.kind === "object" ? state.objects[sel.oid] : undefined;
  const kind: GlyphKind | "none" = obj ? obj.type : sel?.kind === "branch" ? "branch" : sel?.kind === "head" ? "head" : "none";

  const goObject = (oid: string) => {
    wb.select({ kind: "object", oid });
    const t = state.objects[oid]?.type;
    if (t !== "commit" && wb.view === "history") wb.setView("objects");
  };

  const traceObject = (oid: string) => {
    const o = state.objects[oid];
    if (o?.type === "commit") {
      wb.setTrace([...ancestors(state, oid)]);
      if (wb.view === "objects") wb.setView("history");
      return;
    }
    const roots = [wb.focusCommit, headCommitId(state)].filter(Boolean) as string[];
    for (const c of roots) {
      const p = pathToObject(state, c, oid);
      if (p) {
        wb.setFocusCommit(c);
        wb.setTrace(p);
        if (wb.view === "history") wb.setView("objects");
        return;
      }
    }
    const ref = referencesTo(state, oid)[0];
    const p = ref && pathToObject(state, ref.commit, oid);
    if (p) {
      wb.setFocusCommit(ref.commit);
      wb.setTrace(p);
      if (wb.view === "history") wb.setView("objects");
    } else wb.notify("No commit references this object yet. It exists only because something was staged.", "info");
  };

  return (
    <section aria-label="Prism Lens inspector" className="flex h-full min-h-0 flex-col bg-paper">
      <div className="night relative h-28 shrink-0 overflow-hidden border-b border-line bg-[radial-gradient(60%_90%_at_70%_50%,#2d2550,#191720)]">
        <div className="absolute inset-y-0 right-0 w-2/3">
          <PrismLens color={lensColor[kind]} turn={turnOf[kind]} reduced={reduce} />
        </div>
        <div className="absolute left-4 top-3">
          <p className="text-[12px] font-semibold text-[#f3f1f8]">Prism Lens</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[#b9b3c8]">
            {kind !== "none" && <Glyph kind={kind} size={10} />}
            {kind === "none" ? "Nothing selected" : kindName[kind]}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4" aria-live="polite">
        {!sel && <Empty />}
        {obj?.type === "commit" && (
          <CommitView obj={obj} goObject={goObject} trace={() => traceObject(obj.oid)} />
        )}
        {obj?.type === "tree" && <TreeView obj={obj} goObject={goObject} trace={() => traceObject(obj.oid)} />}
        {obj?.type === "blob" && <BlobView obj={obj} trace={() => traceObject(obj.oid)} />}
        {sel?.kind === "branch" && <BranchView name={sel.name} goObject={goObject} />}
        {sel?.kind === "head" && <HeadView goObject={goObject} />}

        {obj && (
          <details className="group mt-6 rounded-xl border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[12px] font-medium text-ink-2">
              Technical details
              <span className="text-ink-3 transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="border-t border-line px-3 py-3">
              <p className="text-[11.5px] text-ink-3">
                Hashed bytes start with the header <span className="font-mono text-ink">{obj.type} {new TextEncoder().encode(catFileBody(obj)).length}\0</span>
                {obj.type === "tree" && " (entries store raw 20-byte IDs, shown here as hex)"}
              </p>
              <p className="mt-2 font-mono text-[11px] text-ink-3">$ git cat-file -p {short(obj.oid)}</p>
              <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-night p-2.5 font-mono text-[11px] leading-5 text-[#e9e6f2]">
                {catFile(obj)}
              </pre>
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

/** Byte length Git uses in the header. Trees use binary IDs (20 bytes each). */
function catFileBody(obj: GitObject) {
  if (obj.type !== "tree") return catFile(obj);
  return obj.entries.map((e) => `${e.mode === "040000" ? "40000" : e.mode} ${e.name}\0` + "x".repeat(20)).join("");
}

function Empty() {
  const { state } = useRepository();
  const wb = useWorkbench();
  const head = headCommitId(state);
  return (
    <div>
      <h2 className="text-[15px] font-semibold">Look inside any object</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
        Select a commit, tree or blob on the canvas. The lens shows what it stores, what it points to, and why it exists.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {head && (
          <button type="button" onClick={() => wb.select({ kind: "object", oid: head })} className="rounded-xl border border-line bg-surface p-3 text-left text-[12.5px] hover:border-violet">
            <span className="font-medium">Open the latest commit</span>
            <span className="block text-ink-3">See its tree, parent and message.</span>
          </button>
        )}
        <button type="button" onClick={() => wb.open("README.md")} className="rounded-xl border border-line bg-surface p-3 text-left text-[12.5px] hover:border-violet">
          <span className="font-medium">Edit README.md</span>
          <span className="block text-ink-3">Change a line and watch its blob ID change.</span>
        </button>
        <button type="button" onClick={() => wb.setGuided(true)} className="rounded-xl border border-line bg-surface p-3 text-left text-[12.5px] hover:border-violet">
          <span className="font-medium">Try guided mode</span>
          <span className="block text-ink-3">Short challenges with hints.</span>
        </button>
      </div>
    </div>
  );
}

function CommitView({ obj, goObject, trace }: { obj: Extract<GitObject, { type: "commit" }>; goObject: (o: string) => void; trace: () => void }) {
  const { state } = useRepository();
  const wb = useWorkbench();
  const refs = Object.entries(state.branches).filter(([, t]) => t === obj.oid).map(([b]) => b);
  return (
    <div>
      <h2 className="text-[17px] font-semibold leading-snug">{obj.message}</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
        A commit records one snapshot: it points to a root tree and to the commit{obj.parents.length > 1 ? "s" : ""} it came from.
      </p>
      <dl className="mt-4 space-y-3">
        <Field label="Commit ID">
          <Oid oid={obj.oid} full className="text-[12px]" />
        </Field>
        <Field label="Root tree">
          <ObjLink oid={obj.tree} onClick={() => goObject(obj.tree)} />
        </Field>
        <Field label={obj.parents.length > 1 ? "Parents" : "Parent"}>
          {obj.parents.length ? (
            <span className="flex flex-wrap gap-1">
              {obj.parents.map((p) => (
                <ObjLink key={p} oid={p} onClick={() => goObject(p)} />
              ))}
            </span>
          ) : (
            <span className="text-ink-3">None. This is the first commit.</span>
          )}
        </Field>
        <Field label="Author">
          <span className="font-mono text-[12px]">{obj.author}</span>
        </Field>
        <Field label="Date">{formatTime(obj.timestamp)}</Field>
        {refs.length > 0 && <Field label="Branches here">{refs.map((r) => <span key={r} className="mr-1.5 font-mono text-[12px]">{r}</span>)}</Field>}
      </dl>
      <div className="mt-5 flex flex-wrap gap-1.5">
        <Action icon={<ScanSearch size={13} />} onClick={() => { wb.setFocusCommit(obj.oid); wb.setView("objects"); }}>
          Inspect tree
        </Action>
        <Action
          icon={<ArrowLeftRight size={13} />}
          disabled={!obj.parents.length}
          onClick={() => {
            wb.setCompare({ base: obj.parents[0], target: obj.oid, path: null });
            wb.showBottom("compare");
          }}
        >
          Compare with parent
        </Action>
        <Action icon={<Route size={13} />} onClick={trace}>
          Trace origin
        </Action>
      </div>
    </div>
  );
}

function TreeView({ obj, goObject, trace }: { obj: Extract<GitObject, { type: "tree" }>; goObject: (o: string) => void; trace: () => void }) {
  const { state } = useRepository();
  const refs = useMemo(() => referencesTo(state, obj.oid), [state, obj.oid]);
  return (
    <div>
      <h2 className="text-[17px] font-semibold">Directory listing</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
        A tree lists names, modes and the IDs of the blobs and subtrees inside one folder. Filenames live here, not in blobs.
      </p>
      <dl className="mt-4 space-y-3">
        <Field label="Tree ID">
          <Oid oid={obj.oid} full className="text-[12px]" />
        </Field>
      </dl>
      <h3 className="mt-4 text-[11.5px] text-ink-3">Entries</h3>
      <ul className="mt-1 divide-y divide-line rounded-xl border border-line bg-surface">
        {obj.entries.map((e) => (
          <li key={e.name}>
            <button type="button" onClick={() => goObject(e.oid)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-violet-wash">
              <Glyph kind={e.type} size={10} />
              <span className="min-w-0 flex-1 truncate text-[12.5px]">
                {e.name}
                {e.type === "tree" ? "/" : ""}
              </span>
              <span className="font-mono text-[10.5px] text-ink-3">{e.mode}</span>
              <span className="font-mono text-[11px] text-ink-2">{short(e.oid)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-ink-3">
        Used by {new Set(refs.map((r) => r.commit)).size} commit{new Set(refs.map((r) => r.commit)).size === 1 ? "" : "s"}. Unchanged folders keep the same tree ID from commit to commit.
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Action icon={<Route size={13} />} onClick={trace}>
          Trace origin
        </Action>
      </div>
    </div>
  );
}

function BlobView({ obj, trace }: { obj: Extract<GitObject, { type: "blob" }>; trace: () => void }) {
  const { state } = useRepository();
  const wb = useWorkbench();
  const refs = useMemo(() => referencesTo(state, obj.oid), [state, obj.oid]);
  const paths = [...new Set(refs.map((r) => r.path))];
  const stagedAs = Object.entries(state.index).filter(([, o]) => o === obj.oid).map(([p]) => p);
  const openable = [...new Set([...paths, ...stagedAs])].filter((p) => p in state.worktree);
  return (
    <div>
      <h2 className="text-[17px] font-semibold">File content</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
        A blob holds bytes and nothing else: no name, no date. Its ID is the SHA-1 of a small header plus the content.
      </p>
      <dl className="mt-4 space-y-3">
        <Field label="Blob ID">
          <Oid oid={obj.oid} full className="text-[12px]" />
        </Field>
        <Field label="Size">{obj.size} bytes</Field>
        <Field label="Named in trees as">
          {paths.length ? (
            <span className="flex flex-wrap gap-1">
              {paths.map((p) => (
                <span key={p} className="rounded bg-paper-2 px-1.5 py-0.5 font-mono text-[11.5px]">
                  {p}
                </span>
              ))}
            </span>
          ) : (
            <span className="text-ink-3">Not in any commit yet{stagedAs.length ? `. Staged as ${stagedAs.join(", ")}` : ""}.</span>
          )}
        </Field>
      </dl>
      {paths.length > 1 && (
        <p className="mt-3 rounded-lg bg-violet-wash px-3 py-2 text-[12px] text-violet-ink">
          Several paths share this one object because their content is identical.
        </p>
      )}
      <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-line bg-surface p-3 font-mono text-[11.5px] leading-5 text-ink-2">
        {obj.content || <span className="text-ink-3">(empty file)</span>}
      </pre>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {openable[0] && (
          <Action icon={<FileText size={13} />} onClick={() => wb.open(openable[0])}>
            Open {openable[0].split("/").pop()}
          </Action>
        )}
        <Action icon={<Route size={13} />} onClick={trace}>
          Trace origin
        </Action>
      </div>
    </div>
  );
}

function BranchView({ name, goObject }: { name: string; goObject: (o: string) => void }) {
  const { state, replaying } = useRepository();
  const wb = useWorkbench();
  const target = state.branches[name];
  const commit = getCommit(state, target);
  const isCurrent = currentBranch(state) === name;
  if (!commit) return <p className="text-[13px] text-ink-3">This branch no longer exists.</p>;
  return (
    <div>
      <h2 className="flex items-center gap-2 font-mono text-[16px] font-semibold">
        <GitBranch size={16} className="text-[color:var(--c-ref)]" /> {name}
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
        A branch is a movable name for one commit. It isn&apos;t a copy of your files; it moves forward when you commit while it&apos;s checked out.
      </p>
      <dl className="mt-4 space-y-3">
        <Field label="Points at">
          <span className="flex items-center gap-2">
            <ObjLink oid={target} onClick={() => goObject(target)} /> <span className="truncate text-[12.5px]">{commit.message}</span>
          </span>
        </Field>
        <Field label="Checked out">{isCurrent ? "Yes. HEAD refers to this branch." : "No"}</Field>
      </dl>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {!isCurrent && (
          <Action icon={<GitBranch size={13} />} disabled={replaying} onClick={() => wb.exec({ type: "SWITCH_BRANCH", name })}>
            Switch to {name}
          </Action>
        )}
        <Action icon={<Sparkles size={13} />} onClick={() => wb.setTrace([...ancestors(state, target)])}>
          Show its history
        </Action>
      </div>
    </div>
  );
}

function HeadView({ goObject }: { goObject: (o: string) => void }) {
  const { state } = useRepository();
  const branch = currentBranch(state);
  const head = headCommitId(state);
  return (
    <div>
      <h2 className="font-mono text-[16px] font-semibold">HEAD</h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
        HEAD tells Git what you have checked out. Usually it names a branch, and that branch names a commit.
      </p>
      <dl className="mt-4 space-y-3">
        <Field label="Refers to">{branch ? <span className="font-mono">refs/heads/{branch}</span> : "A commit directly (detached)"}</Field>
        {head && (
          <Field label="Resolves to commit">
            <ObjLink oid={head} onClick={() => goObject(head)} />
          </Field>
        )}
      </dl>
    </div>
  );
}

