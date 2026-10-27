"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode2,
  Folder,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  GitFork,
  GitMerge,
  Layers,
  Radio,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Users,
} from "lucide-react";
import { flattenTree, type GitCommit, type ParsedGitRepo } from "@/features/upload/git-reader";
import type { AnalysisResult } from "@/features/impact-analysis/types";
import { DiffLines } from "@/components/diff/DiffLines";

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

/** 5-block GitHub-style diff stat meter */
function DiffStatBlocks({ additions = 0, deletions = 0 }: { additions?: number; deletions?: number }) {
  const total = additions + deletions;
  if (total === 0) {
    return (
      <div className="flex items-center gap-0.5" title="0 lines modified">
        {[...Array(5)].map((_, i) => (
          <span key={i} className="h-2 w-1.5 rounded-[1px] bg-white/10" />
        ))}
      </div>
    );
  }
  const green = Math.min(5, Math.max(additions > 0 ? 1 : 0, Math.round((additions / total) * 5)));
  const remaining = 5 - green;
  const red = Math.min(remaining, Math.max(deletions > 0 ? 1 : 0, Math.round((deletions / total) * 5)));
  const neutral = Math.max(0, 5 - green - red);

  return (
    <div className="flex items-center gap-0.5" title={`+${additions} / -${deletions} lines changed`}>
      {[...Array(green)].map((_, i) => (
        <span key={`g-${i}`} className="h-2 w-1.5 rounded-[1px] bg-[#3DE0A6]" />
      ))}
      {[...Array(red)].map((_, i) => (
        <span key={`r-${i}`} className="h-2 w-1.5 rounded-[1px] bg-[#FF6B6B]" />
      ))}
      {[...Array(neutral)].map((_, i) => (
        <span key={`n-${i}`} className="h-2 w-1.5 rounded-[1px] bg-white/15" />
      ))}
    </div>
  );
}

// Multi-lane DAG layout constants
const LANE_COLORS = [
  "#8B5CF6", // Violet (main / default)
  "#06B6D4", // Cyan
  "#F59E0B", // Amber
  "#EC4899", // Magenta
  "#10B981", // Emerald
  "#6366F1", // Indigo
  "#3B82F6", // Blue
];

const ROW_HEIGHT = 68;
const LANE_WIDTH = 18;
const OFFSET_X = 16;

interface DagNode {
  commit: GitCommit;
  index: number;
  lane: number;
  x: number;
  y: number;
  color: string;
}

interface DagConnection {
  fromLane: number;
  fromIndex: number;
  toLane: number;
  toIndex: number;
  color: string;
  isMerge?: boolean;
}

interface FileImpact {
  path: string;
  nodeId?: string;
  dependents: { id: string; path: string; name: string }[];
  symbols: { id: string; name: string }[];
  tests: { id: string; name: string; path: string }[];
}

interface CommitImpactSummary {
  level: "isolated" | "low" | "moderate" | "high" | "critical";
  levelLabel: string;
  levelColor: string;
  badgeBg: string;
  description: string;
  fileImpacts: FileImpact[];
  totalDependentsCount: number;
  totalSymbolsCount: number;
  totalTestsCount: number;
  unshieldedCount: number;
}

interface FileTreeNode {
  name: string;
  path: string;
  isDir: boolean;
  oid: string;
  children?: FileTreeNode[];
}

function buildFileTree(flatEntries: { path: string; oid: string; isDir?: boolean }[]): FileTreeNode[] {
  const root: FileTreeNode = { name: "root", path: "", isDir: true, oid: "", children: [] };

  for (const item of flatEntries) {
    const parts = item.path.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const curPath = parts.slice(0, i + 1).join("/");

      if (!current.children) current.children = [];

      let found = current.children.find((c) => c.name === part);
      if (!found) {
        found = {
          name: part,
          path: curPath,
          isDir: isLast ? (item.isDir ?? false) : true,
          oid: isLast ? item.oid : "",
          children: isLast && !item.isDir ? undefined : [],
        };
        current.children.push(found);
      }
      current = found;
    }
  }

  function sortNodes(nodes: FileTreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children) sortNodes(n.children);
    }
  }

  if (root.children) {
    sortNodes(root.children);
    return root.children;
  }
  return [];
}

