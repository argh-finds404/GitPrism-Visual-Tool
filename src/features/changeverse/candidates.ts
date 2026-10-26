// What a preflight can be run against. The client uses this to draw the picker; the server
// resolves the id again from the same fixture, so a request never carries file contents or
// anything else the caller could have made up.

import { FIXTURE, fixtureHistory } from "@/features/impact-analysis/fixture";
import { short } from "@/lib/git";

export type Candidate = {
  id: string;
  kind: "pull" | "commit";
  label: string;
  detail: string;
  base: string;
  head: string;
};

export function candidates(): Candidate[] {
  const h = fixtureHistory();
  const byOid = new Map(h.all.map((c) => [c.oid, c]));
  const tip = h.commits.at(-1)!;

  const out: Candidate[] = [
    {
      id: "pull",
      kind: "pull",
      label: `Pull request #${FIXTURE.number} — ${FIXTURE.title}`,
      detail: `${FIXTURE.source} → ${FIXTURE.target} · ${h.commits.length} commits · base ${short(h.base.oid)}`,
      base: h.base.oid,
      head: tip.oid,
    },
  ];
  // Single commits, newest first: each one is its own candidate change against its parent.
  for (const c of [...h.all].reverse()) {
    const parent = c.parents[0] ? byOid.get(c.parents[0]) : undefined;
    if (!parent) continue;
    out.push({
      id: c.oid,
      kind: "commit",
      label: c.message,
      detail: `${c.lane} · ${short(c.oid)} on ${short(parent.oid)}`,
      base: parent.oid,
      head: c.oid,
    });
  }
  return out;
}

/** Resolve a candidate id to the two file sets the analysis compares. Null if the id is unknown. */
export function resolveCandidate(id: string) {
  const c = candidates().find((x) => x.id === id);
  if (!c) return null;
  const h = fixtureHistory();
  const files = (oid: string) => (oid === h.base.oid ? h.base.files : h.all.find((x) => x.oid === oid)?.files);
  const baseFiles = files(c.base);
  const headFiles = files(c.head);
  if (!baseFiles || !headFiles) return null;
  return { candidate: c, baseFiles, headFiles };
}
