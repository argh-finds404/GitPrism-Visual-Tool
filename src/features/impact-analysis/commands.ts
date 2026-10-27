// Structured command bar. Each command resolves to a concrete action or to an
// explanation of why it can't run; free text is matched against known forms only.

import type { AnalysisResult } from "./types";

export type CommandAction =
  | { type: "callers"; nodeId: string }
  | { type: "tests"; nodeId: string }
  | { type: "changed" }
  | { type: "cycles" }
  | { type: "compare"; nodeId: string }
  | { type: "focus"; nodeId: string }
  | { type: "lens"; lens: number };

export type CommandResult = { ok: true; action: CommandAction; label: string } | { ok: false; message: string };

export const EXAMPLES = [
  "Show direct callers of validateSession",
  "Highlight files changed since base",
  "Show tests related to session.ts",
  "Compare validateSession with base",
  "Focus on circular dependencies",
];

function findNode(r: AnalysisResult, name: string) {
  const q = name.trim().replace(/\(\)$/, "").toLowerCase();
  return (
    r.nodes.find((n) => n.name.toLowerCase() === q && n.kind === "symbol") ??
    r.nodes.find((n) => n.name.toLowerCase() === q) ??
    r.nodes.find((n) => n.path.toLowerCase().endsWith(q))
  );
}

export function parseCommand(input: string, r: AnalysisResult | null): CommandResult {
  const text = input.trim();
  if (!text) return { ok: false, message: "Type a command, for example: " + EXAMPLES[0] };
  if (!r) return { ok: false, message: "Run the analysis first. Commands read its results." };

  let m = text.match(/^(?:show\s+)?(?:direct\s+)?callers\s+(?:of\s+)?(.+)$/i);
  if (m) {
    const n = findNode(r, m[1]);
    return n ? { ok: true, action: { type: "callers", nodeId: n.id }, label: `Direct callers of ${n.name}` } : { ok: false, message: `No file or symbol called “${m[1]}” in this analysis.` };
  }
  m = text.match(/^(?:show\s+)?tests\s+(?:related\s+to|for)\s+(.+)$/i);
  if (m) {
    const n = findNode(r, m[1]);
    return n ? { ok: true, action: { type: "tests", nodeId: n.id }, label: `Tests related to ${n.name}` } : { ok: false, message: `No file or symbol called “${m[1]}”.` };
  }
  if (/changed|since base/i.test(text)) return { ok: true, action: { type: "changed" }, label: "Files changed since base" };
  if (/cycle|circular/i.test(text))
    return r.cycles.length ? { ok: true, action: { type: "cycles" }, label: "Circular dependencies" } : { ok: false, message: "The analysis found no import cycles." };
  m = text.match(/^compare\s+(.+?)\s+(?:with|to)\s+base$/i);
  if (m) {
    const n = findNode(r, m[1]);
    return n ? { ok: true, action: { type: "compare", nodeId: n.id }, label: `${n.name}: base vs head` } : { ok: false, message: `No symbol called “${m[1]}”.` };
  }
  m = text.match(/^lens\s+([1-5])$/i);
  if (m) return { ok: true, action: { type: "lens", lens: Number(m[1]) }, label: `Lens ${m[1]}` };
  const n = findNode(r, text.replace(/^(focus|find|go to)\s+/i, ""));
  if (n) return { ok: true, action: { type: "focus", nodeId: n.id }, label: `Focus ${n.name}` };
  return { ok: false, message: "That command isn't supported. Try one of the suggestions." };
}
