// Bisect over a first-parent chain, like `git bisect`: confirm the known-good and
// known-bad ends, then halve the range. A revision where the test can't run (missing
// or erroring) is skipped, never guessed, and the answer says when skips leave doubt.

import type { TestOutcome } from "./test-runner";

export type Probe = { index: number; outcome: TestOutcome };

export type BisectResult =
  | { kind: "found"; firstBad: number; lastGood: number }
  | { kind: "ambiguous"; candidates: number[]; lastGood: number }
  | { kind: "invalid"; reason: string };

export type BisectState = {
  good: number;
  bad: number;
  /** Last revision known to pass and first revision known to fail. */
  lo: number;
  hi: number;
  probes: Probe[];
  skipped: number[];
  result: BisectResult | null;
};

export function startBisect(good: number, bad: number): BisectState {
  if (good >= bad) {
    return { good, bad, lo: good, hi: bad, probes: [], skipped: [], result: { kind: "invalid", reason: "The known-good commit must come before the known-bad one." } };
  }
  return { good, bad, lo: good, hi: bad, probes: [], skipped: [], result: null };
}

const candidates = (s: BisectState) => {
  const out: number[] = [];
  for (let i = s.lo + 1; i < s.hi; i++) if (!s.skipped.includes(i)) out.push(i);
  return out;
};

/** The revision to test next, or null when the search is over. */
export function nextProbe(s: BisectState): number | null {
  if (s.result) return null;
  if (!s.probes.some((p) => p.index === s.good)) return s.good;
  if (!s.probes.some((p) => p.index === s.bad)) return s.bad;
  const c = candidates(s);
  return c.length ? c[Math.floor((c.length - 1) / 2)] : null;
}

function finish(s: BisectState): BisectState {
  if (s.result || candidates(s).length) return s;
  const between = s.skipped.filter((i) => i > s.lo && i < s.hi).sort((a, b) => a - b);
  return {
    ...s,
    result: between.length ? { kind: "ambiguous", candidates: [...between, s.hi], lastGood: s.lo } : { kind: "found", firstBad: s.hi, lastGood: s.lo },
  };
}

export function recordProbe(s: BisectState, index: number, outcome: TestOutcome): BisectState {
  const next: BisectState = { ...s, probes: [...s.probes, { index, outcome }] };
  const runnable = outcome.status === "pass" || outcome.status === "fail";

  if (index === s.good) {
    if (outcome.status !== "pass")
      return { ...next, result: { kind: "invalid", reason: `The known-good commit doesn't pass (${outcome.status}): ${outcome.detail}` } };
    return next;
  }
  if (index === s.bad) {
    if (outcome.status !== "fail")
      return {
        ...next,
        result: {
          kind: "invalid",
          reason:
            outcome.status === "pass"
              ? "The known-bad commit passes this test, so there is no regression between these two commits."
              : `The test can't run at the known-bad commit (${outcome.status}): ${outcome.detail}`,
        },
      };
    return finish(next);
  }
  if (!runnable) return finish({ ...next, skipped: [...s.skipped, index] });
  return finish(outcome.status === "pass" ? { ...next, lo: index } : { ...next, hi: index });
}
