"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileCode2,
  Folder,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  Search,
  Terminal,
  Users,
} from "lucide-react";
import type { ParsedGitRepo } from "@/features/upload/git-reader";

function timeAgo(ms: number): string {
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffDay / 365)}y ago`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function CommitHistoryView({ repo }: { repo: ParsedGitRepo }) {
  const [selectedOid, setSelectedOid] = useState<string>(() => repo.commits[0]?.oid || "");
  const [query, setQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [inspectorTab, setInspectorTab] = useState<"overview" | "message" | "tree">("overview");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const branchList = useMemo(() => Object.keys(repo.branches), [repo.branches]);

  const filteredCommits = useMemo(() => {
    return repo.commits.filter((c) => {
      if (selectedBranch !== "all" && !c.branches.includes(selectedBranch)) {
        return false;
      }
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        c.message.toLowerCase().includes(q) ||
        c.oid.toLowerCase().includes(q) ||
        c.author.name.toLowerCase().includes(q) ||
        c.author.email.toLowerCase().includes(q)
      );
    });
  }, [repo.commits, selectedBranch, query]);

  const selectedCommit = useMemo(() => {
    return repo.commits.find((c) => c.oid === selectedOid) || filteredCommits[0] || repo.commits[0];
  }, [repo.commits, selectedOid, filteredCommits]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1800);
  };

  return (
    <div className="space-y-5">
      {/* 1. Repository KPI Dashboard */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Active Branch */}
        <div className="hud relative overflow-hidden p-4">
          <span
            aria-hidden="true"
            className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[var(--violet)]/10 blur-xl"
          />
          <div className="flex items-center gap-2 text-[var(--ink-3)]">
            <GitBranch size={15} className="text-[var(--violet)]" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Active Branch</span>
          </div>
          <p className="mt-2 truncate font-mono text-[16px] font-semibold text-[var(--ink)]">
            {repo.headBranch}
          </p>
          <p className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">
            {branchList.length} local branch{branchList.length === 1 ? "" : "es"}
          </p>
        </div>

        {/* Card 2: Total Commits */}
        <div className="hud relative overflow-hidden p-4">
          <span
            aria-hidden="true"
            className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[var(--cyan)]/10 blur-xl"
          />
          <div className="flex items-center gap-2 text-[var(--ink-3)]">
            <GitCommitHorizontal size={15} className="text-[var(--cyan)]" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Total Commits</span>
          </div>
          <p className="mt-2 font-mono text-[18px] font-semibold text-[var(--ink)]">
            {repo.totalCommits}
          </p>
          <p className="mt-1 text-[11px] text-[var(--ink-3)]">
            {filteredCommits.length} matching filter
          </p>
        </div>

        {/* Card 3: Contributors */}
        <div className="hud relative overflow-hidden p-4">
          <span
            aria-hidden="true"
            className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[var(--magenta)]/10 blur-xl"
          />
          <div className="flex items-center gap-2 text-[var(--ink-3)]">
            <Users size={15} className="text-[var(--magenta)]" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Contributors</span>
          </div>
          <p className="mt-2 font-mono text-[18px] font-semibold text-[var(--ink)]">
            {repo.contributors.length}
          </p>
          <p className="mt-1 truncate text-[11px] text-[var(--ink-3)]">
            Top: {repo.contributors[0]?.name || "Unknown"}
          </p>
        </div>

        {/* Card 4: Timeline Span */}
        <div className="hud relative overflow-hidden p-4">
          <span
            aria-hidden="true"
            className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[var(--amber)]/10 blur-xl"
          />
          <div className="flex items-center gap-2 text-[var(--ink-3)]">
            <Calendar size={15} className="text-[var(--amber)]" />
            <span className="font-mono text-[11px] uppercase tracking-wider">History Span</span>
          </div>
          <p className="mt-2 truncate font-mono text-[14px] font-medium text-[var(--ink)]">
            {repo.timeSpan ? formatDate(repo.timeSpan.first) : "Recent"}
          </p>
          <p className="mt-1 truncate font-mono text-[11px] text-[var(--ink-3)]">
            to {repo.timeSpan ? formatDate(repo.timeSpan.latest) : "Now"}
          </p>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="hud flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-surface px-3 py-1.5">
            <GitBranch size={13} className="text-[var(--violet)]" />
            <span className="text-[12px] text-[var(--ink-3)]">Branch:</span>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-transparent font-mono text-[12px] font-medium text-[var(--ink)] outline-none"
            >
              <option value="all" className="bg-[var(--surface)] text-[var(--ink)]">
                All Branches ({branchList.length})
              </option>
              {branchList.map((b) => (
                <option key={b} value={b} className="bg-[var(--surface)] text-[var(--ink)]">
                  {b}
                </option>
              ))}
            </select>
          </div>

          <span className="font-mono text-[12px] text-[var(--ink-3)]">
            Showing <strong className="text-[var(--ink)]">{filteredCommits.length}</strong> of {repo.totalCommits}
          </span>
        </div>

        {/* Search Field */}
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commits, authors, SHAs..."
            className="w-full rounded-xl border border-[var(--line)] bg-surface py-1.5 pl-8 pr-3 text-[12.5px] text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none transition-colors focus:border-[var(--violet)]"
          />
        </div>
      </div>

      {/* 3. Main Split View: Commit Timeline on Left, Rich Inspector on Right */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Commit Timeline */}
        <div className="hud overflow-hidden p-0 lg:col-span-7 xl:col-span-7">
          <div className="flex items-center justify-between border-b border-[var(--line-2)] px-4 py-3">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--ink)]">
              <GitCommitHorizontal size={16} className="text-[var(--violet)]" />
              Commit Timeline
            </h3>
            <span className="font-mono text-[11px] text-[var(--ink-3)]">
              click a commit to inspect
            </span>
          </div>

          <div className="max-h-[680px] divide-y divide-[var(--line)] overflow-y-auto">
            {filteredCommits.length === 0 ? (
              <div className="py-16 text-center">
                <GitCommitHorizontal size={28} className="mx-auto text-[var(--ink-3)] opacity-40" />
                <p className="mt-3 text-[13px] text-[var(--ink-3)]">No commits match your filter.</p>
              </div>
            ) : (
              <ol className="relative m-0 list-none p-0">
                {filteredCommits.map((c, i) => {
                  const isSelected = c.oid === selectedCommit?.oid;
                  return (
                    <li
                      key={c.oid}
                      onClick={() => setSelectedOid(c.oid)}
                      className={`group relative flex cursor-pointer items-start gap-3.5 px-4 py-3.5 transition-all ${
                        isSelected
                          ? "bg-[var(--violet-wash)]/60 text-[var(--ink)] ring-1 ring-inset ring-[var(--violet)]/30"
                          : "hover:bg-white/[0.03]"
                      }`}
                    >
                      {/* Visual DAG Rail */}
                      <div className="relative flex flex-col items-center pt-0.5">
                        <span
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-transform duration-200 group-hover:scale-110 ${
                            c.isHead
                              ? "border-[var(--amber)] bg-[var(--amber)]/20 text-[var(--amber)] shadow-[0_0_12px_rgba(255,193,92,0.3)]"
                              : isSelected
                              ? "border-[var(--violet)] bg-[var(--violet)] text-white shadow-[0_0_12px_rgba(109,74,232,0.4)]"
                              : "border-[var(--line-2)] bg-surface text-[var(--ink-3)]"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              c.isHead ? "bg-[var(--amber)]" : isSelected ? "bg-white" : "bg-[var(--violet)]"
                            }`}
                          />
                        </span>
                        {i < filteredCommits.length - 1 && (
                          <span className="mt-1 w-px flex-1 bg-[var(--line)]" />
                        )}
                      </div>

                      {/* Commit Row Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="truncate text-[13.5px] font-medium leading-snug text-[var(--ink)]">
                            {c.summary}
                          </span>
                          {c.branches.map((b) => (
                            <span
                              key={b}
                              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                b === repo.headBranch
                                  ? "border border-[var(--amber)]/40 bg-[var(--amber)]/15 text-[var(--amber)]"
                                  : "border border-[var(--violet)]/40 bg-[var(--violet)]/15 text-[var(--violet-ink)]"
                              }`}
                            >
                              {b}
                            </span>
                          ))}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--ink-3)]">
                          <span className="flex items-center gap-1">
                            <span className="grid h-4 w-4 place-items-center rounded-full bg-[var(--line-2)] font-mono text-[8px] font-bold text-[var(--ink)]">
                              {getInitials(c.author.name)}
                            </span>
                            <span className="truncate max-w-[120px]">{c.author.name}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> {timeAgo(c.author.timestamp)}
                          </span>
                          <span className="rounded border border-[var(--line)] bg-surface px-1.5 py-0.2 text-[10.5px]">
                            {c.shortOid}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>

        {/* Right: 3-Tab Selected Commit Inspector */}
        <div className="hud flex flex-col justify-between p-5 lg:col-span-5 xl:col-span-5">
          {selectedCommit ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="border-b border-[var(--line-2)] pb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-3)]">
                    Commit Inspector
                  </span>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedCommit.oid)}
                    className="flex items-center gap-1 rounded-md border border-[var(--line)] bg-surface px-2 py-1 text-[11px] font-mono text-[var(--ink-2)] transition-colors hover:border-[var(--line-2)] hover:text-[var(--ink)]"
                  >
                    {copiedText === selectedCommit.oid ? (
                      <>
                        <Check size={12} className="text-[#3DE0A6]" /> Copied SHA
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> {selectedCommit.shortOid}
                      </>
                    )}
                  </button>
                </div>

                <h4 className="mt-2.5 text-[15px] font-semibold leading-snug text-[var(--ink)]">
                  {selectedCommit.summary}
                </h4>

                {/* Tab Switcher inside Inspector */}
                <div className="mt-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInspectorTab("overview")}
                    className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                      inspectorTab === "overview"
                        ? "bg-[var(--violet)] text-white"
                        : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab("message")}
                    className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                      inspectorTab === "message"
                        ? "bg-[var(--violet)] text-white"
                        : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                    }`}
                  >
                    Message
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab("tree")}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                      inspectorTab === "tree"
                        ? "bg-[var(--violet)] text-white"
                        : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                    }`}
                  >
                    Snapshot Tree
                    {selectedCommit.treeEntries && (
                      <span className="rounded-full bg-white/20 px-1 font-mono text-[10px]">
                        {selectedCommit.treeEntries.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Tab 1: Overview */}
              {inspectorTab === "overview" && (
                <div className="space-y-2.5 text-[12.5px]">
                  <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] pb-2">
                    <span className="font-mono text-[var(--ink-3)]">Full SHA-1</span>
                    <span className="font-mono text-[11px] text-[var(--ink)] break-all text-right select-all">
                      {selectedCommit.oid}
                    </span>
                  </div>

                  {selectedCommit.tree && (
                    <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] pb-2">
                      <span className="font-mono text-[var(--ink-3)]">Root Tree</span>
                      <button
                        type="button"
                        onClick={() => setInspectorTab("tree")}
                        className="font-mono text-[11px] text-[color:var(--c-tree)] break-all text-right hover:underline"
                      >
                        {selectedCommit.tree}
                      </button>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] pb-2">
                    <span className="font-mono text-[var(--ink-3)]">Author</span>
                    <div className="text-right">
                      <span className="font-medium text-[var(--ink)]">{selectedCommit.author.name}</span>
                      <span className="block font-mono text-[11px] text-[var(--ink-3)]">
                        {selectedCommit.author.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
                    <span className="font-mono text-[var(--ink-3)]">Authored Date</span>
                    <span className="text-right text-[var(--ink-2)]">
                      {new Date(selectedCommit.author.timestamp).toLocaleString()}
                    </span>
                  </div>

                  {selectedCommit.parents.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="font-mono text-[var(--ink-3)]">
                        Parent Commit{selectedCommit.parents.length === 1 ? "" : "s"} ({selectedCommit.parents.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedCommit.parents.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setSelectedOid(p)}
                            className="flex items-center gap-1 rounded-md border border-[var(--line)] bg-surface px-2 py-0.5 font-mono text-[11px] text-[var(--violet-ink)] transition-colors hover:border-[var(--violet)]"
                          >
                            <GitFork size={11} /> {p.slice(0, 7)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Commit Message */}
              {inspectorTab === "message" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[var(--line)] bg-surface/60 p-3.5 font-mono text-[12px] leading-relaxed text-[var(--ink-2)] whitespace-pre-wrap select-text">
                    {selectedCommit.message}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedCommit.message)}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-surface px-3 py-1.5 text-[11.5px] text-[var(--ink-2)] transition-colors hover:border-[var(--line-2)] hover:text-[var(--ink)]"
                  >
                    <Copy size={13} />
                    {copiedText === selectedCommit.message ? "Copied!" : "Copy commit message"}
                  </button>
                </div>
              )}

              {/* Tab 3: Tree Snapshot Files */}
              {inspectorTab === "tree" && (
                <div className="space-y-2">
                  <p className="font-mono text-[11px] text-[var(--ink-3)]">
                    Root directory entries recorded in tree{" "}
                    <code className="text-[color:var(--c-tree)]">{selectedCommit.tree?.slice(0, 7)}</code>:
                  </p>
                  {selectedCommit.treeEntries && selectedCommit.treeEntries.length > 0 ? (
                    <div className="max-h-[300px] divide-y divide-[var(--line)] overflow-y-auto rounded-xl border border-[var(--line)] bg-surface/50">
                      {selectedCommit.treeEntries.map((e) => (
                        <div
                          key={e.name}
                          className="flex items-center justify-between gap-2 px-3 py-2 text-[12px]"
                        >
                          <span className="flex items-center gap-2 font-mono text-[var(--ink)]">
                            {e.isDir ? (
                              <Folder size={14} className="text-[var(--amber)]" />
                            ) : (
                              <FileCode2 size={14} className="text-[var(--cyan)]" />
                            )}
                            <span className="truncate">{e.name}</span>
                          </span>
                          <span className="font-mono text-[10.5px] text-[var(--ink-3)]">
                            {e.oid.slice(0, 7)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-[var(--line)] bg-surface/40 p-4 text-center text-[12px] text-[var(--ink-3)]">
                      Tree object for this commit is packed or not in loose format.
                    </p>
                  )}
                </div>
              )}

              {/* Quick Terminal Command & Lab Actions */}
              <div className="border-t border-[var(--line-2)] pt-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-surface/70 px-3 py-2 font-mono text-[11px] text-[var(--ink-2)]">
                  <span className="flex items-center gap-1.5 truncate">
                    <Terminal size={13} className="text-[var(--violet)] shrink-0" />
                    <span>git checkout {selectedCommit.shortOid}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`git checkout ${selectedCommit.oid}`)}
                    className="shrink-0 text-[var(--ink-3)] hover:text-[var(--ink)]"
                  >
                    {copiedText === `git checkout ${selectedCommit.oid}` ? (
                      <Check size={13} className="text-[#3DE0A6]" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>

                <Link
                  href="/lab"
                  className="btn btn-ghost btn-sm flex w-full items-center justify-center gap-2"
                >
                  <ExternalLink size={13} /> Open Visual Lab
                </Link>
              </div>
            </div>
          ) : (
            <p className="text-center text-[12.5px] text-[var(--ink-3)]">Select a commit to inspect.</p>
          )}
        </div>
      </div>
    </div>
  );
}
