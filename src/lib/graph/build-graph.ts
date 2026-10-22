// Turn repository state into positioned graph elements. These are projections:
// every node and edge comes from a real object or reference, never invented.

import { ancestors, currentBranch, getCommit, headCommitId, reachableCommits } from "@/features/repository/engine";
import type { ObjectId, RepositoryState, TreeObject } from "@/features/repository/types";

export type GNodeKind = "commit" | "tree" | "blob" | "branch" | "head";

export type GNode = {
  id: string;
  kind: GNodeKind;
  x: number;
  y: number;
  oid?: ObjectId;
  /** Main label: message, file name or branch name. */
  label: string;
  /** Secondary label: short ID, mode, target. */
  sub?: string;
  lane?: number;
  current?: boolean;
};

export type GEdgeKind = "parent" | "tree" | "entry" | "ref";

export type GEdge = {
  id: string;
  source: string;
  target: string;
  kind: GEdgeKind;
  label?: string;
  /** Which sides of the nodes the edge attaches to. */
  from: "left" | "right" | "top" | "bottom";
  to: "left" | "right" | "top" | "bottom";
  lane?: number;
};

export type Graph = { nodes: GNode[]; edges: GEdge[] };

const COL = 170;
const ROW = 130;

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

/** Branch lanes: the current branch first, then the rest alphabetically. */
export function branchOrder(state: RepositoryState) {
  const cur = currentBranch(state);
  return Object.keys(state.branches).sort((a, b) => (a === cur ? -1 : b === cur ? 1 : a === "main" ? -1 : b === "main" ? 1 : a.localeCompare(b)));
}

export function buildHistoryGraph(state: RepositoryState, opts: { branches?: string[] | null } = {}): Graph {
  let commits = reachableCommits(state);
  const visible = opts.branches?.length ? new Set(opts.branches.flatMap((b) => [...ancestors(state, state.branches[b])])) : null;
  if (visible) commits = commits.filter((c) => visible.has(c.oid));

  // Assign each commit to the lane of the first branch whose first-parent chain reaches it.
  const lane = new Map<ObjectId, number>();
  const order = branchOrder(state).filter((b) => !opts.branches?.length || opts.branches.includes(b));
  let next = 0;
  const lanes = [...order.map((b) => state.branches[b])];
  const head = headCommitId(state);
  if (state.head.type === "detached" && head) lanes.push(head);
  for (const tip of lanes) {
    let c = getCommit(state, tip);
    let used = false;
    while (c && !lane.has(c.oid) && (!visible || visible.has(c.oid))) {
      lane.set(c.oid, next);
      used = true;
      c = getCommit(state, c.parents[0]);
    }
    if (used) next++;
  }
  commits.forEach((c) => lane.has(c.oid) || lane.set(c.oid, next));

  const nodes: GNode[] = [];
  const edges: GEdge[] = [];
  const x = new Map<ObjectId, number>();
  commits.forEach((c, i) => {
    x.set(c.oid, i * COL);
    nodes.push({
      id: c.oid,
      kind: "commit",
      oid: c.oid,
      x: i * COL,
      y: lane.get(c.oid)! * ROW,
      label: c.message,
      sub: c.oid.slice(0, 7),
      lane: lane.get(c.oid),
      current: c.oid === head,
    });
    c.parents.forEach((p, pi) => {
      if (!commits.some((k) => k.oid === p)) return;
      edges.push({ id: `${c.oid}->${p}`, source: c.oid, target: p, kind: "parent", from: "left", to: "right", lane: pi === 0 ? lane.get(c.oid) : lane.get(p) });
    });
  });

  // Branch and HEAD labels sit above the commit they point at.
  const cur = currentBranch(state);
  const stacked = new Map<ObjectId, number>();
  for (const b of order) {
    const target = state.branches[b];
    if (!x.has(target)) continue;
    const k = stacked.get(target) ?? 0;
    stacked.set(target, k + 1);
    const id = `ref:${b}`;
    nodes.push({ id, kind: "branch", x: x.get(target)!, y: lane.get(target)! * ROW - 62 - k * 40, label: b, sub: target.slice(0, 7), current: b === cur });
    edges.push({ id: `${id}->${target}`, source: id, target, kind: "ref", from: "bottom", to: "top" });
    if (b === cur) {
      nodes.push({ id: "HEAD", kind: "head", x: x.get(target)! + 120, y: lane.get(target)! * ROW - 62 - k * 40, label: "HEAD", sub: `→ ${b}` });
      edges.push({ id: "HEAD->ref", source: "HEAD", target: id, kind: "ref", from: "left", to: "right" });
    }
  }
  if (state.head.type === "detached" && head && x.has(head)) {
    nodes.push({ id: "HEAD", kind: "head", x: x.get(head)!, y: lane.get(head)! * ROW - 62, label: "HEAD", sub: "detached" });
    edges.push({ id: "HEAD->commit", source: "HEAD", target: head, kind: "ref", from: "bottom", to: "top" });
  }
  return { nodes, edges };
}

