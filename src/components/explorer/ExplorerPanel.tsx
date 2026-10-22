"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FilePlus2, FileText, Folder, GitBranch, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { useRepository } from "@/features/repository/RepositoryProvider";
import { currentBranch, fileStatuses, getCommit, headCommitId, reachableCommits } from "@/features/repository/engine";
import type { FileStatus } from "@/features/repository/types";
import { useWorkbench, type ExplorerTab } from "@/components/workbench/WorkbenchContext";
import { ConfirmDialog, Glyph, IconButton, StatusLetter } from "@/components/workbench/bits";
import { short } from "@/lib/git";

const tabs: { id: ExplorerTab; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "objects", label: "Objects" },
  { id: "refs", label: "Refs" },
];

export function ExplorerPanel() {
  const wb = useWorkbench();
  return (
    <section aria-label="Explorer" className="flex h-full min-h-0 flex-col bg-paper">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-line px-2" role="tablist" aria-label="Explorer sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={wb.explorerTab === t.id}
            onClick={() => wb.setExplorerTab(t.id)}
            className="h-8 flex-1 rounded-lg text-[12.5px] text-ink-3 transition-colors hover:text-ink aria-selected:bg-surface aria-selected:font-medium aria-selected:text-ink aria-selected:shadow-[0_0_0_1px_var(--line)]"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {wb.explorerTab === "files" && <FileTree />}
        {wb.explorerTab === "objects" && <ObjectList />}
        {wb.explorerTab === "refs" && <RefList />}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

type Dir = { name: string; path: string; dirs: Dir[]; files: FileStatus[] };

function buildDirs(statuses: FileStatus[]): Dir {
  const root: Dir = { name: "", path: "", dirs: [], files: [] };
  for (const s of statuses) {
    const parts = s.path.split("/");
    let d = root;
    parts.slice(0, -1).forEach((p, i) => {
      const path = parts.slice(0, i + 1).join("/");
      let next = d.dirs.find((x) => x.name === p);
      if (!next) d.dirs.push((next = { name: p, path, dirs: [], files: [] }));
      d = next;
    });
    d.files.push(s);
  }
  const sort = (d: Dir) => {
    d.dirs.sort((a, b) => a.name.localeCompare(b.name));
    d.files.sort((a, b) => a.path.localeCompare(b.path));
    d.dirs.forEach(sort);
  };
  sort(root);
  return root;
}

function FileTree() {
  const { state, replaying } = useRepository();
  const wb = useWorkbench();
  const statuses = useMemo(() => fileStatuses(state), [state]);
  const tree = useMemo(() => buildDirs(statuses), [statuses]);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [deleting, setDeleting] = useState<FileStatus | null>(null);
  const changed = statuses.filter((s) => s.unstaged);

  const row = "flex h-8 w-full items-center gap-2 rounded-lg pr-1 text-left text-[13px] transition-colors hover:bg-surface";

  const renderDir = (d: Dir, depth: number): React.ReactNode => (
    <>
      {d.dirs.map((sub) => {
        const isClosed = closed.has(sub.path);
        return (
          <li key={sub.path}>
            <button
              type="button"
              aria-expanded={!isClosed}
              onClick={() =>
                setClosed((c) => {
                  const n = new Set(c);
                  if (n.has(sub.path)) n.delete(sub.path);
                  else n.add(sub.path);
                  return n;
                })
              }
              className={row}
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              {isClosed ? <ChevronRight size={13} className="text-ink-3" /> : <ChevronDown size={13} className="text-ink-3" />}
              <Folder size={14} className="text-violet" />
              <span className="truncate">{sub.name}</span>
            </button>
            {!isClosed && <ul>{renderDir(sub, depth + 1)}</ul>}
          </li>
        );
      })}
      {d.files.map((f) => {
        const name = f.path.split("/").pop()!;
        const gone = !(f.path in state.worktree);
        if (renaming === f.path)
          return (
            <li key={f.path} style={{ paddingLeft: 8 + depth * 14 }} className="py-1 pr-1">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (wb.exec({ type: "RENAME_FILE", from: f.path, to: renameTo })) setRenaming(null);
                }}
              >
                <label className="sr-only" htmlFor="rename-input">
                  New path for {f.path}
                </label>
                <input
                  id="rename-input"
                  autoFocus
                  value={renameTo}
                  onChange={(e) => setRenameTo(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
                  onBlur={() => setRenaming(null)}
                  className="h-8 w-full rounded-lg border border-violet bg-surface px-2 font-mono text-[12px] outline-none"
                />
              </form>
            </li>
          );
        return (
          <li key={f.path} className="group relative">
            <button
              type="button"
              onClick={() => wb.open(f.path)}
              aria-current={wb.openFile === f.path ? "page" : undefined}
              className={`${row} aria-[current=page]:bg-violet-wash`}
              style={{ paddingLeft: 8 + depth * 14 + 17 }}
            >
              <FileText size={14} className="shrink-0 text-ink-3" />
              <span className={`min-w-0 flex-1 truncate ${gone ? "text-ink-3 line-through" : ""}`}>{name}</span>
              <span className="flex gap-0.5 group-focus-within:hidden group-hover:hidden">
                {f.staged && <StatusLetter kind={f.staged} staged />}
                {f.unstaged && <StatusLetter kind={f.unstaged} />}
              </span>
            </button>
            {!gone && !replaying && (
              <span className="absolute right-1 top-1/2 hidden -translate-y-1/2 gap-0.5 group-focus-within:flex group-hover:flex">
                <button
                  type="button"
                  aria-label={`Rename ${f.path}`}
                  title="Rename"
                  onClick={() => {
                    setRenaming(f.path);
                    setRenameTo(f.path);
                  }}
                  className="grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-violet-wash hover:text-violet-ink"
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${f.path}`}
                  title="Delete"
                  onClick={() => setDeleting(f)}
                  className="grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-del-bg hover:text-del"
                >
                  <Trash2 size={12} />
                </button>
              </span>
            )}
          </li>
        );
      })}
    </>
  );

  return (
    <div className="p-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[11.5px] text-ink-3">{state.name}</span>
        <div className="flex">
          <IconButton label="New file" onClick={() => setCreating(true)} disabled={replaying}>
            <FilePlus2 size={15} />
          </IconButton>
          <IconButton
            label={`Stage all changes (${changed.length})`}
            onClick={() => wb.exec({ type: "STAGE_PATHS", paths: changed.map((c) => c.path) }) && wb.showBottom("changes")}
            disabled={replaying || !changed.length}
          >
            <PlusCircle size={15} />
          </IconButton>
        </div>
      </div>
      {creating && (
        <form
          className="mb-2 px-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (wb.exec({ type: "CREATE_FILE", path: newPath, content: "" })) {
              wb.open(newPath.trim());
              setCreating(false);
              setNewPath("");
            }
          }}
        >
          <label htmlFor="new-file" className="mb-1 block text-[11.5px] text-ink-3">
            Path for the new file
          </label>
          <input
            id="new-file"
            autoFocus
            value={newPath}
            placeholder="src/notes.txt"
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
            className="h-8 w-full rounded-lg border border-violet bg-surface px-2 font-mono text-[12px] outline-none"
          />
        </form>
      )}
      <ul aria-label="Working tree">{renderDir(tree, 0)}</ul>
      <p className="mt-4 px-2 text-[11.5px] leading-relaxed text-ink-3">
        <StatusLetter kind="modified" /> changed, <StatusLetter kind="untracked" /> untracked, <StatusLetter kind="deleted" /> deleted. A
        green background means the change is staged.
      </p>

      <ConfirmDialog
        open={!!deleting}
        title={`Delete ${deleting?.path}?`}
        confirmLabel="Delete file"
        onConfirm={() => deleting && wb.exec({ type: "DELETE_FILE", path: deleting.path })}
        onClose={() => setDeleting(null)}
      >
        {deleting && (deleting.unstaged === "untracked" || deleting.unstaged === "added")
          ? "Git has never committed this file, so its contents can't be recovered after deleting it. Undo still works."
          : "The file leaves the working tree. Git still has its last staged version, so you can restore it until you commit the deletion."}
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Objects                                                             */
/* ------------------------------------------------------------------ */

function ObjectList() {
  const { state } = useRepository();
  const wb = useWorkbench();
  const [q, setQ] = useState("");
  const objects = Object.values(state.objects);
  const reachable = useMemo(() => reachableCommits(state).reverse(), [state]);

  // Paths that name each blob somewhere in reachable history (latest name wins).
  const names = useMemo(() => {
    const m = new Map<string, Set<string>>();
    const walk = (treeOid: string, prefix: string) => {
      const t = state.objects[treeOid];
      if (t?.type !== "tree") return;
      for (const e of t.entries) {
        const p = prefix + e.name;
        if (e.type === "tree") walk(e.oid, p + "/");
        else (m.get(e.oid) ?? m.set(e.oid, new Set()).get(e.oid)!).add(p);
      }
    };
    reachable.forEach((c) => walk(c.tree, ""));
    return m;
  }, [state.objects, reachable]);

  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  const groups = [
    {
      kind: "commit" as const,
      title: "Commits",
      items: reachable.filter((c) => match(c.oid + c.message)).map((c) => ({ oid: c.oid, text: c.message })),
    },
    {
      kind: "tree" as const,
      title: "Trees",
      items: objects
        .filter((o) => o.type === "tree" && match(o.oid))
        .map((o) => ({ oid: o.oid, text: o.type === "tree" ? `${o.entries.length} entr${o.entries.length === 1 ? "y" : "ies"}` : "" })),
    },
    {
      kind: "blob" as const,
      title: "Blobs",
      items: objects
        .filter((o) => o.type === "blob" && match(o.oid + [...(names.get(o.oid) ?? [])].join(" ")))
        .map((o) => {
          const n = [...(names.get(o.oid) ?? [])];
          return { oid: o.oid, text: n.length ? n.join(", ") : "Staged only, not in a commit yet" };
        }),
    },
  ];
  const sel = wb.selection?.kind === "object" ? wb.selection.oid : null;

  return (
    <div className="p-2">
      <label htmlFor="obj-search" className="sr-only">
        Search objects
      </label>
      <input
        id="obj-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by ID, message or path"
        className="mb-2 h-8 w-full rounded-lg border border-line-2 bg-surface px-2.5 text-[12px] outline-none focus:border-violet"
      />
      <p className="mb-3 px-1 text-[11.5px] leading-relaxed text-ink-3">
        {objects.length} objects stored. Identical content is stored once, so there are fewer blobs than file versions.
      </p>
      {groups.map((g) => (
        <div key={g.kind} className="mb-3">
          <h3 className="flex items-center gap-2 px-1 py-1 text-[11.5px] font-semibold text-ink-2">
            <Glyph kind={g.kind} size={10} /> {g.title}
            <span className="font-normal text-ink-3">{g.items.length}</span>
          </h3>
          <ul>
            {g.items.map((it) => (
              <li key={it.oid}>
                <button
                  type="button"
                  onClick={() => {
                    wb.select({ kind: "object", oid: it.oid });
                    if (g.kind !== "commit" && wb.view === "history") wb.setView("objects");
                  }}
                  aria-pressed={sel === it.oid}
                  className="flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface aria-pressed:bg-violet-wash"
                >
                  <span className="font-mono text-[11.5px] text-ink">{short(it.oid)}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">{it.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Refs                                                                */
/* ------------------------------------------------------------------ */

function RefList() {
  const { state, replaying } = useRepository();
  const wb = useWorkbench();
  const [name, setName] = useState("");
  const cur = currentBranch(state);
  const head = headCommitId(state);
  const at = wb.selection?.kind === "object" && state.objects[wb.selection.oid]?.type === "commit" ? wb.selection.oid : head;
  const atCommit = getCommit(state, at);

  return (
    <div className="p-2">
      <button
        type="button"
        onClick={() => wb.select({ kind: "head" })}
        className="mb-3 w-full rounded-xl border border-line bg-surface p-3 text-left hover:border-violet"
      >
        <span className="flex items-center gap-2 text-[12.5px] font-medium">
          <Glyph kind="head" size={12} filled={false} /> HEAD
        </span>
        <span className="mt-1 block text-[12px] text-ink-3">
          {cur ? (
            <>
              Points at the branch <span className="font-mono text-ink">{cur}</span>, so new commits move that branch.
            </>
          ) : (
            <>Detached at {head && short(head)}.</>
          )}
        </span>
      </button>

      <h3 className="px-1 py-1 text-[11.5px] font-semibold text-ink-2">Branches</h3>
      <ul>
        {Object.entries(state.branches)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([b, target]) => (
            <li key={b} className="group flex items-center gap-1 rounded-lg hover:bg-surface">
              <button
                type="button"
                onClick={() => wb.select({ kind: "branch", name: b })}
                aria-pressed={wb.selection?.kind === "branch" && wb.selection.name === b}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left aria-pressed:bg-violet-wash"
              >
                <GitBranch size={13} className="shrink-0 text-[color:var(--c-ref)]" />
                <span className="truncate font-mono text-[12px]">{b}</span>
                {b === cur && <span className="rounded-full bg-ink px-1.5 text-[10px] text-paper">current</span>}
                <span className="ml-auto font-mono text-[11px] text-ink-3">{short(target)}</span>
              </button>
              {b !== cur && (
                <button
                  type="button"
                  disabled={replaying}
                  onClick={() => wb.exec({ type: "SWITCH_BRANCH", name: b })}
                  className="mr-1 h-6 rounded-md border border-line-2 px-2 text-[11px] text-ink-2 hover:border-violet hover:text-violet-ink disabled:opacity-40"
                >
                  Switch
                </button>
              )}
            </li>
          ))}
      </ul>

      <form
        className="mt-4 rounded-xl border border-dashed border-line-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (at && wb.exec({ type: "CREATE_BRANCH", name, at })) setName("");
        }}
      >
        <label htmlFor="branch-name" className="block text-[12px] font-medium">
          New branch
        </label>
        <p className="mt-0.5 text-[11.5px] text-ink-3">
          Starts at {atCommit ? <span className="font-mono">{short(atCommit.oid)}</span> : "HEAD"}
          {atCommit && <> ({atCommit.message})</>}. Select another commit to start elsewhere.
        </p>
        <div className="mt-2 flex gap-1.5">
          <input
            id="branch-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="experiment"
            className="h-8 min-w-0 flex-1 rounded-lg border border-line-2 bg-surface px-2 font-mono text-[12px] outline-none focus:border-violet"
          />
          <button type="submit" disabled={replaying || !name.trim()} className="h-8 rounded-lg bg-ink px-3 text-[12px] text-paper disabled:opacity-40">
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
