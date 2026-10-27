"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  Search,
  User,
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

export function CommitHistoryView({ repo }: { repo: ParsedGitRepo }) {
  const [selectedOid, setSelectedOid] = useState<string>(() => repo.commits[0]?.oid || "");
  const [query, setQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [copiedOid, setCopiedOid] = useState<string | null>(null);

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
    setCopiedOid(text);
    setTimeout(() => setCopiedOid(null), 1800);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Info Bar */}
      <div className="hud flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-surface px-2.5 py-1 font-mono text-[12px] text-[var(--ink)]">
            <GitBranch size={13} className="text-[var(--violet)]" />
            <span className="text-[var(--ink-3)]">Branch:</span>
            <span className="font-semibold text-[var(--violet-ink)]">{repo.headBranch}</span>
          </span>

          {branchList.length > 1 && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="rounded-lg border border-[var(--line)] bg-surface px-2.5 py-1 text-[12px] text-[var(--ink)] outline-none transition-colors hover:border-[var(--line-2)] focus:border-[var(--violet)]"
            >
              <option value="all">All Branches ({branchList.length})</option>
              {branchList.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}

          <span className="font-mono text-[12px] text-[var(--ink-3)]">
            {repo.totalCommits} total commit{repo.totalCommits === 1 ? "" : "s"}
          </span>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commits or authors..."
            className="w-full rounded-xl border border-[var(--line)] bg-surface py-1.5 pl-8 pr-3 text-[12.5px] text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none transition-colors focus:border-[var(--violet)]"
          />
        </div>
      </div>

      {/* Main Grid: Commit List on Left, Commit Inspector on Right */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left: Commit Timeline */}
        <div className="hud overflow-hidden p-0 lg:col-span-7 xl:col-span-8">
          <div className="border-b border-[var(--line-2)] px-4 py-3">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--ink)]">
              <GitCommitHorizontal size={16} className="text-[var(--violet)]" />
              Commit Timeline ({filteredCommits.length})
            </h3>
          </div>

          <div className="max-h-[640px] divide-y divide-[var(--line)] overflow-y-auto">
            {filteredCommits.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[13px] text-[var(--ink-3)]">No commits match your filter.</p>
              </div>
            ) : (
              <ol className="relative m-0 list-none p-0">
                {filteredCommits.map((c, i) => {
                  const isSelected = c.oid === selectedCommit?.oid;
                  return (
                    <li
                      key={c.oid}
                      onClick={() => setSelectedOid(c.oid)}
                      className={`group relative flex cursor-pointer items-start gap-3.5 px-4 py-3.5 transition-colors ${
                        isSelected
                          ? "bg-[var(--violet-wash)]/60 text-[var(--ink)]"
                          : "hover:bg-white/[0.03]"
                      }`}
                    >
                      {/* Visual DAG Node & Rail Line */}
                      <div className="relative flex flex-col items-center">
                        <span
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-transform group-hover:scale-110 ${
                            c.isHead
                              ? "border-[var(--amber)] bg-[var(--amber)]/20 text-[var(--amber)]"
                              : isSelected
                              ? "border-[var(--violet)] bg-[var(--violet)] text-white"
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

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[13px] font-medium text-[var(--ink)]">
                            {c.summary}
                          </span>
                          {c.branches.map((b) => (
                            <span
                              key={b}
                              className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                b === repo.headBranch
                                  ? "bg-[var(--amber)]/15 text-[var(--amber)] border border-[var(--amber)]/30"
                                  : "bg-[var(--violet)]/15 text-[var(--violet-ink)] border border-[var(--violet)]/30"
                              }`}
                            >
                              {b}
                            </span>
                          ))}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-[var(--ink-3)]">
                          <span className="flex items-center gap-1">
                            <User size={11} /> {c.author.name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} /> {timeAgo(c.author.timestamp)}
                          </span>
                          <span className="rounded bg-surface px-1.5 py-0.2 border border-[var(--line)] text-[10.5px]">
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

        {/* Right: Selected Commit Inspector */}
        <div className="hud flex flex-col justify-between p-5 lg:col-span-5 xl:col-span-4">
          {selectedCommit ? (
            <div className="space-y-4">
              <div className="border-b border-[var(--line-2)] pb-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-3)]">
                    Commit Details
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedCommit.oid)}
                    className="flex items-center gap-1 rounded-md border border-[var(--line)] bg-surface px-2 py-1 text-[11px] font-mono text-[var(--ink-2)] transition-colors hover:border-[var(--line-2)] hover:text-[var(--ink)]"
                  >
                    {copiedOid === selectedCommit.oid ? (
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

                <h4 className="mt-2 text-[14px] font-semibold leading-snug text-[var(--ink)]">
                  {selectedCommit.summary}
                </h4>
              </div>

              {/* Multiline Message if present */}
              {selectedCommit.message.includes("\n") && (
                <div className="rounded-xl border border-[var(--line)] bg-surface/50 p-3 font-mono text-[12px] leading-relaxed text-[var(--ink-2)] whitespace-pre-wrap">
                  {selectedCommit.message}
                </div>
              )}

              {/* Metadata Key-Value Grid */}
              <div className="space-y-2 text-[12px]">
                <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] pb-2">
                  <span className="font-mono text-[var(--ink-3)]">Full SHA</span>
                  <span className="font-mono text-[11px] text-[var(--ink)] break-all text-right">
                    {selectedCommit.oid}
                  </span>
                </div>

                {selectedCommit.tree && (
                  <div className="flex items-start justify-between gap-2 border-b border-[var(--line)] pb-2">
                    <span className="font-mono text-[var(--ink-3)]">Tree</span>
                    <span className="font-mono text-[11px] text-[color:var(--c-tree)] break-all text-right">
                      {selectedCommit.tree}
                    </span>
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
                  <span className="font-mono text-[var(--ink-3)]">Date</span>
                  <span className="text-right text-[var(--ink-2)]">
                    {new Date(selectedCommit.author.timestamp).toLocaleString()}
                  </span>
                </div>

                {selectedCommit.parents.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="font-mono text-[var(--ink-3)]">
                      Parent Commit{selectedCommit.parents.length === 1 ? "" : "s"}:
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

              {/* Exploration Shortcuts */}
              <div className="pt-2">
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
