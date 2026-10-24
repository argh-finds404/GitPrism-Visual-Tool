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

The lab is local-first. It saves the actions you took in IndexedDB and rebuilds the repository by replaying them over the built-in sample, so a refresh never loses work. **Reset lab** clears it.

The Impact Studio analyses a bundled fixture project (`gitprism-demo/acme-shop`, PR #42) in the browser. Other repositories need a GitHub or GitLab provider, which isn't connected yet; those URLs say so instead of showing invented data.

### What is real and what is simulated

Real: blob, tree and commit objects are encoded byte-for-byte like Git, so their IDs match `git hash-object`. The tests rebuild the sample histories with real `git` and compare every ID. The Studio's imports, calls, tests, cycles and layer violations come from parsing the fixture's actual source.

Simulated: the lab's working tree and index live in memory, and there is no merging, packing, remotes or `.git` directory. The Studio's Agent Hub uses built-in rules; live MCP connections need a server-side bridge that isn't included.

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
  lib/                    git.ts, sample.ts, theme.ts, graph builders, prisma client
  tests/                  Vitest suites (several compare against real git)
prisma/schema.prisma      Workspace, GitObject, Ref
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

Type: **Bricolage Grotesque** (variable, optical sizing) for headlines and interface, **JetBrains Mono** for hashes, commands and diffs.
