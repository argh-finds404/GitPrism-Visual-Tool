# GitPrism

Git makes sense when you can see it. GitPrism is an interactive, visual way to understand what Git stores: blobs, trees, commits, snapshots and history, and what a code change actually affects.

## Run it locally

Requires Node.js 20 or newer (developed on Node 22).

```bash
npm install
npm run dev
```

Then open the address printed in the terminal (usually http://localhost:3000):

| Page | URL |
| --- | --- |
| Homepage | http://localhost:3000 |
| Lab workbench | http://localhost:3000/lab |
| PR Impact Studio | http://localhost:3000/review/gitprism-demo/acme-shop/pull/42 |
| TimeFold | http://localhost:3000/timefold/gitprism-demo/acme-shop |
| MergeLab | http://localhost:3000/mergelab/gitprism-demo/acme-shop |

No page needs a database yet. The Prisma schema is ready for when accounts or sync are added; to use it later, copy `.env.example` to `.env` and set `DATABASE_URL`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` then `npm start` | Production build and server |
| `npm test` | Unit and integration tests (Vitest) |
| `npm run lint` | ESLint |

## Pages

| Route | What it is |
| --- | --- |
| `/` | Story-driven landing page: 3D prism hero, then file → blob → tree → commit, a live snapshot demo, diffs, a history graph and content addressing |
| `/lab` | Workbench: edit files, stage, commit, branch, inspect objects, compare, replay and guided challenges |
| `/review/[owner]/[repo]/pull/[number]` | Impact Studio: what a pull request affects, across five 3D lenses, with evidence-backed findings |
| `/mergelab/[owner]/[repo]` | MergeLab: a three-way merge workspace. Conflicts with base, ours and theirs, a semantic diff lens, a conflict constellation, resolution cards with undo and notes, then validation (parse, strict type check, tests) and patch export |
| `/timefold/[owner]/[repo]` | TimeFold: travel through history. Function DNA follows one function commit by commit, Architecture drift replays the codebase graph, Regression hunt bisects with real test runs |

The lab is local-first. It saves the actions you took in IndexedDB and rebuilds the repository by replaying them over the built-in sample, so a refresh never loses work. **Reset lab** clears it.

The Impact Studio and TimeFold share a bundled fixture project, `gitprism-demo/acme-shop`: 13 commits on `main` (including a rename and a regression that is later fixed), then the 4 commits of PR #42 on `feat/auth`, plus a competing branch, `feat/sliding-sessions`, by a second author. Merging it into `feat/auth` gives three real conflicts around `validateSession`. The Studio analyses the PR in the browser; TimeFold analyses every commit against its parent. Other repositories need a GitHub or GitLab provider, which isn't connected yet; those URLs say so instead of showing invented data.

### What is real and what is simulated

Real: blob, tree and commit objects are encoded byte-for-byte like Git, so their IDs match `git hash-object`. The tests rebuild the sample histories (including all 17 fixture commits) with real `git` and compare every ID. The Studio's and TimeFold's imports, calls, tests, cycles and layer violations come from parsing the fixture's actual source. TimeFold links a rename only when parameters and body are identical. Regression hunt really runs the chosen test: `POST /api/repos/:owner/:repo/run-test` strips the TypeScript with Node's built-in stripper and executes the committed fixture code in a fresh `node:vm` context with a 1-second limit. It accepts only fixture commit IDs and test names, never code.

MergeLab's three-way merge is a diff3 with Git's default (zealous) refinements. The tests check it is byte-identical to `git merge-file` on the fixture and on 102 historical combinations, that the merge base matches `git merge-base`, and that the exported patch applies with `git apply`. Validation never executes code on the server: `POST /api/repos/:owner/:repo/merge-check` only parses (Node's TypeScript stripper) and type-checks (the TypeScript compiler, in memory). Tests run in a disposable Web Worker in your browser. Type errors that already exist on `feat/auth` are told apart from those the merge introduces. The merge commit shown after validation is computed, never written; nothing changes a branch.

Simulated: the lab's working tree and index live in memory, and there is no merging, packing, remotes or `.git` directory. The Studio's Agent Hub uses built-in rules; live MCP connections need a server-side bridge that isn't included.

## Analysing your own project

`/analyze` reads a folder you pick and reports its structure: the dependency graph, import
cycles, imports that resolve to nothing, and the files everything leans on.

**It is read in your browser.** The files are parsed with the same analyser the Studios use, in
the tab, and are not uploaded. The limits are 400 source files and 2 MB; `node_modules`, build
output and anything matching a secret pattern (`.env*`, `.pem`, `.key`) are skipped before being
read, and the result states exactly what it left out.

**Nothing you upload is executed.** The analyser only parses. The one thing this application ever
runs is its own bundled fixture — see "Executing repository code" below. That is why an uploaded
project gets structural analysis and not ChangeVerse or ProofGraph, which need to run tests.

Because there is no "before" to compare against, an uploaded project is analysed as a single
snapshot: structure, not a diff.

### Saving a project (optional, needs a database)

"Save and get a link" is a separate, explicit step that uploads the source to the deployment's
Postgres so it can be reopened at `/analyze/<id>`. Saved projects expire after 7 days. The server
re-applies the same source-only, no-secrets, size-limited rules rather than trusting the client.

Without `DATABASE_URL`, everything above still works; only saving returns 503 and says so.

```bash
cp .env.example .env            # then point DATABASE_URL at any Postgres
npx prisma migrate deploy       # applies prisma/migrations
```

## Executing repository code

Three features run real code to produce real results: TimeFold's regression hunt, ChangeVerse's
preflight and ProofGraph's evidence collection. What keeps that safe is worth stating precisely,
because it is easy to assume the wrong thing.

**The control that matters is upstream, not the sandbox.** Every route accepts an identifier and
nothing else — a commit ID, a test name, a candidate ID — and resolves it against the bundled
fixture on the server. No request can carry code, a path or file contents. Only source already
committed to this repository is ever executed.

**`node:vm` is not a security boundary.** Node's own documentation says so, and this project does
not treat it as one. It is a convenience for collecting results, not a jail.

Within that, several measures are defence in depth, each covered by `src/tests/sandbox.test.ts`.
The governing idea is that **every value crossing into the context is a way out of it**, because
a host object's `.constructor` reaches the host realm's `Function` and compiles code there.

- **Values passed in** have their prototypes severed. Functions stay callable; they lose
  `.constructor`. Before this, a test body could read `process`, `fs` and the whole environment
  through `expect`, `console`, `require` or its own `exports`.
- **The global itself** is severed, because the sandbox object handed to `vm.createContext`
  becomes the context's global — so `globalThis.constructor` was the host realm's `Object`.
- **Errors travelling outward** are rebuilt inside the context. An unresolved import, a module
  that will not compile, a failed assertion and a refused file all threw *host* errors that test
  code could catch and compile through.
- **Only source modules load.** This is an allowlist (`.ts`, `.tsx`, `.js`, `.jsx`, minus
  secrets), not a list of secrets to refuse. The denylist leaked: any commit file whose contents
  happened to parse as JavaScript could be imported and read back, including `id_rsa`, `.npmrc`
  and `credentials.json`.
- **A one-second wall-clock limit** covers module bodies, the test body **and microtasks**. The
  context is created with `microtaskMode: "afterEvaluate"`, which drains the microtask queue
  inside the evaluation. Without it the watchdog bounds synchronous code only, and
  `Promise.resolve().then(() => { while (true) {} })` blocks the event loop indefinitely.
- **Each run gets its own context and module cache**, so nothing one run does reaches the next.

### What is still not solved

These are real and unfixed. They are listed here rather than mitigated because fixing them
properly means moving execution out of this process, not adding another guard inside it.

**Memory is not capped.** A run can allocate until the server's heap is gone; 600 MB inside the
context raised no error in testing. `--max-old-space-size` is process-wide, so the sandbox
competes with the server itself. There is no in-process way to bound this.

**An unhandled rejection still reaches the host process**, where Node's default is to terminate
it. It cannot be contained from inside a synchronous runner, and that was verified rather than
assumed: detection happens after `runFixtureTest` has returned, so a handler scoped around the
run never fires, and a process-global handler would change behaviour for every unrelated
request. Next.js does not remove the default listeners either — it offers
`removeUncaughtErrorAndRejectionListeners`, which is experimental and off.
What keeps this unreachable today is the fixture: no executable file in any fixture commit
contains `async`, `await`, `Promise` or `.then(`, and a test asserts it, so adding any would
fail the suite before it could reach a server.

**Execution blocks the event loop** for as long as a test runs, up to one second each, and runs
are serialised. ChangeVerse executes roughly eight tests per request.

### Why not a child process yet

A child process or worker is the right answer to all three and was evaluated. It was not taken
in this pass because `runFixtureTest` is synchronous and three engines (`preflight`,
`collectEvidence`, `fixtureSessions`) plus their routes and pages consume it synchronously;
making it asynchronous ripples through all of them. Keeping the signature with `spawnSync` would
mean either serialising the harness functions into the child, which breaks under the minifier,
or duplicating them in a standalone script that Next's bundler does not own — drift and
deployment fragility in exchange for a boundary the fixture does not yet need.

**Before any non-fixture code runs**, that boundary becomes mandatory, and the in-process
measures above stop being the interesting part: a separate process or container with enforceable
CPU, memory, process-count, filesystem and network limits, and kill-on-timeout at the process
level. Prototype severing and `microtaskMode` are not substitutes for any of it.

**MergeLab is a different threat model.** It validates hand-edited code, so it never executes
anything on the server — parsing and type-checking only (`POST …/merge-check`). Tests run in a
disposable Web Worker in your own browser: a fresh worker per test, terminated after two seconds.
There is no host realm to escape to there, because the worker *is* the realm; it cannot touch the
page or the DOM. What it can still reach is anything same-origin, including `fetch`. That is
acceptable while the code being run is your own edits to your own merge, and it is the thing to
revisit first if candidates ever arrive from somewhere else.

## Architecture

```
Browser
 ├─ Homepage sections ──────────────┐
 ├─ Lab workbench (React Flow) ─────┼─▶ lib/git.ts  (SHA-1, Git object encoding, line diff)
 └─ Impact Studio (R3F, five lenses)│
                                    │
features/repository  ───────────────┘   commands → pure engine → immutable objects
   RepositoryProvider  one source of truth for every lab panel
   session.ts          replays recorded commands (undo, replay, persistence)
   storage.ts          IndexedDB behind a swappable interface (database later)

features/mergelab
   diff3.ts            three-way line merge, refined like Git's zealous level
   merge.ts            tree-level merge, resolutions, candidate buffer, patch export
   semantic.ts         conflict placement, constellation, semantic lens, impact preview
   checks.ts           parse and strict type check (server only, never executes)

features/testing
   harness.ts          module transform, expect, and the runner used by both test paths

features/timefold
   history.ts          per-commit snapshots, symbol lineage (exact renames), Function DNA, commit stories
   test-runner.ts      runs one fixture test at one commit (server only)
   bisect.ts           git-bisect state machine with skips and ambiguity

features/impact-analysis
   fixture.ts          a real TypeScript project + PR, committed with the engine
   source-analysis     imports, functions, calls, test cases
   analysis-service    diff → parse → canonical graph → impact → findings (versioned)
   blast-radius        BFS over reverse calls/imports, with paths
   architecture-rules  configured layers + Tarjan cycle detection
   evidence            facts / static warnings / hypotheses, each with locations
   context-packager    token-budgeted Markdown, secrets never included

components/impact-studio
   store.tsx           selection, lens, filters; the analysis result is the only data
   lens-layouts.ts     five deterministic projections of one graph
   scene/              WebGL scene + SVG fallback, both from the same projection
   hud/                the six panels
```

Rules the code follows: UI components never mutate data directly (commands do); every lens, panel and finding reads the same versioned analysis; nothing shown is invented.

## Project layout

```
src/
  app/                    routes, layout, global design tokens
  components/
    brand/ site/ ui/      wordmark, nav, footer, shared pieces
    sections/             one file per homepage section
    lab/                  homepage snapshot-demo state
    workbench/ explorer/ graph/ inspector/ timeline/ diff/   the /lab workbench
    impact-studio/        the PR Impact Studio
    three/                WebGL prism scenes
  features/
    repository/           Git engine, session replay, storage
    impact-analysis/      PR analysis pipeline
  lib/                    git.ts, sample.ts, chapters.ts, theme.ts, graph builders, prisma client
  tests/                  Vitest suites (several compare against real git)
prisma/schema.prisma      Workspace, GitObject, Ref
```

## Components from registries

`components.json` registers the Skiper UI registry, so `npx shadcn add @skiper-ui/<name>` works here.
Installed components land in `src/components/ui/skiper-ui/`.

Two are in use, both adapted rather than taken as shipped:

| Component | Used for | What changed |
| --- | --- | --- |
| `skiper101` | Tooltips on object IDs (`src/components/ui/InfoTip.tsx`) | Kept the border-drawn arrow; mapped shadcn's colour tokens onto this project's and replaced the tailwindcss-animate classes with a keyframe in `globals.css` |
| `skiper106` | The animated caret on text inputs | Kept the caret measuring technique; dropped `dialkit` (a developer control panel drove its font size and spring) and `framer-motion` (this project already uses `motion`), and moved a module-level `navigator` read inside the component so pages still prerender |

Re-running `shadcn add` with `--overwrite` restores the registry's demo versions and undoes those adaptations.

**Pro components.** `skiper72`, `skiper86` and `skiper103` are Skiper UI Pro: the registry answers
`401 Missing license key` without one. To install them, add your key to `.env.local`:

```
SKIPER_UI_LICENSE=your-key
```

then give the registry the header in `components.json`:

```json
"registries": {
  "@skiper-ui": {
    "url": "https://skiper-ui.com/r/{name}.json",
    "headers": { "Authorization": "Bearer ${SKIPER_UI_LICENSE}" }
  }
}
```

## Design system

Dark-first ("Spectral Night"), with a light "Porcelain" theme. Tokens live in `src/app/globals.css`.

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| Canvas | `#08070F` | `#F6F5FB` | Page background |
| Surface | `#151126` | `#FFFFFF` | Panels and cards |
| Ink | `#F5F2FF` | `#14111F` | Primary text |
| Prism Violet | `#9B7BFF` | `#6D4AE8` | Primary actions, commits |
| Signal Cyan | `#3EE0FF` | `#12B4D6` | Blobs, imports |
| Aurora Green | `#4BE3A6` | `#0F8A5F` | Trees, additions |
| Hot Magenta | `#FF5CB8` | `#E0458F` | Changes, impact |
| Solar Amber | `#FFC15C` | `#D98A12` | References, history |

The five accent colours are the prism's spectrum: each one carries a fixed meaning, always paired with a shape (commit diamond, tree square, blob circle, reference pill).

Type: **Martian Mono** (narrowed with its width axis) for headlines, so every heading reads like a commit message; **Space Grotesk** (variable, bundled in `src/app/fonts/`) for body text and interface; **JetBrains Mono** for hashes, commands and diffs.

The homepage is written as a log. Each chapter heading carries a real blob ID (`echo "chapter 1: the problem" | git hash-object --stdin`), a commit graph on the right edge marks the chapter in view on wide screens, and the footer lists the chapters as `git log --oneline --reverse`. The tests check these IDs against real git.
