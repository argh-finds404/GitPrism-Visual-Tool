// A lab session: the sample repository plus the commands the learner ran.
// Every intermediate state is kept so replay can move backward safely.

import { apply } from "./engine";
import { createSampleRepository } from "./sample";
import type { RepositoryCommand, RepositoryEvent, RepositoryState } from "./types";

export type Step = { state: RepositoryState; event: RepositoryEvent | null; command: RepositoryCommand | null };

const START_EVENT: RepositoryEvent = {
  kind: "COMMIT_CREATED",
  title: "Sample repository loaded",
  detail: "main has three commits and feature/shout branches off the second. Everything you do from here is recorded and can be replayed.",
  objects: [],
};

/** Rebuild every step from the sample. Commands that no longer apply are dropped. */
export function buildSteps(commands: RepositoryCommand[]): { steps: Step[]; valid: RepositoryCommand[] } {
  const steps: Step[] = [{ state: createSampleRepository(), event: START_EVENT, command: null }];
  const valid: RepositoryCommand[] = [];
  for (const cmd of commands) {
    const r = apply(steps[steps.length - 1].state, cmd);
    if (!r.ok) continue;
    steps.push({ state: r.state, event: r.event, command: cmd });
    valid.push(cmd);
  }
  return { steps, valid };
}