/* ------------------------------------------------------------------ */
/* Object topology                                                     */
/* ------------------------------------------------------------------ */

/**
 * commit → root tree → subtrees → blobs. Each object appears once even when
 * several paths reference it, so shared blobs visibly have several parents.
 */
export function buildObjectGraph(
  state: RepositoryState,
  commitOid: ObjectId,
  opts: { direction?: "right" | "down"; origin?: { x: number; y: number } } = {},
): Graph {
  const dir = opts.direction ?? "right";
  const o = opts.origin ?? { x: 0, y: 0 };
  const commit = getCommit(state, commitOid);
  if (!commit) return { nodes: [], edges: [] };

  const nodes = new Map<string, GNode>();
  const edges: GEdge[] = [];
  let leaf = 0;
  const place = (depth: number, slot: number) =>
    dir === "right" ? { x: o.x + depth * 210, y: o.y + slot * 74 } : { x: o.x + slot * 170, y: o.y + depth * 120 };
  const from = dir === "right" ? "right" : "bottom";
  const to = dir === "right" ? "left" : "top";

  const visit = (oid: ObjectId, name: string, depth: number): number => {
    const existing = nodes.get(oid);
    if (existing) return dir === "right" ? (existing.y - o.y) / 74 : (existing.x - o.x) / 170;
    const obj = state.objects[oid];
    if (!obj) return leaf;
    if (obj.type === "blob") {
      const slot = leaf++;
      nodes.set(oid, { id: oid, kind: "blob", oid, ...place(depth, slot), label: name, sub: oid.slice(0, 7) });
      return slot;
    }
    const t = obj as TreeObject;
    const slots = t.entries.map((e) => {
      const slot = visit(e.oid, e.name, depth + 1);
      edges.push({ id: `${oid}->${e.oid}:${e.name}`, source: oid, target: e.oid, kind: "entry", label: e.type === "tree" ? `${e.name}/` : e.name, from, to });
      return slot;
    });
    const slot = slots.length ? (Math.min(...slots) + Math.max(...slots)) / 2 : leaf++;
    nodes.set(oid, { id: oid, kind: "tree", oid, ...place(depth, slot), label: name, sub: oid.slice(0, 7) });
    return slot;
  };

  const rootSlot = visit(commit.tree, "/", 1);
  nodes.set(commit.oid, { id: commit.oid, kind: "commit", oid: commit.oid, ...place(0, rootSlot), label: commit.message, sub: commit.oid.slice(0, 7) });
  edges.push({ id: `${commit.oid}->${commit.tree}`, source: commit.oid, target: commit.tree, kind: "tree", label: "tree", from, to });
  return { nodes: [...nodes.values()], edges };
}

/** History with the selected commit opened up into its tree beneath it. */
export function buildRefractionGraph(state: RepositoryState, commitOid: ObjectId | null, opts: { branches?: string[] | null } = {}): Graph {
  const history = buildHistoryGraph(state, opts);
  const anchor = history.nodes.find((n) => n.id === commitOid && n.kind === "commit");
  if (!anchor) return history;
  const maxY = Math.max(...history.nodes.filter((n) => n.kind === "commit").map((n) => n.y));
  const topo = buildObjectGraph(state, anchor.id, { direction: "down", origin: { x: 0, y: maxY + 40 } });
  // Centre the unfolded tree under its commit.
  const xs = topo.nodes.filter((n) => n.kind !== "commit").map((n) => n.x);
  const shift = anchor.x - (Math.min(...xs) + Math.max(...xs)) / 2;
  const unfolded = topo.nodes
    .filter((n) => n.kind !== "commit")
    .map((n) => ({ ...n, id: `r:${n.id}`, x: n.x + shift }));
  const ids = new Set(unfolded.map((n) => n.oid));
  const edges = topo.edges.map((e) => ({
    ...e,
    id: `r:${e.id}`,
    source: e.source === anchor.id ? anchor.id : `r:${e.source}`,
    target: ids.has(e.target) ? `r:${e.target}` : e.target,
  }));
  return { nodes: [...history.nodes, ...unfolded], edges: [...history.edges, ...edges] };
}

/** IDs on the path from a commit down to an object, for "Trace origin". */
export function pathToObject(state: RepositoryState, commitOid: ObjectId, target: ObjectId): ObjectId[] | null {
  const commit = getCommit(state, commitOid);
  if (!commit) return null;
  if (commit.oid === target) return [commit.oid];
  const walk = (oid: ObjectId): ObjectId[] | null => {
    if (oid === target) return [oid];
    const t = state.objects[oid];
    if (!t || t.type !== "tree") return null;
    for (const e of t.entries) {
      const p = walk(e.oid);
      if (p) return [oid, ...p];
    }
    return null;
  };
  const p = walk(commit.tree);
  return p ? [commit.oid, ...p] : null;
}
