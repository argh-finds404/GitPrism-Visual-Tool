// ProofGraph: what evidence actually stands behind a change.
//
// A changed symbol is connected to the tests that reach it, and each connection is rated by how
// much it is worth. The ratings are deliberately narrow:
//
//   verified  a test that calls the symbol directly ran at this revision and produced a result
//   inferred  the only connection is through other code, so the symbol's behaviour is exercised
//             by deduction rather than demonstration
//   stale     the result on record was produced at a different revision, so it does not describe
//             this code any more
//   missing   nothing was found that reaches the symbol
//
// "missing" says a search found nothing. It is not a claim that no test exists, and nothing here
// adds up to a score: a reader is meant to see which claims have support and which do not, not a
// number that hides the difference.
//
// Pure: the test runner is passed in, so this file imports nothing server-only.

import { blastRadius } from "@/features/impact-analysis/blast-radius";
import type { AnalysisResult, ChangeStatus } from "@/features/impact-analysis/types";
import type { TestOutcome, TestStatus } from "@/features/testing/harness";

export type TestRunner = (files: Record<string, string>, path: string, name: string) => TestOutcome;

/** A result as recorded: the revision and moment it came from travel with it. */
export type EvidenceResult = {
  status: TestStatus;
  detail: string;
  ms: number;
  revision: string;
  recordedAt: number;
};

export type EvidenceLink = {
  id: string;
  testId: string;
  testName: string;
  testPath: string;
  /** The test calls this symbol itself, rather than reaching it through other code. */
  direct: boolean;
  /** Hops from the symbol to the node the test attaches to. 0 when direct. */
  distance: number;
  result: EvidenceResult;
};

export type SymbolEvidence = {
  id: string;
  name: string;
  path: string;
  changeStatus: ChangeStatus;
  signatureChanged: boolean;
  links: EvidenceLink[];
};

export type ProofGraph = {
  base: string;
  /** The revision the evidence was collected at. */
  revision: string;
  analysisVersion: string;
  collectedAt: number;
  symbols: SymbolEvidence[];
  limitations: string[];
};

export type LinkState = "verified" | "inferred" | "stale";
export type SymbolState = LinkState | "missing";

export type EvaluatedLink = EvidenceLink & { state: LinkState };
export type EvaluatedSymbol = Omit<SymbolEvidence, "links"> & { links: EvaluatedLink[]; state: SymbolState };

export type Evaluated = {
  graph: ProofGraph;
  /** The revision the reader is looking at now. */
  currentRevision: string;
  /** Every result on record was produced somewhere else. */
  stale: boolean;
  symbols: EvaluatedSymbol[];
  counts: Record<SymbolState, number>;
};

const MAX_DEPTH = 3;

/** A result that demonstrates something: the test ran and either passed or failed. */
const demonstrates = (s: TestStatus) => s === "pass" || s === "fail";

export function collectEvidence(r: AnalysisResult, run: TestRunner): ProofGraph {
  const byId = new Map(r.nodes.map((n) => [n.id, n]));
  const collectedAt = Date.now();
  // One run per test, shared by every symbol it reaches.
  const ran = new Map<string, EvidenceResult>();
  const resultFor = (testId: string) => {
    const hit = ran.get(testId);
    if (hit) return hit;
    const node = byId.get(testId)!;
    const outcome = run(r.headFiles, node.path, node.name);
    const rec: EvidenceResult = { ...outcome, revision: r.head, recordedAt: collectedAt };
    ran.set(testId, rec);
    return rec;
  };

  const symbols: SymbolEvidence[] = r.nodes
    .filter((n) => n.kind === "symbol" && n.changeStatus !== "unchanged")
    .map((n) => {
      const radius = blastRadius(r, n.id, MAX_DEPTH);
      const links: EvidenceLink[] = radius.tests
        .map((t) => {
          const node = byId.get(t.id)!;
          const direct = t.reaches === n.id;
          return {
            id: `${n.id}<-${t.id}`,
            testId: t.id,
            testName: node.name,
            testPath: node.path,
            direct,
            distance: direct ? 0 : t.distance,
            result: resultFor(t.id),
          };
        })
        // Direct evidence first: it is the only kind that can verify anything.
        .sort((a, b) => a.distance - b.distance || a.testName.localeCompare(b.testName));

      return {
        id: n.id,
        name: n.name,
        path: n.path,
        changeStatus: n.changeStatus,
        signatureChanged: !!n.signatureChanged,
        links,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name));

  return {
    base: r.base,
    revision: r.head,
    analysisVersion: r.version,
    collectedAt,
    symbols,
    limitations: [
      "A symbol with no linked test is one nothing was found for. It is not a claim that the symbol is untested: tests that reach it dynamically, through a framework, or from another repository are invisible here.",
      "A direct link means a test calls the symbol by name through a resolved import. It is not a coverage measurement, and it says nothing about which branches ran.",
      "An indirect link means the test exercises something that calls this symbol. Whether it reaches this code at run time is a deduction, not an observation.",
      "Evidence is only ever as current as the revision it was collected at. Results recorded elsewhere are marked stale rather than reused.",
      "Nothing here is combined into a score. A change with every symbol verified is still only as checked as its tests are good.",
    ],
  };
}

export function linkState(link: EvidenceLink, currentRevision: string): LinkState {
  if (link.result.revision !== currentRevision) return "stale";
  if (link.direct && demonstrates(link.result.status)) return "verified";
  return "inferred";
}

/** Rate the collected evidence against the revision the reader is looking at now. */
export function evaluate(graph: ProofGraph, currentRevision: string): Evaluated {
  const symbols: EvaluatedSymbol[] = graph.symbols.map((s) => {
    const links = s.links.map((l) => ({ ...l, state: linkState(l, currentRevision) }));
    const state: SymbolState = !links.length
      ? "missing"
      : links.some((l) => l.state === "verified")
        ? "verified"
        : links.some((l) => l.state === "inferred")
          ? "inferred"
          : "stale";
    return { ...s, links, state };
  });

  const counts: Record<SymbolState, number> = { verified: 0, inferred: 0, missing: 0, stale: 0 };
  for (const s of symbols) counts[s.state]++;

  return {
    graph,
    currentRevision,
    stale: graph.revision !== currentRevision,
    symbols,
    counts,
  };
}
