# GitPrism ⬡

> **Git makes sense when you can see it.**  
> GitPrism refracts monolithic code changes and version control internals into intuitive, interactive visual lenses — from raw byte-level content addressing to multi-lane commit DAGs, architectural blast radiuses, and semantic 3-way merge resolution.

---

## ⚡ Quickstart: Run GitPrism Locally

### Prerequisites
- **Node.js 20 or newer** (tested on Node 22+)
- **npm** or compatible package manager

### 1. Clone & Install
```bash
git clone https://github.com/argh-finds404/GitPrism-Visual-Tool.git
cd GitPrism
npm install
```

### 2. Launch Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Key Scripts
| Command | What it does |
| --- | --- |
| `npm run dev` | Starts local Next.js dev server with hot reload |
| `npm test` | Runs the full Vitest suite (192 unit and integration tests) |
| `npm run lint` | Runs ESLint type checks and linting rules |
| `npm run build` | Compiles an optimized Turbopack production bundle |
| `npm start` | Runs the compiled production server |

*Note: GitPrism is local-first and does not require an external database to run. All parsing, visualization, and sandboxing happen in-browser.*

---

## 💭 Developer Perspective

> *"I wanted to bridge the gap between how developers write code and how Git stores and refracts architecture under the hood. So I built GitPrism—a local-first developer platform with a custom Git loose-object parser running over browser Web Streams.*
>
> *Rather than relying on server-side Git binaries, it decompresses zlib objects in the client, constructs a topological DAG with multi-lane Bézier routing, and parses TypeScript ASTs to identify circular dependencies and blast radius choke-points.*
>
> *For privacy and performance, I architected it as a hybrid local-first system: zero source code leaves the device by default, persisting in IndexedDB with portable `.gitprism.json` bundle exports, with an optional 7-day TTL cloud share powered by Prisma and PostgreSQL. The entire core is validated by a 192-test suite asserting parity against real Git CLI hash outputs."*

### Why This Project Matters to Me
Most developers interact with Git dozens of times every day, yet for many, version control remains an opaque black box—a series of memorized terminal commands executed with a lingering fear of breaking history or getting trapped in a painful merge conflict.

GitPrism was born out of a desire to make the invisible visible. It isn't just another Git GUI or a shallow wrapper around a shell binary; it is an in-depth exploration of software craftsmanship:
- **Demystifying the Engine:** Proving that Git's internals are an elegant, immutable content-addressed directed acyclic graph that anyone can intuitively grasp when given the right spatial mental model.
- **Bridging Git with Architecture:** Connecting raw commit diffs with TypeScript & JavaScript AST dependency graphs so engineers can immediately see the true blast radius of their changes.
- **Respecting Developer Privacy:** Demonstrating that deep developer tools can run 100% offline inside the user's browser without harvesting or uploading proprietary source code to remote servers.

---

## 💡 What Problem Does GitPrism Solve?

### The Black-Box CLI Paradox
For millions of developers, Git is an indispensable tool mastered through rote memorization (`git commit`, `git push`, `git rebase -i`, `git cherry-pick`). Yet few developers ever *see* what Git actually stores. Because the terminal presents Git as a black box of cryptic commands, simple mistakes lead to fear of breaking history or painful merge conflict nightmares.

### Why Existing Git GUIs Fall Short
Traditional Git GUI clients (such as GitHub Desktop, Sourcetree, or GitKraken) treat Git as a flat list of commit messages and textual line diffs. They don't solve the core conceptual and architectural gaps:

1. **They don't explain the underlying object store:** They hide the fact that Git is simply a content-addressed directed acyclic graph (DAG) of immutable `blobs`, `trees`, and `commits`.
2. **They don't show architectural blast radius:** Traditional diff viewers show that lines 42–58 changed in `auth.ts`, but they cannot tell you which downstream modules import that file, which exported functions broke, or whether existing test suites cover the change.
3. **Merge conflict tools are blind to semantics:** Standard 3-way diff tools only display text blocks with `<<<<<<< HEAD` markers without verifying whether your resolution compiles, breaks caller types, or passes tests before you commit.
4. **They require cloud uploads or native installations:** Web-based analysis tools often require sending proprietary code to remote servers.

