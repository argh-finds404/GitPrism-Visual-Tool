export type StudioCategory = "core" | "review";

/** The eight studios and interactive environments in GitPrism. */
export const STUDIOS = [
  // Interactive Workbenches & Labs
  {
    id: "lab",
    href: "/lab",
    label: "Sandbox Lab",
    blurb: "Interactive in-memory Git playground & guided tour",
    category: "core",
    badge: "Interactive",
  },
  {
    id: "analyze",
    href: "/analyze",
    label: "Repository Studio",
    blurb: "Inspect local Git DAG, AST & blast radius",
    category: "core",
    badge: "Local-First",
  },
  // PR & Architecture Review Studios
  {
    id: "review",
    href: "/review/gitprism-demo/acme-shop/pull/42",
    label: "PR Impact Studio",
    blurb: "Blast radius of a pull request in 3D lenses",
    category: "review",
  },
  {
    id: "changeverse",
    href: "/changeverse/gitprism-demo/acme-shop",
    label: "ChangeVerse",
    blurb: "Predicted impact against real metrics",
    category: "review",
  },
  {
    id: "proofgraph",
    href: "/proofgraph/gitprism-demo/acme-shop",
    label: "ProofGraph",
    blurb: "What evidence stands behind a change",
    category: "review",
  },
  {
    id: "agenttrace",
    href: "/agenttrace/gitprism-demo/acme-shop",
    label: "AgentTrace",
    blurb: "Replay how an AI agent wrote code",
    category: "review",
  },
  {
    id: "timefold",
    href: "/timefold/gitprism-demo/acme-shop",
    label: "TimeFold",
    blurb: "Travel history & bisect regressions",
    category: "review",
  },
  {
    id: "mergelab",
    href: "/mergelab/gitprism-demo/acme-shop",
    label: "MergeLab",
    blurb: "Resolve three-way merge conflicts safely",
    category: "review",
  },
] as const;

export type StudioId = (typeof STUDIOS)[number]["id"];