function FileTreeItem({
  node,
  depth = 0,
  expandedFolders,
  toggleFolder,
  onSelectBlob,
  inspectedBlobPath,
  blobsByOid,
}: {
  node: FileTreeNode;
  depth?: number;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  onSelectBlob: (name: string, content: string, path: string) => void;
  inspectedBlobPath?: string;
  blobsByOid?: Map<string, string>;
}) {
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = inspectedBlobPath === node.path;
  const blobContent = !node.isDir ? blobsByOid?.get(node.oid) : undefined;

  if (node.isDir) {
    return (
      <div>
        <button
          type="button"
          onClick={() => toggleFolder(node.path)}
          className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-[11.5px] font-mono text-[var(--ink-2)] transition-colors hover:bg-white/[0.04] hover:text-[var(--ink)]"
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
        >
          <span className="flex items-center gap-1.5 truncate">
            {isExpanded ? (
              <ChevronDown size={13} className="text-[var(--ink-3)] shrink-0" />
            ) : (
              <ChevronRight size={13} className="text-[var(--ink-3)] shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen size={14} className="text-[var(--amber)] shrink-0" />
            ) : (
              <Folder size={14} className="text-[var(--amber)] shrink-0" />
            )}
            <span className="truncate font-medium text-[var(--ink)]">{node.name}</span>
          </span>
          {node.children && (
            <span className="rounded-full bg-surface px-1.5 py-0.2 text-[10px] text-[var(--ink-3)]">
              {node.children.length}
            </span>
          )}
        </button>

        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                onSelectBlob={onSelectBlob}
                inspectedBlobPath={inspectedBlobPath}
                blobsByOid={blobsByOid}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        if (blobContent !== undefined) {
          onSelectBlob(node.name, blobContent, node.path);
        }
      }}
      className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11.5px] font-mono transition-colors ${
        isSelected
          ? "bg-[var(--violet-wash)]/80 text-[var(--ink)] ring-1 ring-inset ring-[var(--violet)]/40"
          : blobContent !== undefined
          ? "cursor-pointer hover:bg-white/[0.04] text-[var(--ink-2)] hover:text-[var(--ink)]"
          : "text-[var(--ink-3)]"
      }`}
      style={{ paddingLeft: `${depth * 14 + 18}px` }}
    >
      <span className="flex items-center gap-1.5 truncate">
        <FileCode2
          size={13}
          className={
            isSelected
              ? "text-[var(--violet)] shrink-0"
              : node.name.endsWith(".json") || node.name.endsWith(".md")
              ? "text-[var(--amber)] shrink-0"
              : "text-[var(--cyan)] shrink-0"
          }
        />
        <span className="truncate">{node.name}</span>
      </span>

      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono text-[10px] text-[var(--ink-3)]">
          {node.oid.slice(0, 7)}
        </span>
        {blobContent !== undefined && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectBlob(node.name, blobContent, node.path);
            }}
            className={`rounded p-0.5 transition-colors ${
              isSelected
                ? "bg-[var(--violet)] text-white"
                : "text-[var(--ink-3)] hover:bg-white/10 hover:text-[var(--ink)]"
            }`}
            title={isSelected ? "Close preview" : "Preview file content"}
          >
            {isSelected ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
        )}
      </div>
    </div>
  );
}

export function CommitHistoryView({
  repo,
  architectureResult,
  onSwitchToArchitecture,
}: {
  repo: ParsedGitRepo;
  architectureResult?: AnalysisResult;
  onSwitchToArchitecture?: () => void;
}) {
  const [selectedOid, setSelectedOid] = useState<string>(() => repo.commits[0]?.oid || "");
  const [query, setQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [inspectorTab, setInspectorTab] = useState<"overview" | "message" | "changes" | "tree" | "impact">("overview");
  const [selectedDiffIndex, setSelectedDiffIndex] = useState<number>(0);
  const [diffMode, setDiffMode] = useState<"unified" | "split">("unified");
  const [inspectedBlob, setInspectedBlob] = useState<{ name: string; content: string; path?: string } | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [treeSearchQuery, setTreeSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set());

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
    if (filteredCommits.length === 0) return null;
    const match = filteredCommits.find((c) => c.oid === selectedOid);
    return match || filteredCommits[0];
  }, [filteredCommits, selectedOid]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 1800);
  };

  // Multi-Lane DAG computation
  const dagLayout = useMemo(() => {
    const commits = filteredCommits;
    const commitIndexMap = new Map<string, number>();
    commits.forEach((c, i) => commitIndexMap.set(c.oid, i));

    const activeLanes: (string | null)[] = [];
    const commitLanes: number[] = new Array(commits.length).fill(0);
    const connections: DagConnection[] = [];

    for (let i = 0; i < commits.length; i++) {
      const c = commits[i];

      // Find if this commit is already tracked in a lane
      let lane = activeLanes.indexOf(c.oid);
      if (lane === -1) {
        lane = activeLanes.indexOf(null);
        if (lane === -1) {
          lane = activeLanes.length;
          activeLanes.push(null);
        }
      }

      activeLanes[lane] = null;
      commitLanes[i] = lane;

      if (c.parents.length > 0) {
        // Primary parent continues on this lane
        const p0 = c.parents[0];
        const p0Idx = commitIndexMap.get(p0);
        if (p0Idx !== undefined) {
          let p0Lane = activeLanes.indexOf(p0);
          if (p0Lane === -1) {
            activeLanes[lane] = p0;
            p0Lane = lane;
          }
          connections.push({
            fromLane: lane,
            fromIndex: i,
            toLane: p0Lane,
            toIndex: p0Idx,
            color: LANE_COLORS[lane % LANE_COLORS.length],
          });
        }

        // Secondary parents (merges)
        for (let pIdx = 1; pIdx < c.parents.length; pIdx++) {
          const pOther = c.parents[pIdx];
          const pOtherIdx = commitIndexMap.get(pOther);
          if (pOtherIdx !== undefined) {
            let otherLane = activeLanes.indexOf(pOther);
            if (otherLane === -1) {
              otherLane = activeLanes.indexOf(null);
              if (otherLane === -1) {
                otherLane = activeLanes.length;
                activeLanes.push(null);
              }
              activeLanes[otherLane] = pOther;
            }
            connections.push({
              fromLane: lane,
              fromIndex: i,
              toLane: otherLane,
              toIndex: pOtherIdx,
              color: LANE_COLORS[otherLane % LANE_COLORS.length],
              isMerge: true,
            });
          }
        }
      }
    }

    const maxLane = Math.min(Math.max(...commitLanes, 0), 4);
    const svgWidth = Math.max(44, (maxLane + 1) * LANE_WIDTH + 14);

    const nodes: DagNode[] = commits.map((c, i) => {
      const lane = Math.min(commitLanes[i] ?? 0, 4);
      return {
        commit: c,
        index: i,
        lane,
        x: lane * LANE_WIDTH + OFFSET_X,
        y: i * ROW_HEIGHT + ROW_HEIGHT / 2,
        color: LANE_COLORS[lane % LANE_COLORS.length],
      };
    });

    return { nodes, connections, svgWidth, maxLane };
  }, [filteredCommits]);

  // Blast Radius / Impact Radar computation
  const commitImpact = useMemo<CommitImpactSummary | null>(() => {
    if (!architectureResult || !selectedCommit || !selectedCommit.diffs || selectedCommit.diffs.length === 0) {
      return null;
    }

    const fileImpacts: FileImpact[] = [];
    const allDependentIds = new Set<string>();
    const allSymbolIds = new Set<string>();
    const allTestIds = new Set<string>();

    for (const diff of selectedCommit.diffs) {
      const normDiffPath = diff.path.replace(/^[/\\]+/, "").toLowerCase();

      const matchedFileNode = architectureResult.nodes.find(
        (n) =>
          n.kind === "file" &&
          (n.path.toLowerCase() === normDiffPath ||
            n.path.toLowerCase().endsWith("/" + normDiffPath) ||
            normDiffPath.endsWith("/" + n.path.toLowerCase()))
      );

      if (!matchedFileNode) {
        fileImpacts.push({
          path: diff.path,
          dependents: [],
          symbols: [],
          tests: [],
        });
        continue;
      }

      // Dependents: edges where kind === "imports" and target === matchedFileNode.id
      const dependentNodes = architectureResult.edges
        .filter((e) => e.kind === "imports" && e.target === matchedFileNode.id)
        .map((e) => architectureResult.nodes.find((n) => n.id === e.source))
        .filter((n): n is NonNullable<typeof n> => !!n)
        .map((n) => ({ id: n.id, path: n.path, name: n.name }));

      dependentNodes.forEach((d) => allDependentIds.add(d.id));

      // Symbols owned by this file
      const symbols = architectureResult.nodes
        .filter((n) => n.kind === "symbol" && n.fileId === matchedFileNode.id)
        .map((n) => ({ id: n.id, name: n.name }));

      symbols.forEach((s) => allSymbolIds.add(s.id));

      // Tests targeting this file
      const testNodes = architectureResult.edges
        .filter((e) => e.kind === "tests" && e.target === matchedFileNode.id)
        .map((e) => architectureResult.nodes.find((n) => n.id === e.source))
        .filter((n): n is NonNullable<typeof n> => !!n)
        .map((n) => ({ id: n.id, name: n.name, path: n.path }));

      testNodes.forEach((t) => allTestIds.add(t.id));

      fileImpacts.push({
        path: diff.path,
        nodeId: matchedFileNode.id,
        dependents: dependentNodes,
        symbols,
        tests: testNodes,
      });
    }

    const totalDeps = allDependentIds.size;
    const totalSyms = allSymbolIds.size;
    const totalTests = allTestIds.size;
    const unshielded = fileImpacts.filter((f) => f.dependents.length > 0 && f.tests.length === 0).length;

    let level: CommitImpactSummary["level"] = "low";
    let levelLabel = "Low Impact";
    let levelColor = "#10B981";
    let badgeBg = "rgba(16, 185, 129, 0.15)";
    let description = "Localized changes with minimal downstream dependency footprint.";

    if (totalDeps === 0) {
      level = "isolated";
      levelLabel = "Isolated / Leaf";
      levelColor = "#3DE0A6";
      badgeBg = "rgba(61, 224, 166, 0.15)";
      description = "No downstream modules import this modified code directly. Extremely safe to merge.";
    } else if (totalDeps > 8 || unshielded > 2) {
      level = "critical";
      levelLabel = "Critical Blast Radius";
      levelColor = "#F43F5E";
      badgeBg = "rgba(244, 63, 94, 0.15)";
      description = "Extensive downstream dependencies without complete test coverage. High regression risk.";
    } else if (totalDeps > 4) {
      level = "high";
      levelLabel = "High Impact";
      levelColor = "#F59E0B";
      badgeBg = "rgba(245, 158, 11, 0.15)";
      description = "Heavily utilized component or utility. Affects multiple downstream subsystems.";
    } else if (totalDeps > 1) {
      level = "moderate";
      levelLabel = "Moderate Impact";
      levelColor = "#06B6D4";
      badgeBg = "rgba(6, 182, 212, 0.15)";
      description = "Several components or routes depend on this modified file.";
    }

    return {
      level,
      levelLabel,
      levelColor,
      badgeBg,
      description,
      fileImpacts,
      totalDependentsCount: totalDeps,
      totalSymbolsCount: totalSyms,
      totalTestsCount: totalTests,
      unshieldedCount: unshielded,
    };
  }, [architectureResult, selectedCommit]);

  // Snapshot Tree computation
  const snapshotEntries = useMemo(() => {
    if (!selectedCommit || !selectedCommit.tree) return [];
    if (repo.treesByOid && repo.treesByOid.has(selectedCommit.tree)) {
      const flat = flattenTree(selectedCommit.tree, repo.treesByOid);
      if (flat.size > 0) {
        return Array.from(flat.entries()).map(([p, v]) => ({
          path: p,
          oid: v.oid,
          isDir: false,
        }));
      }
    }
    return (selectedCommit.treeEntries || []).map((e) => ({
      path: e.name,
      oid: e.oid,
      isDir: e.isDir,
    }));
  }, [selectedCommit, repo.treesByOid]);

  const filteredTreeEntries = useMemo(() => {
    if (!treeSearchQuery.trim()) return snapshotEntries;
    const q = treeSearchQuery.toLowerCase();
    return snapshotEntries.filter((e) => e.path.toLowerCase().includes(q));
  }, [snapshotEntries, treeSearchQuery]);

  const hierarchicalTree = useMemo(() => {
    return buildFileTree(filteredTreeEntries);
  }, [filteredTreeEntries]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const expandAllFolders = () => {
    const allDirs = new Set<string>();
    for (const entry of snapshotEntries) {
      const parts = entry.path.split("/");
      for (let i = 1; i < parts.length; i++) {
        allDirs.add(parts.slice(0, i).join("/"));
      }
    }
    setExpandedFolders(allDirs);
  };

  const collapseAllFolders = () => {
    setExpandedFolders(new Set());
  };

  return (
    <div className="space-y-5">
      {/* 1. Repository KPI Dashboard */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Active Branch */}
        <div className="hud relative overflow-hidden rounded-2xl p-4">
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

        {/* Card 2: Total Commits & Lines Changed */}
        <div className="hud relative overflow-hidden rounded-2xl p-4">
          <span
            aria-hidden="true"
            className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[var(--cyan)]/10 blur-xl"
          />
          <div className="flex items-center gap-2 text-[var(--ink-3)]">
            <GitCommitHorizontal size={15} className="text-[var(--cyan)]" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Commit History</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-[20px] font-semibold text-[var(--ink)]">
              {repo.totalCommits}
            </span>
            <span className="text-[12px] text-[var(--ink-3)]">commits parsed</span>
          </div>
          <div className="mt-1 flex items-center gap-2 font-mono text-[11px]">
            {(() => {
              let totAdd = 0;
              let totDel = 0;
              for (const c of repo.commits) {
                totAdd += c.additions ?? 0;
                totDel += c.deletions ?? 0;
              }
              if (totAdd > 0 || totDel > 0) {
                return (
                  <>
                    <span className="text-[#3DE0A6]">+{totAdd}</span>
                    <span className="text-[#FF6B6B]">-{totDel}</span>
                    <span className="text-[var(--ink-3)]">lines</span>
                  </>
                );
              }
              return (
                <span className="text-[var(--ink-3)]">HEAD: {repo.headOid.slice(0, 7)}</span>
              );
            })()}
          </div>
        </div>

        {/* Card 3: Contributors */}
        <div className="hud relative overflow-hidden rounded-2xl p-4">
          <span
            aria-hidden="true"
            className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[var(--amber)]/10 blur-xl"
          />
          <div className="flex items-center gap-2 text-[var(--ink-3)]">
            <Users size={15} className="text-[var(--amber)]" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Authors</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-[20px] font-semibold text-[var(--ink)]">
              {repo.contributors.length}
            </span>
            <span className="text-[12px] text-[var(--ink-3)]">contributors</span>
          </div>
          <p className="mt-1 truncate font-mono text-[11px] text-[var(--ink-3)]">
            Lead: {repo.contributors[0]?.name || "None"}
          </p>
        </div>

        {/* Card 4: Architecture Safety / Impact Radar */}
        <div className="hud relative overflow-hidden rounded-2xl p-4">
          <span
            aria-hidden="true"
            className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-emerald-500/10 blur-xl"
          />
          <div className="flex items-center gap-2 text-[var(--ink-3)]">
            <Radio size={15} className="text-[#3DE0A6]" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Impact Radar</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {commitImpact ? (
              <span
                className="font-mono text-[14px] font-semibold"
                style={{ color: commitImpact.levelColor }}
              >
                {commitImpact.levelLabel}
              </span>
            ) : (
              <span className="font-mono text-[14px] font-semibold text-[var(--ink-2)]">
                {repo.timeSpan ? formatDate(repo.timeSpan.latest) : "Active"}
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[11px] text-[var(--ink-3)]">
            {commitImpact
              ? `${commitImpact.totalDependentsCount} dependent module${commitImpact.totalDependentsCount === 1 ? "" : "s"}`
              : repo.timeSpan
              ? `Since ${formatDate(repo.timeSpan.first)}`
              : "Repository parsed"}
          </p>
        </div>
      </div>

      {/* 2. Filter & Search Bar */}
      <div className="hud flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3 sm:px-4">
        {/* Branch Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[11px] text-[var(--ink-3)]">Branch:</span>
          <button
            type="button"
            onClick={() => setSelectedBranch("all")}
            className={`rounded-lg px-2.5 py-1 font-mono text-[11px] transition-all ${
              selectedBranch === "all"
                ? "bg-[var(--violet)] text-white shadow-sm"
                : "text-[var(--ink-2)] hover:bg-white/[0.04] hover:text-[var(--ink)]"
            }`}
          >
            All Commits ({repo.commits.length})
          </button>
          {branchList.map((branch) => {
            const isSelected = selectedBranch === branch;
            const isHead = branch === repo.headBranch;
            return (
              <button
                key={branch}
                type="button"
                onClick={() => setSelectedBranch(branch)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-[11px] transition-all ${
                  isSelected
                    ? "bg-[var(--violet)] text-white shadow-sm"
                    : "text-[var(--ink-2)] hover:bg-white/[0.04] hover:text-[var(--ink)]"
                }`}
              >
                <GitBranch size={11} className={isHead ? "text-[var(--amber)]" : "opacity-60"} />
                <span>{branch}</span>
                {isHead && (
                  <span className="rounded bg-[var(--amber)]/20 px-1 text-[9px] text-[var(--amber)] font-bold">
                    HEAD
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commits by message, SHA, author..."
            className="w-full rounded-xl border border-[var(--line-2)] bg-surface/50 py-1.5 pl-8 pr-3 text-[12px] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--violet)] focus:outline-none"
          />
        </div>
      </div>

      {/* 3. Main Workspace: Multi-Lane DAG Timeline on Left, Inspector on Right */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Commit Timeline with Multi-Lane SVG Git DAG */}
        <div className="hud flex min-h-[500px] flex-col overflow-hidden rounded-2xl p-0 lg:col-span-7 xl:col-span-7">
          <div className="flex items-center justify-between border-b border-[var(--line-2)] px-4 py-3">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[var(--ink)]">
              <GitCommitHorizontal size={16} className="text-[var(--violet)]" />
              Commit Timeline & Branch DAG
            </h3>
            <span className="font-mono text-[11px] text-[var(--ink-3)]">
              {filteredCommits.length} commits &bull; click to inspect
            </span>
          </div>

          <div className="max-h-[700px] flex-1 overflow-y-auto overflow-x-hidden p-2">
            {filteredCommits.length === 0 ? (
              <div className="py-24 text-center">
                <GitCommitHorizontal size={32} className="mx-auto text-[var(--ink-3)] opacity-40" />
                <p className="mt-3 text-[13px] text-[var(--ink-3)]">No commits match your filter.</p>
              </div>
            ) : (
              <div className="relative flex min-h-full">
                {/* Multi-Lane SVG Canvas */}
                <svg
                  width={dagLayout.svgWidth}
                  height={filteredCommits.length * ROW_HEIGHT}
                  className="pointer-events-none absolute left-0 top-0 select-none z-10"
                  style={{ width: `${dagLayout.svgWidth}px` }}
                >
                  {/* SVG Paths for Branch Curves & Merges */}
                  {dagLayout.connections.map((conn, idx) => {
                    const x1 = Math.min(conn.fromLane, 4) * LANE_WIDTH + OFFSET_X;
                    const y1 = conn.fromIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const x2 = Math.min(conn.toLane, 4) * LANE_WIDTH + OFFSET_X;
                    const y2 = conn.toIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

                    let d = "";
                    if (x1 === x2) {
                      d = `M ${x1} ${y1} L ${x2} ${y2}`;
                    } else {
                      const midY = (y1 + y2) / 2;
                      d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
                    }

                    return (
                      <path
                        key={`dag-path-${idx}`}
                        d={d}
                        fill="none"
                        stroke={conn.color}
                        strokeWidth={conn.isMerge ? 2 : 2.5}
                        strokeOpacity={conn.isMerge ? 0.7 : 0.85}
                        strokeDasharray={conn.isMerge ? "3 3" : undefined}
                      />
                    );
                  })}

                  {/* SVG Nodes */}
                  {dagLayout.nodes.map((node) => {
                    const isSelected = node.commit.oid === selectedCommit?.oid;
                    const isHead = node.commit.isHead;
                    const isMerge = node.commit.parents.length > 1;

                    return (
                      <g key={`dag-node-${node.commit.oid}`} transform={`translate(${node.x}, ${node.y})`}>
                        {/* Glow halo */}
                        {(isSelected || isHead) && (
                          <circle
                            r={9}
                            fill={isHead ? "#F59E0B" : node.color}
                            fillOpacity={0.25}
                            className="animate-pulse"
                          />
                        )}

                        {/* Outer ring */}
                        <circle
                          r={isMerge ? 5.5 : 4.5}
                          fill={isSelected ? (isHead ? "#F59E0B" : "#ffffff") : "#0E0E14"}
                          stroke={isHead ? "#F59E0B" : node.color}
                          strokeWidth={isMerge ? 2.5 : 2}
                        />

                        {/* Inner dot for merge commits */}
                        {isMerge && (
                          <circle
                            r={2}
                            fill={isHead ? "#F59E0B" : node.color}
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Commit Rows list */}
                <ol className="relative m-0 list-none p-0 flex-1 divide-y divide-[var(--line)]">
                  {filteredCommits.map((c) => {
                    const isSelected = c.oid === selectedCommit?.oid;
                    const isMerge = c.parents.length > 1;
                    const hasDiffCounts = (c.additions !== undefined && c.additions > 0) || (c.deletions !== undefined && c.deletions > 0);

                    return (
                      <li
                        key={c.oid}
                        onClick={() => {
                          setSelectedOid(c.oid);
                          setSelectedDiffIndex(0);
                          setInspectedBlob(null);
                        }}
                        style={{ minHeight: `${ROW_HEIGHT}px` }}
                        className={`group relative flex cursor-pointer items-center transition-all ${
                          isSelected
                            ? "bg-[var(--violet-wash)]/70 text-[var(--ink)] ring-1 ring-inset ring-[var(--violet)]/40 shadow-sm"
                            : "hover:bg-white/[0.04]"
                        }`}
                      >
                        {/* SVG DAG Spacer on left */}
                        <div
                          style={{ width: `${dagLayout.svgWidth + 6}px`, minWidth: `${dagLayout.svgWidth + 6}px` }}
                          className="shrink-0"
                          aria-hidden="true"
                        />

                        {/* Commit Content on right */}
                        <div className="min-w-0 flex-1 py-2 pr-3">
                          {/* Line 1: Summary + Badges + Diff Pills */}
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="truncate text-[13px] font-medium leading-snug text-[var(--ink)]">
                              {c.summary}
                            </span>

                            {isMerge && (
                              <span className="flex items-center gap-1 rounded bg-purple-500/15 px-1.5 py-0.2 font-mono text-[9.5px] text-purple-300 font-semibold">
                                <GitMerge size={10} /> merge
                              </span>
                            )}

                            {c.branches.map((b) => (
                              <span
                                key={b}
                                className={`rounded-full px-2 py-0.2 font-mono text-[9.5px] font-semibold ${
                                  b === repo.headBranch
                                    ? "border border-[var(--amber)]/40 bg-[var(--amber)]/15 text-[var(--amber)]"
                                    : "border border-[var(--violet)]/40 bg-[var(--violet)]/15 text-[var(--violet-ink)]"
                                }`}
                              >
                                {b}
                              </span>
                            ))}

                            {hasDiffCounts && (
                              <span className="ml-auto flex items-center gap-1 font-mono text-[10px]">
                                {(c.additions ?? 0) > 0 && (
                                  <span className="text-[#3DE0A6] font-semibold">+{c.additions}</span>
                                )}
                                {(c.deletions ?? 0) > 0 && (
                                  <span className="text-[#FF6B6B] font-semibold">-{c.deletions}</span>
                                )}
                              </span>
                            )}
                          </div>

                          {/* Line 2: Author, Clock, SHA, Stats */}
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] text-[var(--ink-3)]">
                            <span className="flex items-center gap-1">
                              <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[var(--line-2)] font-mono text-[7.5px] font-bold text-[var(--ink)]">
                                {getInitials(c.author.name)}
                              </span>
                              <span className="truncate max-w-[110px]">{c.author.name}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={10} /> {timeAgo(c.author.timestamp)}
                            </span>
                            <span className="rounded border border-[var(--line)] bg-surface px-1.5 py-0.2 text-[10px]">
                              {c.shortOid}
                            </span>
                            {c.diffs && c.diffs.length > 0 && (
                              <span className="text-[10px] text-[var(--ink-3)]">
                                {c.diffs.length} file{c.diffs.length === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Right: 5-Tab Commit Inspector (Overview, Message, Changes, Snapshot Tree, Impact Radar) */}
        <div className="hud flex min-h-[500px] flex-col justify-between rounded-2xl p-5 lg:col-span-5 xl:col-span-5">
          {selectedCommit ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="border-b border-[var(--line-2)] pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-3)]">
                      Commit Inspector
                    </span>
                    {commitImpact && (
                      <span
                        className="rounded-full px-2 py-0.5 font-mono text-[9.5px] font-semibold"
                        style={{ color: commitImpact.levelColor, backgroundColor: commitImpact.badgeBg }}
                      >
                        {commitImpact.levelLabel}
                      </span>
                    )}
                  </div>

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

                <h4 className="mt-2 text-[14.5px] font-semibold leading-snug text-[var(--ink)]">
                  {selectedCommit.summary}
                </h4>

                {/* 5-Tab Switcher */}
                <div className="mt-3 flex items-center gap-1 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setInspectorTab("overview")}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
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
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      inspectorTab === "message"
                        ? "bg-[var(--violet)] text-white"
                        : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                    }`}
                  >
                    Message
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab("changes")}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      inspectorTab === "changes"
                        ? "bg-[var(--violet)] text-white"
                        : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                    }`}
                  >
                    Changes
                    {selectedCommit.diffs && selectedCommit.diffs.length > 0 && (
                      <span className="rounded-full bg-white/20 px-1 font-mono text-[9.5px]">
                        {selectedCommit.diffs.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab("tree")}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      inspectorTab === "tree"
                        ? "bg-[var(--violet)] text-white"
                        : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                    }`}
                  >
                    Snapshot Tree
                    {snapshotEntries.length > 0 && (
                      <span className="rounded-full bg-white/20 px-1 font-mono text-[9.5px]">
                        {snapshotEntries.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab("impact")}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      inspectorTab === "impact"
                        ? "bg-[var(--violet)] text-white"
                        : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <Radio size={11} className={commitImpact ? "text-[#3DE0A6]" : "opacity-60"} />
                    Impact Radar
                    {commitImpact && commitImpact.totalDependentsCount > 0 && (
                      <span className="rounded-full bg-emerald-500/20 px-1 font-mono text-[9.5px] text-emerald-300">
                        {commitImpact.totalDependentsCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Tab 1: Overview */}
              {inspectorTab === "overview" && (
                <div className="space-y-2.5 text-[12px]">
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
                      <span className="block font-mono text-[10.5px] text-[var(--ink-3)]">
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
                            onClick={() => {
                              setSelectedOid(p);
                              setSelectedDiffIndex(0);
                              setInspectedBlob(null);
                            }}
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

              {/* Tab 3: File Diffs / Changes with 5-Block Diff Stat Meters */}
              {inspectorTab === "changes" && (
                <div className="space-y-3">
                  {!selectedCommit.diffs || selectedCommit.diffs.length === 0 ? (
                    <div className="rounded-xl border border-[var(--line)] bg-surface/40 p-6 text-center text-[12px] text-[var(--ink-3)]">
                      <p className="font-medium text-[var(--ink-2)]">No file diffs recorded for this commit.</p>
                      <p className="mt-1 text-[11px]">
                        This commit is either the initial root commit or objects are stored packed in packfiles.
                      </p>
                    </div>
                  ) : (
                    (() => {
                      const activeDiffIdx = Math.min(
                        selectedDiffIndex,
                        Math.max(0, selectedCommit.diffs.length - 1)
                      );
                      const activeDiff = selectedCommit.diffs[activeDiffIdx];
                      let addedCount = 0;
                      let modCount = 0;
                      let delCount = 0;
                      let totalLinesAdd = 0;
                      let totalLinesDel = 0;

                      for (const d of selectedCommit.diffs) {
                        if (d.status === "added") addedCount++;
                        else if (d.status === "modified") modCount++;
                        else if (d.status === "deleted") delCount++;
                        totalLinesAdd += d.additions ?? 0;
                        totalLinesDel += d.deletions ?? 0;
                      }

                      return (
                        <div className="space-y-3">
                          {/* Diff Bar: File Count, Line Totals & Unified/Split Switcher */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-2 text-[11.5px]">
                            <div className="flex items-center gap-2 font-mono">
                              <span className="text-[var(--ink-3)]">
                                <strong className="text-[var(--ink)]">{selectedCommit.diffs.length}</strong> file{selectedCommit.diffs.length === 1 ? "" : "s"}
                              </span>
                              {addedCount > 0 && (
                                <span className="rounded bg-[#3DE0A6]/10 px-1.5 py-0.2 text-[9.5px] text-[#3DE0A6]">
                                  +{addedCount} new
                                </span>
                              )}
                              {modCount > 0 && (
                                <span className="rounded bg-[var(--cyan)]/10 px-1.5 py-0.2 text-[9.5px] text-[var(--cyan)]">
                                  ~{modCount} mod
                                </span>
                              )}
                              {delCount > 0 && (
                                <span className="rounded bg-[#FF6B6B]/10 px-1.5 py-0.2 text-[9.5px] text-[#FF6B6B]">
                                  -{delCount} del
                                </span>
                              )}
                              {totalLinesAdd > 0 && (
                                <span className="rounded bg-[#3DE0A6]/15 px-1.5 py-0.2 text-[10px] text-[#3DE0A6] font-semibold">
                                  +{totalLinesAdd}
                                </span>
                              )}
                              {totalLinesDel > 0 && (
                                <span className="rounded bg-[#FF6B6B]/15 px-1.5 py-0.2 text-[10px] text-[#FF6B6B] font-semibold">
                                  -{totalLinesDel}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 rounded-lg border border-[var(--line)] bg-surface p-0.5">
                              <button
                                type="button"
                                onClick={() => setDiffMode("unified")}
                                className={`rounded px-2 py-0.5 text-[11px] font-mono transition-colors ${
                                  diffMode === "unified"
                                    ? "bg-[var(--violet)] text-white"
                                    : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                                }`}
                              >
                                Unified
                              </button>
                              <button
                                type="button"
                                onClick={() => setDiffMode("split")}
                                className={`rounded px-2 py-0.5 text-[11px] font-mono transition-colors ${
                                  diffMode === "split"
                                    ? "bg-[var(--violet)] text-white"
                                    : "text-[var(--ink-3)] hover:text-[var(--ink)]"
                                }`}
                              >
                                Split
                              </button>
                            </div>
                          </div>

                          {/* File Selector Chips with 5-block diff meters */}
                          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto pr-1">
                            {selectedCommit.diffs.map((d, idx) => {
                              const isCur = idx === activeDiffIdx;
                              return (
                                <button
                                  key={d.path}
                                  type="button"
                                  onClick={() => setSelectedDiffIndex(idx)}
                                  className={`flex items-center gap-2 rounded-lg border px-2 py-1 font-mono text-[11px] transition-all ${
                                    isCur
                                      ? "border-[var(--violet)] bg-[var(--violet)]/15 text-[var(--ink)] shadow-sm font-medium"
                                      : "border-[var(--line)] bg-surface/70 text-[var(--ink-2)] hover:border-[var(--line-2)] hover:text-[var(--ink)]"
                                  }`}
                                >
                                  <span
                                    className={`rounded px-1 text-[9.5px] font-bold ${
                                      d.status === "added"
                                        ? "bg-[#3DE0A6]/20 text-[#3DE0A6]"
                                        : d.status === "deleted"
                                        ? "bg-[#FF6B6B]/20 text-[#FF6B6B]"
                                        : "bg-[var(--cyan)]/20 text-[var(--cyan)]"
                                    }`}
                                  >
                                    {d.status === "added" ? "+A" : d.status === "deleted" ? "-D" : "~M"}
                                  </span>
                                  <span className="truncate max-w-[130px]">{d.path.split("/").pop()}</span>
                                  <DiffStatBlocks additions={d.additions} deletions={d.deletions} />
                                </button>
                              );
                            })}
                          </div>

                          {/* Diff Inspection View */}
                          {activeDiff && (
                            <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[#09090d]">
                              <div className="flex items-center justify-between border-b border-[var(--line)] bg-surface/60 px-3 py-1.5 text-[11px] font-mono text-[var(--ink-3)]">
                                <span className="truncate text-[var(--ink)] font-medium">
                                  {activeDiff.path}
                                </span>
                                <div className="flex items-center gap-2">
                                  {(activeDiff.additions !== undefined || activeDiff.deletions !== undefined) && (
                                    <span className="text-[10px]">
                                      <span className="text-[#3DE0A6]">+{activeDiff.additions ?? 0}</span>{" "}
                                      <span className="text-[#FF6B6B]">-{activeDiff.deletions ?? 0}</span>
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(activeDiff.path)}
                                    className="flex items-center gap-1 text-[var(--ink-3)] hover:text-[var(--ink)]"
                                  >
                                    <Copy size={11} /> Copy
                                  </button>
                                </div>
                              </div>
                              <div className="max-h-[290px] overflow-auto">
                                <DiffLines
                                  before={activeDiff.oldContent || ""}
                                  after={activeDiff.newContent || ""}
                                  mode={diffMode}
                                  emptyText="No textual differences unpacked for this file."
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

              {/* Tab 4: Recursive Expandable Snapshot File Explorer */}
              {inspectorTab === "tree" && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-[var(--ink-3)]">
                      {snapshotEntries.length} file{snapshotEntries.length === 1 ? "" : "s"} in tree snapshot
                    </span>
                    <div className="flex items-center gap-1.5 text-[10.5px] font-mono">
                      <button
                        type="button"
                        onClick={expandAllFolders}
                        className="text-[var(--ink-3)] hover:text-[var(--ink)] hover:underline"
                      >
                        Expand All
                      </button>
                      <span className="text-[var(--line-2)]">&bull;</span>
                      <button
                        type="button"
                        onClick={collapseAllFolders}
                        className="text-[var(--ink-3)] hover:text-[var(--ink)] hover:underline"
                      >
                        Collapse
                      </button>
                    </div>
                  </div>

                  {/* Search in snapshot tree */}
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
                    <input
                      type="text"
                      value={treeSearchQuery}
                      onChange={(e) => setTreeSearchQuery(e.target.value)}
                      placeholder="Search snapshot files (.tsx, component, etc.)..."
                      className="w-full rounded-lg border border-[var(--line)] bg-surface/60 py-1 pl-7 pr-3 text-[11.5px] font-mono text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--violet)] focus:outline-none"
                    />
                  </div>

                  {/* Hierarchical Folder/File Tree */}
                  {hierarchicalTree.length > 0 ? (
                    <div className="max-h-[250px] divide-y divide-[var(--line)] overflow-y-auto rounded-xl border border-[var(--line)] bg-surface/50">
                      {hierarchicalTree.map((item) => (
                        <FileTreeItem
                          key={item.path}
                          node={item}
                          depth={0}
                          expandedFolders={expandedFolders}
                          toggleFolder={toggleFolder}
                          onSelectBlob={(name, content, path) =>
                            setInspectedBlob(
                              inspectedBlob?.path === path ? null : { name, content, path }
                            )
                          }
                          inspectedBlobPath={inspectedBlob?.path}
                          blobsByOid={repo.blobsByOid}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-[var(--line)] bg-surface/40 p-4 text-center text-[12px] text-[var(--ink-3)]">
                      {treeSearchQuery ? "No files match your snapshot filter." : "Tree entries packed or unavailable in loose format."}
                    </p>
                  )}

                  {/* Inline Code Preview Modal/Drawer */}
                  {inspectedBlob && (
                    <div className="overflow-hidden rounded-xl border border-[var(--violet)]/40 bg-[#09090d] shadow-lg shadow-black/50">
                      <div className="flex items-center justify-between border-b border-[var(--line)] bg-surface/70 px-3 py-1.5 text-[11px] font-mono">
                        <span className="text-[var(--ink)] font-semibold truncate flex items-center gap-1.5">
                          <FileCode2 size={12} className="text-[var(--cyan)]" /> {inspectedBlob.name}
                          <span className="text-[var(--ink-3)] font-normal">
                            ({inspectedBlob.content.split("\n").length} lines)
                          </span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inspectedBlob.content)}
                            className="flex items-center gap-1 text-[var(--ink-3)] hover:text-[var(--ink)]"
                          >
                            <Copy size={11} />
                            <span>{copiedText === inspectedBlob.content ? "Copied" : "Copy"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setInspectedBlob(null)}
                            className="text-[var(--ink-3)] hover:text-[var(--ink)]"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      <pre className="max-h-56 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-[var(--ink-2)] whitespace-pre-wrap select-all">
                        {inspectedBlob.content || "(empty file)"}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Impact Radar & Blast Radius */}
              {inspectorTab === "impact" && (
                <div className="space-y-3">
                  {commitImpact ? (
                    <>
                      {/* Blast Radius Radar Card */}
                      <div
                        className="rounded-xl border p-3.5 space-y-2.5 transition-all"
                        style={{
                          borderColor: `${commitImpact.levelColor}40`,
                          backgroundColor: `${commitImpact.badgeBg}`,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full animate-ping"
                              style={{ backgroundColor: commitImpact.levelColor }}
                            />
                            <span
                              className="font-mono text-[12px] font-bold uppercase tracking-wider"
                              style={{ color: commitImpact.levelColor }}
                            >
                              {commitImpact.levelLabel}
                            </span>
                          </div>
                          {commitImpact.unshieldedCount > 0 ? (
                            <span className="flex items-center gap-1 font-mono text-[10px] text-rose-400">
                              <ShieldAlert size={12} /> {commitImpact.unshieldedCount} unshielded
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                              <ShieldCheck size={12} /> Shielded by tests
                            </span>
                          )}
                        </div>

                        <p className="text-[12px] leading-relaxed text-[var(--ink-2)]">
                          {commitImpact.description}
                        </p>

                        {/* Impact Metrics 3-Col Box */}
                        <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-center">
                          <div className="rounded-lg bg-surface/70 p-2">
                            <span className="block text-[16px] font-semibold text-[var(--ink)]">
                              {commitImpact.totalDependentsCount}
                            </span>
                            <span className="text-[9.5px] uppercase text-[var(--ink-3)]">Dependents</span>
                          </div>
                          <div className="rounded-lg bg-surface/70 p-2">
                            <span className="block text-[16px] font-semibold text-[var(--ink)]">
                              {commitImpact.totalSymbolsCount}
                            </span>
                            <span className="text-[9.5px] uppercase text-[var(--ink-3)]">Symbols</span>
                          </div>
                          <div className="rounded-lg bg-surface/70 p-2">
                            <span className="block text-[16px] font-semibold text-[#3DE0A6]">
                              {commitImpact.totalTestsCount}
                            </span>
                            <span className="text-[9.5px] uppercase text-[var(--ink-3)]">Tests</span>
                          </div>
                        </div>
                      </div>

                      {/* File-by-file Blast Analysis */}
                      <div className="space-y-2">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-3)]">
                          Downstream Impacted Files
                        </span>
                        <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
                          {commitImpact.fileImpacts.map((fi) => {
                            const fileName = fi.path.split("/").pop();
                            const hasCoveringTests = fi.tests.length > 0;
                            return (
                              <div
                                key={fi.path}
                                className="rounded-lg border border-[var(--line)] bg-surface/60 p-2 text-[11px] font-mono"
                              >
                                <div className="flex items-center justify-between gap-1 text-[var(--ink)] font-medium">
                                  <span className="truncate">{fileName}</span>
                                  {hasCoveringTests ? (
                                    <span className="flex items-center gap-1 text-[9.5px] text-[#3DE0A6]">
                                      <CheckCircle2 size={10} /> {fi.tests.length} tests
                                    </span>
                                  ) : fi.dependents.length > 0 ? (
                                    <span className="flex items-center gap-1 text-[9.5px] text-amber-400">
                                      <AlertTriangle size={10} /> uncovered
                                    </span>
                                  ) : (
                                    <span className="text-[9.5px] text-[var(--ink-3)]">leaf module</span>
                                  )}
                                </div>

                                {fi.dependents.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1 text-[9.5px] text-[var(--ink-3)]">
                                    <span className="text-[var(--violet-ink)]">Imported by:</span>
                                    {fi.dependents.map((dep) => (
                                      <span
                                        key={dep.id}
                                        className="rounded bg-white/5 px-1 py-0.2 text-[var(--ink-2)]"
                                      >
                                        {dep.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {onSwitchToArchitecture && (
                        <button
                          type="button"
                          onClick={onSwitchToArchitecture}
                          className="btn btn-ghost btn-sm flex w-full items-center justify-center gap-1.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        >
                          <Radio size={13} /> Open Architecture Blast View
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="rounded-xl border border-[var(--line)] bg-surface/40 p-6 text-center text-[12px] text-[var(--ink-3)]">
                      <Radio size={28} className="mx-auto text-[var(--ink-3)] opacity-40" />
                      <p className="mt-2.5 font-medium text-[var(--ink-2)]">No Architecture Graph Available</p>
                      <p className="mt-1 text-[11px]">
                        The impact radar calculates blast radiuses by cross-referencing commit diffs with AST dependency graphs.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Terminal Command & Lab Actions */}
              <div className="border-t border-[var(--line-2)] pt-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-surface/70 px-3 py-1.5 font-mono text-[11px] text-[var(--ink-2)]">
                  <span className="flex items-center gap-1.5 truncate">
                    <Terminal size={12} className="text-[var(--violet)] shrink-0" />
                    <span>git checkout {selectedCommit.shortOid}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(`git checkout ${selectedCommit.oid}`)}
                    className="shrink-0 text-[var(--ink-3)] hover:text-[var(--ink)]"
                  >
                    {copiedText === `git checkout ${selectedCommit.oid}` ? (
                      <Check size={12} className="text-[#3DE0A6]" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                </div>

                {onSwitchToArchitecture && (
                  <button
                    type="button"
                    onClick={onSwitchToArchitecture}
                    className="btn btn-ghost btn-sm flex w-full items-center justify-center gap-2 border border-[var(--violet)]/30 bg-[var(--violet)]/10 text-[var(--violet)] hover:bg-[var(--violet)]/20"
                  >
                    <Layers size={13} /> View Uploaded Files & Architecture
                  </button>
                )}

                <Link
                  href="/lab"
                  className="btn btn-ghost btn-sm flex w-full items-center justify-center gap-2 text-[var(--ink-3)] hover:text-[var(--ink)]"
                  title="Explore GitPrism's interactive sandbox tutorial playground"
                >
                  <ExternalLink size={13} /> Open Sandbox Lab (Tutorial)
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center p-8 text-center">
              <GitCommitHorizontal size={36} className="text-[var(--ink-3)] opacity-40" />
              <p className="mt-3 text-[13.5px] font-medium text-[var(--ink-2)]">No commit selected</p>
              <p className="mt-1 text-[12px] text-[var(--ink-3)]">
                Adjust your branch filter or search query to inspect commits.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