### The GitPrism Solution
GitPrism works like an optical prism for your codebase. White light enters; a spectrum of structured, spatial insight comes out:
- **100% In-Browser Privacy:** Local Git repositories and `.git` loose objects are decompressed client-side using native Web Streams (`DecompressionStream("deflate")`). Your code never leaves your computer.
- **Visual Mental Models:** Live, interactive sandboxes let you stage files, inspect generated SHA-1 hashes, and watch commit trees assemble in real-time.
- **Architectural Impact Radar:** Every commit is cross-referenced with AST import graphs, revealing downstream dependent files, impacted symbols, and test coverage shields.
- **Semantic Three-Way MergeLab:** Visual conflict constellations paired with isolated in-browser Web Worker test execution.

---

## 🧭 A Guided Exploration Path (Recommended Tour)

If you are exploring GitPrism for the first time or evaluating its design and functionality, here is a welcoming, self-paced sequence to experience the full platform:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       RECOMMENDED APP WALKTHROUGH                           │
└─────────────────────────────────────────────────────────────────────────────┘

  Stage 1: Foundational Mental Model
  ▶ Homepage (`/`)
    ├── Optical Prism Hero: 3D interactive WebGL light refraction
    ├── Chapter 2: The Reveal (`#how`): scroll through file → blob → tree → commit
    ├── Interactive Snapshot Lab (`#playground`): edit files, stage into index, watch DAG form
    ├── Content Addressing (`#learn`): live SHA-1 hash calculator proving identity from content
    └── 5-Stage Journey (`#journey`): scroll-driven progression through Git internals

  Stage 2: Hands-On Interactive Sandbox
  ▶ The Workbench Lab (`/lab`)
    ├── Safe, risk-free sandbox with an in-memory filesystem and Git object inspector
    ├── Edit files, stage, commit, branch, compare snapshots, and solve guided challenges
    └── Actions automatically persisted locally in your browser's IndexedDB

  Stage 3: Personal Project Architecture & Git Studio
  ▶ Local-First Architecture Studio (`/analyze`)
    ├── Drop any local repository folder or `.gitprism.json` bundle directly onto the window
    ├── Explore real multi-lane Git branch DAGs with smooth bezier curves
    ├── Inspect exact `+add / -del` diff counters and 5-block proportional diff meters
    ├── Explore recursive directory trees with search filter and instant inline code previews
    ├── Check the Impact Radar for blast radius, downstream dependents, and test coverage
    └── 1-click export of ARCHITECTURE.md dossiers and portable .gitprism.json bundles

  Stage 4: Specialized Production Studios
  ▶ PR Impact Studio (`/review/gitprism-demo/acme-shop/pull/42`)
    └── Inspect PR blast radius, affected callers, and test impacts across 5 interactive 3D lenses
  ▶ MergeLab (`/mergelab/gitprism-demo/acme-shop`)
    └── 3-way merge workspace with conflict constellations, diff3 resolution, and in-worker test validation
  ▶ TimeFold (`/timefold/gitprism-demo/acme-shop`)
    └── Travel through history, track function DNA evolution, and bisect regressions with real test runs
