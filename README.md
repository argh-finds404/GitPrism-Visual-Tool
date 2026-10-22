# GitPrism

Git makes sense when you can see it. GitPrism is an interactive, visual way to understand what Git stores: blobs, trees, commits, snapshots and history.

## Stack

- Next.js 16 (App Router, Turbopack, Cache Components) + React 19 + TypeScript
- Tailwind CSS v4 with a small token system in `src/app/globals.css`
- React Three Fiber + drei for the 3D prism, Motion for React for UI motion
- PostgreSQL + Prisma 7 (driver adapter `@prisma/adapter-pg`)

## Getting started

```bash
npm install
cp .env.example .env   # then set DATABASE_URL
npm run dev
```

No page needs a database yet: the lab stores its work in the browser. The Prisma schema is ready for when accounts or sync are added.

## Pages

| Route  | What it is |
| ------ | ---------- |
| `/`    | Landing page: 3D prism hero and the scroll story of file, blob, tree, commit |
| `/lab` | Workbench: edit files, stage, commit, branch, inspect objects, compare, replay, guided challenges |

The lab is local-first. It saves the list of actions you took in IndexedDB and rebuilds the repository by replaying them over the built-in sample, so a refresh never loses work. **Reset lab** clears it.

### What is real and what is simulated

Real: blob, tree and commit objects are encoded byte-for-byte like Git, so their IDs match `git hash-object` (the test suite rebuilds the sample history with real `git` and compares every ID). Simulated: the working tree and index live in memory, and there is no merging, packing, remotes or `.git` directory.

## Tests

```bash
npm test
```

Vitest covers hashing against real `git`, staging and commit rules, branch switching, persistence validation and graph construction.

## Project layout

```
src/
  app/                 layout, global tokens, homepage
  components/
    brand/             prism mark and wordmark
    site/              navigation and footer
    sections/          one file per homepage section
    lab/               homepage snapshot-demo state (lab + diff sections)
    workbench/         /lab shell, header, UI state, shared bits
    explorer/          file tree, object list, refs, file editor
    graph/             React Flow canvas and node renderers
    inspector/         Prism Lens object inspector
    timeline/          changes, history, compare, replay, explain
    diff/              line diff renderer
    three/             WebGL prism scene
    ui/                shared pieces (chapter heading)
  features/repository/
    engine.ts          pure repository commands (stage, commit, branch, ...)
    session.ts         rebuilds every step from recorded commands
    storage.ts         IndexedDB persistence behind a swappable interface
    RepositoryProvider the single source of truth for every panel
  lib/
    graph/             history, object and refraction graph builders
    git.ts             Git-compatible SHA-1, blob/tree/commit hashing, line diff
    sample.ts          sample repository used by the story sections
    theme.ts           light/dark theme with view-transition reveal
    prisma.ts          Prisma client (server only)
prisma/schema.prisma   Workspace, GitObject, Ref
```

Every object ID shown on the site is computed from real Git object bytes and matches `git hash-object`.

## Design system

| Token        | Value     | Use                               |
| ------------ | --------- | --------------------------------- |
| Prism Violet | `#7654E8` | Primary actions, active states    |
| Electric Lilac | `#B6A0FF` | Highlights, glow                |
| Deep Ink     | `#191720` | Headings, dark sections           |
| Warm Ivory   | `#F8F7F4` | Page background                   |
| Cool Mist    | `#E9E6EF` | Borders, neutral surfaces         |
| Signal Cyan  | `#68D9F5` | 3D and graph accents              |

Type: Instrument Serif (display), Geist (interface), Geist Mono (hashes, commands, diffs).
