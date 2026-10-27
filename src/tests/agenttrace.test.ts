import { describe, expect, it } from "vitest";
import { fixtureHistory } from "@/features/impact-analysis/fixture";
import { runFixtureTest } from "@/features/timefold/test-runner";
import { attempts, failed, replay, SCHEMA_VERSION, touchedPaths, UnsupportedLog, type AgentEvent } from "@/features/agenttrace/events";
import { fixtureSessions, sessionBaseFiles } from "@/features/agenttrace/session";
import { compareSessions } from "@/features/agenttrace/compare";
import { diffLines } from "@/lib/git";

const [session, sessionB] = fixtureSessions(runFixtureTest);
const baseFiles = sessionBaseFiles();
const edits = session.events.filter((e): e is Extract<AgentEvent, { kind: "edit" }> => e.kind === "edit");
const PATH = "src/orders/pricing.ts";

describe("event log", () => {
  it("stamps every event with the schema version and a rising sequence", () => {
    expect(session.v).toBe(SCHEMA_VERSION);
    expect(session.events.every((e) => e.v === SCHEMA_VERSION)).toBe(true);
    expect(session.events.map((e) => e.seq)).toEqual(session.events.map((_, i) => i));
    expect(session.events.every((e, i) => i === 0 || e.at >= session.events[i - 1].at)).toBe(true);
    expect(new Set(session.events.map((e) => e.id)).size).toBe(session.events.length);
  });

  it("opens with a start event and closes with an end event", () => {
    expect(session.events[0].kind).toBe("session-start");
    expect(session.events.at(-1)!.kind).toBe("session-end");
  });

  it("refuses a log written to a different schema version", () => {
    const bad = session.events.map((e, i) => (i === 2 ? { ...e, v: SCHEMA_VERSION + 1 } : e));
    expect(() => replay(baseFiles, bad)).toThrow(UnsupportedLog);
  });

  it("records no field that would require the agent's hidden reasoning", () => {
    const keys = new Set(session.events.flatMap((e) => Object.keys(e)));
    for (const forbidden of ["reasoning", "thinking", "thought", "chainOfThought", "prompt"]) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });
});

describe("replay", () => {
  it("rebuilds the head revision exactly, with no step invented", () => {
    const head = fixtureHistory().main.find((c) => c.message === "Fix large-cart discount")!;
    // The strongest claim this feature makes: the log alone reproduces a real commit's tree.
    expect(replay(baseFiles, session.events).head).toEqual(head.files);
    expect(session.headCommit).toBe(head.oid);
  });

  it("snapshots one state per event plus the starting one", () => {
    const r = replay(baseFiles, session.events);
    expect(r.snapshots).toHaveLength(session.events.length + 1);
    expect(r.snapshots[0]).toEqual(baseFiles);
  });

  it("touches only the file the session edited", () => {
    expect(touchedPaths(session.events)).toEqual([PATH]);
  });

  it("does not re-run anything: replaying twice gives the same result", () => {
    expect(replay(baseFiles, session.events).head).toEqual(replay(baseFiles, session.events).head);
  });
});

describe("provenance", () => {
  const r = replay(baseFiles, session.events);
  const lines = diffLines(baseFiles[PATH], r.head[PATH]);

  it("attributes each added line to the edit that wrote it", () => {
    const added = lines.filter((l) => l.kind === "add");
    expect(added.length).toBeGreaterThan(0);
    for (const l of added) {
      const id = r.addedBy[PATH][l.b - 1];
      expect(id).toBe(edits.at(-1)!.id);
    }
  });

  it("attributes a removed line to the attempt that actually removed it", () => {
    const removed = lines.filter((l): l is Extract<typeof l, { kind: "del" }> => l.kind === "del");

    // The constant survived the wrong attempt and only went in the final edit.
    const constLine = removed.find((l) => l.text.includes("DISCOUNT_RATE = 0.1"))!;
    expect(r.removedBy[PATH][constLine.a]).toBe(edits.at(-1)!.id);

    // The return line was rewritten by the wrong attempt first, so that attempt owns its removal.
    const returnLine = removed.find((l) => l.text.includes("total * DISCOUNT_RATE"))!;
    expect(r.removedBy[PATH][returnLine.a]).toBe(edits[0].id);
  });
});