```

---

## 🛠️ Key Surfaces & Features

### 1. Interactive Landing Page (`/`)
- **Interactive Prism Hero:** A real-time 3D optical simulation using Three.js / React Three Fiber illustrating how monolithic source code refracts into distinct architectural dimensions.
- **Chapter Storyline:** Real Git blob IDs for chapter headings (verifiable via `echo "<line>" | git hash-object --stdin`).
- **Interactive Snapshot Demo:** Edit sample files, stage them into the index, and observe tree and commit object creation live.
- **SHA-1 Content Addressing Calculator:** Enter text to see how Git formats headers (`blob <length>\0<content>`) and generates immutable 40-character SHA-1 hashes.
- **Scroll-Driven Journey:** A sticky, responsive chapter progression through the 5 foundations of Git architecture.

### 2. The Workbench Sandbox Lab (`/lab`)
- **In-Memory Git Engine:** Experiment freely with `commit`, `branch`, `checkout`, and `reset` without touching your terminal or disk.
- **Interactive DAG Inspector:** Click any node to inspect raw object bytes, tree pointer hashes, and parent references.
- **Guided Challenges:** Step-by-step challenges that teach branching strategies, detached HEAD states, and commit resets.
- **Offline Persistence:** Actions are recorded and saved locally in browser IndexedDB, replaying automatically across page refreshes.

### 3. Personal Repository Studio (`/analyze`)
- **Drag-and-Drop Ingestion:** Drop any project folder containing a `.git` directory directly into the browser.
- **Hybrid Local-First Architecture:**
  - **100% Private Offline Vault:** Source files and Git commits are safely persisted inside your device's browser IndexedDB (`idb-keyval`). Zero source code ever touches a remote server without explicit consent.
  - **Portable Workspace Bundles:** 1-click export of your complete workspace into a lightweight `.gitprism.json` bundle containing your code AST and Git commit DAG for zero-cloud teammate collaboration.
  - **Opt-in Cloud Sharing:** Optional 7-day temporary share links (powered by PostgreSQL & Prisma at `/api/projects`) that auto-prune upon expiry for frictionless remote reviews.
- **Multi-Lane SVG Git DAG:** Automatically renders concurrent branches and merge joins on color-coded tracks (`#8B5CF6`, `#06B6D4`, `#F59E0B`, `#EC4899`, `#10B981`) with smooth cubic bezier curves and pulsating HEAD markers.
- **5-Tab Commit Inspector:**
  - **Overview:** SHA-1 hash, root tree ID, author details, timestamp, and clickable parent commit navigation.
  - **Message:** Full commit message with 1-click copy.
  - **Changes:** Unified and split diff modes, line addition/deletion statistics, and GitHub-style 5-block diff meters.
  - **Snapshot Tree:** Full recursive directory tree with live search filtering, expand/collapse controls, and instant inline code preview.
  - **Impact Radar:** Cross-references diffs against AST import graphs, rating blast radius (*Isolated*, *Low*, *Moderate*, *High*, *Critical*) and listing downstream importing files, affected functions, and test coverage shields.
- **Architectural Choke-Points:** Analyzes high fan-in modules (`importedBy >= 3`) and circular dependency cycles.
- **1-Click Dossier Export:** Generates a production-ready `ARCHITECTURE.md` complete with dependency tables and contributor stats.

### 4. PR Impact Studio (`/review/...`)
- **Five Interactive 3D Lenses:** Visualize a pull request across *Blast Radius*, *Dependency Topology*, *Execution Call Graph*, *Test Coverage*, and *Layered Architecture*.
- **Evidence-Backed Findings:** Automated static facts, warnings, and architectural hypotheses linking directly to source line numbers.

### 5. MergeLab (`/mergelab/...`)
- **Three-Way Diff3 Engine:** Byte-identical to `git merge-file` across historical combinations.
- **Conflict Constellation:** Visual spatial layout of conflicting chunks between `base`, `ours`, and `theirs`.
- **In-Browser Web Worker Validation:** Validates merge resolutions inside a disposable browser Web Worker, type-checking and running tests before you finalize the merge.

### 6. TimeFold (`/timefold/...`)
- **Function DNA Tracker:** Follows individual function implementations across every commit in history, tracking renames, parameter mutations, and signature changes.
- **Regression Bisecting:** Visual `git bisect` runner that executes committed fixture code in an isolated `node:vm` context to find exact breaking commits.

---

## 🧰 Technology Stack

