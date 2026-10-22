// Canonical impact graph. Every lens, the inspector, the findings and the
// context pack read this one structure; nothing downstream invents nodes or edges.

export type ChangeStatus = "added" | "modified" | "deleted" | "unchanged";

export type ImpactNode = {
  id: string;
  kind: "file" | "symbol" | "test";
  path: string;
  name: string;
  changeStatus: ChangeStatus;
  /** Lines in the head version (base version for deleted symbols). */
  sourceRange?: { startLine: number; endLine: number };
  /** Parameter list as written, for symbols. */
  params?: string;
  /** True when the parameter list differs between base and head. */
  signatureChanged?: boolean;
  baseParams?: string;
  /** Owning file id for symbols and tests. */
  fileId?: string;
  analysisVersion: string;
};

export type EdgeKind = "imports" | "calls" | "tests";

export type ImpactEdge = {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  /** "resolved": matched through an explicit import or same-file declaration. */
  evidence: "resolved" | "inferred";
  /** Where the relationship appears in source. */
  location: { path: string; line: number; text: string };
  analysisVersion: string;
};

export type FileChange = {
  path: string;
  status: Exclude<ChangeStatus, "unchanged">;
  added: number;
  removed: number;
  /** Head line numbers that were added or changed. */
  changedLines: number[];
};

export type Layer = { id: string; label: string; patterns: string[] };
export type LayerRule = { id: string; text: string };

export type ArchitectureViolation = {
  edgeId: string;
  ruleId: string;
  from: string;
  to: string;
  fromLayer: string;
  toLayer: string;
};

export type FindingKind = "fact" | "static-warning" | "hypothesis";

export type Finding = {
  id: string;
  kind: FindingKind;
  title: string;
  detail: string;
  nodeIds: string[];
  locations: { path: string; line: number }[];
  method: string;
};

export type AnalysisStage = { id: string; label: string; ms: number };

export type AnalysisResult = {
  version: string;
  base: string;
  head: string;
  nodes: ImpactNode[];
  edges: ImpactEdge[];
  changes: FileChange[];
  /** File contents at base and head, for source and diff views. */
  baseFiles: Record<string, string>;
  headFiles: Record<string, string>;
  layerOf: Record<string, string>;
  violations: ArchitectureViolation[];
  cycles: string[][];
  /** Relative imports in head that point at no file. */
  unresolved: { path: string; line: number; text: string }[];
  findings: Finding[];
  stages: AnalysisStage[];
  analyzedAt: number;
  limitations: string[];
};