describe("what actually ran", () => {
  const groups = attempts(session.events);

  it("groups the run into three attempts: reproduce, a wrong fix, then the fix", () => {
    expect(groups).toHaveLength(3);
    expect(groups[0].afterEvent).toBeNull();
    expect(groups.map(failed)).toEqual([true, true, false]);
  });

  it("reproduces the reported failure before editing anything", () => {
    const fail = groups[0].results.find((r) => r.status === "fail")!;
    expect(fail.path).toBe("tests/pricing.test.ts");
    expect(fail.detail).toContain("Expected 180, received 20");
  });

  it("really executes the wrong attempt and gets a different, real failure", () => {
    const fail = groups[1].results.find((r) => r.status === "fail")!;
    expect(fail.detail).toContain("Expected 180, received 200");
  });

  it("ends with every test passing", () => {
    expect(groups[2].results.every((r) => r.status === "pass")).toBe(true);
    expect(groups[2].results.length).toBeGreaterThan(1);
  });

  it("derives each command's exit code from the results that followed it", () => {
    const commands = session.events.filter((e): e is Extract<AgentEvent, { kind: "command" }> => e.kind === "command");
    expect(commands.map((c) => c.exitCode)).toEqual([1, 1, 0]);
  });
});

describe("the second attempt", () => {
  it("is a different attempt at the same task from the same base", () => {
    expect(sessionB.id).not.toBe(session.id);
    expect(new Set(sessionB.events.map((e) => e.id)).size).toBe(sessionB.events.length);
    // Ids are prefixed per session, so the two logs never collide when read together.
    expect(sessionB.events.every((e) => !session.events.some((x) => x.id === e.id))).toBe(true);
  });

  it("really passes its tests with code the repository never committed", () => {
    const groups = attempts(sessionB.events);
    expect(groups.map(failed)).toEqual([true, false]);
    expect(sessionB.headCommit).toBeNull();
    const head = replay(baseFiles, sessionB.events).head;
    expect(head[PATH]).toContain("DISCOUNT_RATE = 0.9");
  });
});

describe("session comparison", () => {
  const c = compareSessions(baseFiles, session, sessionB);

  it("confirms the two attempts are comparable at all", () => {
    expect(c.sameTask).toBe(true);
    expect(c.sameBase).toBe(true);
  });

  it("finds both attempts green and their code different", () => {
    // The case the whole view exists for: agreeing test results, disagreeing code.
    expect(c.bothGreen).toBe(true);
    expect(c.sameCode).toBe(false);
    expect(c.tests.every((t) => t.agree)).toBe(true);
    expect(c.tests.every((t) => t.a === "pass" && t.b === "pass")).toBe(true);
  });

  it("reports the file they disagree about", () => {
    const differing = c.files.filter((f) => !f.same);
    expect(differing.map((f) => f.path)).toEqual([PATH]);
    expect(differing[0].a).not.toBe(differing[0].b);
  });

  it("counts the work each attempt took", () => {
    expect(c.counts.edits).toEqual([2, 1]);
    expect(c.counts.attempts).toEqual([3, 2]);
    expect(c.counts.failedAttempts).toEqual([2, 1]);
    expect(c.elapsed[0]).toBeGreaterThan(c.elapsed[1]);
  });

  it("is symmetric about what it claims", () => {
    const flipped = compareSessions(baseFiles, sessionB, session);
    expect(flipped.sameCode).toBe(c.sameCode);
    expect(flipped.bothGreen).toBe(c.bothGreen);
    expect(flipped.counts.edits).toEqual([c.counts.edits[1], c.counts.edits[0]]);
  });
});