| Layer | Technologies | Purpose |
| --- | --- | --- |
| **Framework** | Next.js 16 (App Router, Turbopack, Partial Prerendering) | High-performance server rendering & static page generation |
| **Language** | TypeScript (Strict Mode) | End-to-end type safety across Git engines, AST parsers, and UI |
| **3D & Graphics** | Three.js, React Three Fiber, WebGL, SVG | Interactive optical prism simulations & multi-lane branch DAGs |
| **Styling** | Tailwind CSS + Obsidian Dark CSS Variables | Curated dark-first design system (`--paper`, `--surface`, `--ink`, `--violet`, `--cyan`, `--amber`) |
| **Git Engine** | Custom Web Streams decompression (`git-reader.ts`) | Decompresses zlib loose objects in-browser with zero native binaries |
| **Execution** | Web Workers & `node:vm` isolated runners | Safe, client-side test execution and merge validation |
| **Local & Hybrid Storage**| IndexedDB (`idb-keyval`) + Prisma/PostgreSQL + `.gitprism.json` bundles | Hybrid local-first storage with zero-leak privacy & opt-in 7-day cloud sharing |
| **Testing** | Vitest | 192 unit and integration tests validating Git hash parity and AST analysis |

---

## 🔌 Model Context Protocol (MCP) & AI Engineering Toolchain

GitPrism was designed and engineered with the assistance of the **Model Context Protocol (MCP)**, connecting agentic pair-programming workflows to specialized domain knowledge servers:

| MCP Server | Domain & Focus | Role in GitPrism's Development |
| :--- | :--- | :--- |
| **`threejsresources`** | 3D Graphics & WebGL Shaders | Guided optical light physics, chromatic dispersion math, and Three.js / React Three Fiber scene optimizations for the interactive landing hero. |
| **`shadcn`** | Accessible Design Primitives | Informed keyboard-first accessibility, focus trap management, and headless HUD overlay component structures. |
| **`21st`** | Design Inspiration & Craft | Provided design system references for the bespoke obsidian dark palette (`--paper`, `--surface`, `--ink`, `--violet`, `--cyan`, `--amber`) and fluid micro-animations. |
| **`prisma-cli`** | Database & Migration Engine | Governed Prisma ORM 7 configuration, SQL migrations, connection adapter setups, and TTL-based cloud project sharing. |
| **`perplexity-ask`** | Live Technical Research | Verified low-level Git object formats (raw loose object binary byte framing, SHA-1 checksum parity) and Next.js 16 Partial Prerendering APIs. |
| **`kodza`** | UI Component Architecture | Assisted with structured SVG icon taxonomy, workspace layouts, and clean HUD action groupings. |

---

## 📐 Project Structure

```
GitPrism/
├── src/
│   ├── app/                      # Next.js App Router pages and global tokens
│   ├── components/
│   │   ├── brand/                # Wordmarks, navigation bars, and theme selectors
│   │   ├── sections/             # Homepage chapters (Prism Hero, Snapshot Lab, Journey)
│   │   ├── upload/               # Personal project upload, Multi-Lane DAG & Commit Inspector
│   │   ├── workbench/            # Interactive Sandbox Lab panels and graph nodes
│   │   ├── impact-studio/        # 3D PR Impact Studio lenses and HUD controls
│   │   ├── mergelab/             # 3-Way MergeLab workspace and conflict constellation
│   │   └── timefold/             # TimeFold history tracker and bisect runner
│   ├── features/
│   │   ├── upload/               # Git object decompression, project vault & serialization
│   │   ├── impact-analysis/      # AST parsing, import graph builder & blast radius engine
│   │   ├── mergelab/             # Diff3 algorithm, conflict solver & worker checks
│   │   └── timefold/             # Function DNA history & bisect state machine
│   └── tests/                    # Vitest test suites (byte-for-byte real git assertions)
├── prisma/                       # Database schema (optional persistence layer)
└── README.md
```

---

## 🔒 Privacy & Security First

- **No Remote File Uploads:** All files picked in `/analyze` are parsed directly inside your browser tab using Web Streams. No project code is transmitted to remote servers.
- **Sandboxed Test Runs:** Merge validations run in ephemeral, disposable Web Workers isolated from the DOM and host environment.
- **Zero Third-Party Tracking:** No ad trackers, no telemetry scripts, and no external font requests.

---

## 📄 License

GitPrism is open-source under the [MIT License](LICENSE).
