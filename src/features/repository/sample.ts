// The built-in sample repository. It is created by running ordinary commands
// through the engine, so its objects are exactly what the lab would produce.

import { apply } from "./engine";
import type { RepositoryCommand, RepositoryState } from "./types";

export const SAMPLE_TIME = 1767225600; // 2026-01-01T00:00:00Z

const README_V1 = "# my-first-repository\n\nA tiny project for exploring Git.\n";
const README_V2 = README_V1 + "\n## Run it\n\n    node src/app.js\n";
const PACKAGE = '{\n  "name": "my-first-repository",\n  "version": "1.0.0",\n  "main": "src/app.js"\n}\n';
const APP = 'const { greet } = require("./utils/format");\n\nconsole.log(greet("GitPrism"));\n';
const FORMAT = "function greet(name) {\n  return `Hello, ${name}!`;\n}\n\nmodule.exports = { greet };\n";
const FORMAT_SHOUT =
  "function greet(name) {\n  return `Hello, ${name}!`;\n}\n\nfunction shout(text) {\n  return text.toUpperCase();\n}\n\nmodule.exports = { greet, shout };\n";

export function emptyRepository(name = "my-first-repository"): RepositoryState {
  return { name, worktree: {}, index: {}, objects: {}, branches: {}, head: { type: "symbolic", ref: "main" } };
}

export function runAll(state: RepositoryState, commands: RepositoryCommand[]): RepositoryState {
  return commands.reduce((s, cmd) => {
    const r = apply(s, cmd);
    if (!r.ok) throw new Error(`Sample setup failed on ${cmd.type}: ${r.error}`);
    return r.state;
  }, state);
}

let cached: RepositoryState | null = null;

/** Same state every time: main has three commits, feature/shout branches from the second. */
export function createSampleRepository(): RepositoryState {
  if (cached) return cached;
  let s = runAll(emptyRepository(), [
    { type: "CREATE_FILE", path: "README.md", content: README_V1 },
    { type: "CREATE_FILE", path: "package.json", content: PACKAGE },
    { type: "STAGE_PATHS", paths: ["README.md", "package.json"] },
    { type: "COMMIT", message: "Initial commit", timestamp: SAMPLE_TIME },
    { type: "CREATE_FILE", path: "src/app.js", content: APP },
    { type: "CREATE_FILE", path: "src/utils/format.js", content: FORMAT },
    { type: "STAGE_PATHS", paths: ["src/app.js", "src/utils/format.js"] },
    { type: "COMMIT", message: "Add app.js", timestamp: SAMPLE_TIME + 3600 },
  ]);
  const c2 = s.branches.main;
  s = runAll(s, [
    { type: "CREATE_BRANCH", name: "feature/shout", at: c2 },
    { type: "SWITCH_BRANCH", name: "feature/shout" },
    { type: "EDIT_FILE", path: "src/utils/format.js", content: FORMAT_SHOUT },
    { type: "STAGE_PATHS", paths: ["src/utils/format.js"] },
    { type: "COMMIT", message: "Add shout helper", timestamp: SAMPLE_TIME + 5400 },
    { type: "SWITCH_BRANCH", name: "main" },
    { type: "EDIT_FILE", path: "README.md", content: README_V2 },
    { type: "STAGE_PATHS", paths: ["README.md"] },
    { type: "COMMIT", message: "Update README", timestamp: SAMPLE_TIME + 7200 },
  ]);
  cached = s;
  return s;
}
