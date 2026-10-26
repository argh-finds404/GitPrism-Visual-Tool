/** The six tools, in the order a reviewer meets them. Shared by the site nav and every studio. */
export const STUDIOS = [
  { id: "review", href: "/review/gitprism-demo/acme-shop/pull/42", label: "PR Studio", blurb: "Blast radius of a pull request" },
  { id: "changeverse", href: "/changeverse/gitprism-demo/acme-shop", label: "ChangeVerse", blurb: "Predicted impact against real results" },
  { id: "proofgraph", href: "/proofgraph/gitprism-demo/acme-shop", label: "ProofGraph", blurb: "What evidence stands behind a change" },
  { id: "agenttrace", href: "/agenttrace/gitprism-demo/acme-shop", label: "AgentTrace", blurb: "Replay how an agent wrote it" },
  { id: "timefold", href: "/timefold/gitprism-demo/acme-shop", label: "TimeFold", blurb: "Travel a repository's history" },
  { id: "mergelab", href: "/mergelab/gitprism-demo/acme-shop", label: "MergeLab", blurb: "Resolve conflicts safely" },
] as const;

export type StudioId = (typeof STUDIOS)[number]["id"];
