// Builds a bounded Markdown context pack for an external AI assistant.
// Priority: changed code → direct callers → linked tests → definitions it calls.
// Lower-priority items are reduced to signatures before anything required is dropped.
// Nothing is sent anywhere; the user copies the result.

import { diffLines } from "@/lib/git";
import { isSecretFile } from "./source-analysis";
import type { AnalysisResult, ImpactNode } from "./types";

export type PackItem = {
  nodeId: string;
  reason: "changed" | "caller" | "test" | "definition" | "selected";
  priority: number;
};

export type Pack = {
  markdown: string;
  /** Rough estimate: characters ÷ 4. Not measured with a model tokenizer. */
  estimatedTokens: number;
  included: { nodeId: string; mode: "full" | "signature" }[];
  dropped: string[];
  excluded: { path: string; reason: string }[];
  redactions: number;
};

const SECRET_PATTERNS = [
  /sk_(live|test)_[A-Za-z0-9]{8,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\b(password|secret|api[_-]?key|token)\s*[:=]\s*["'][^"']{6,}["']/gi,
];

export function redactSecrets(text: string) {
  let count = 0;
  let out = text;
  for (const re of SECRET_PATTERNS)
    out = out.replace(re, () => {
      count++;
      return "[REDACTED]";
    });
  return { text: out, count };
}

export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

/** Default items: what a reviewer needs to judge the change. */
export function defaultItems(r: AnalysisResult): PackItem[] {
  const items = new Map<string, PackItem>();
  const put = (nodeId: string, reason: PackItem["reason"], priority: number) => {
    const cur = items.get(nodeId);
    if (!cur || cur.priority > priority) items.set(nodeId, { nodeId, reason, priority });
  };
  const changed = r.nodes.filter((n) => n.kind === "symbol" && n.changeStatus !== "unchanged" && n.changeStatus !== "deleted");
  changed.forEach((n) => put(n.id, "changed", 0));
  for (const n of changed) {
    r.edges.filter((e) => e.target === n.id && e.kind === "calls").forEach((e) => put(e.source, "caller", 1));
    r.edges.filter((e) => e.target === n.id && e.kind === "tests").forEach((e) => put(e.source, "test", 2));
    r.edges.filter((e) => e.source === n.id && e.kind === "calls").forEach((e) => put(e.target, "definition", 3));
  }
  return [...items.values()].sort((a, b) => a.priority - b.priority);
}

function snippet(r: AnalysisResult, n: ImpactNode) {
  const files = n.changeStatus === "deleted" ? r.baseFiles : r.headFiles;
  const lines = (files[n.path] ?? "").split("\n");
  const { startLine, endLine } = n.sourceRange ?? { startLine: 1, endLine: lines.length };
  return lines.slice(startLine - 1, endLine).join("\n");
}

export function buildPack(r: AnalysisResult, items: PackItem[], budget: number, title: string): Pack {
  const byId = new Map(r.nodes.map((n) => [n.id, n]));
  const excluded = Object.keys({ ...r.baseFiles, ...r.headFiles })
    .filter(isSecretFile)
    .map((path) => ({ path, reason: "Secret or environment file, never included" }));

  const header = [
    `# Review context: ${title}`,
    "",
    `Base \`${r.base.slice(0, 7)}\` → head \`${r.head.slice(0, 7)}\`. Analysis ${r.version}.`,
    "",
    "## Changed files",
    ...r.changes.map((c) => `- ${c.status} \`${c.path}\` (+${c.added} −${c.removed})`),
    "",
    "## Findings",
    ...r.findings.map((f) => `- **${f.kind}**: ${f.title}`),
    "",
  ].join("\n");

  // Diffs for changed source files come first; they are the reason for the review.
  const diffs = r.changes
    .filter((c) => !isSecretFile(c.path))
    .map((c) => {
      const body = diffLines(r.baseFiles[c.path] ?? "", r.headFiles[c.path] ?? "")
        .filter((l) => l.kind !== "same")
        .map((l) => (l.kind === "add" ? "+ " : "- ") + l.text)
        .join("\n");
      return `### ${c.path}\n\n\`\`\`diff\n${body}\n\`\`\``;
    });

  let used = estimateTokens(header);
  const parts: string[] = [header, "## Diff\n"];
  for (const d of diffs) {
    parts.push(d);
    used += estimateTokens(d);
  }
  parts.push("\n## Related code\n");

  const included: Pack["included"] = [];
  const dropped: string[] = [];
  for (const it of items) {
    const n = byId.get(it.nodeId);
    if (!n || isSecretFile(n.path)) continue;
    const full = `### ${n.name} (${it.reason}) — ${n.path}:${n.sourceRange?.startLine ?? 1}\n\n\`\`\`ts\n${snippet(r, n)}\n\`\`\``;
    const sig = `- ${n.name}(${n.params ?? ""}) — ${n.path}:${n.sourceRange?.startLine ?? 1} (${it.reason}, summarized)`;
    if (used + estimateTokens(full) <= budget) {
      parts.push(full);
      used += estimateTokens(full);
      included.push({ nodeId: n.id, mode: "full" });
    } else if (used + estimateTokens(sig) <= budget) {
      parts.push(sig);
      used += estimateTokens(sig);
      included.push({ nodeId: n.id, mode: "signature" });
    } else dropped.push(n.id);
  }

  const { text, count } = redactSecrets(parts.join("\n\n"));
  return { markdown: text, estimatedTokens: estimateTokens(text), included, dropped, excluded, redactions: count };
}
