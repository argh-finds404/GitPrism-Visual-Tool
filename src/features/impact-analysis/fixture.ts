// A small, real TypeScript project and a pull request against it. The commits
// are created with the GitPrism repository engine, so every commit ID is the
// genuine SHA-1 of a Git commit object. Labelled as a fixture everywhere it shows.

import { apply, blobContent, commitFiles, getCommit } from "@/features/repository/engine";
import { emptyRepository } from "@/features/repository/sample";
import type { RepositoryCommand, RepositoryState } from "@/features/repository/types";
import type { Layer, LayerRule } from "./types";

export const FIXTURE = {
  owner: "gitprism-demo",
  repo: "acme-shop",
  number: 42,
  title: "Cache sessions and rotate tokens",
  source: "feat/auth",
  target: "main",
  author: "Ada Prism",
};

const T0 = 1767225600;

const base: Record<string, string> = {
  "README.md": "# acme-shop\n\nA tiny storefront used to demonstrate GitPrism's Impact Studio.\n",
  // A placeholder environment file: the analyzer and context packer must never read it.
  ".env": "SESSION_SECRET=replace-me-locally\n",
  "src/infra/db.ts": `export function query(sql: string, params: unknown[] = []) {
  return { sql, params, rows: [] as unknown[] };
}
`,
  "src/auth/tokens.ts": `export function signToken(payload: string, secret: string) {
  return \`\${payload}.\${secret.length}\`;
}

export function verifyToken(token: string) {
  const [payload, sig] = token.split(".");
  return sig ? payload : null;
}
`,
  "src/auth/session.ts": `import { verifyToken } from "./tokens";

export type Session = { userId: string; expiresAt: number };

export function validateSession(token: string, now: number) {
  const userId = verifyToken(token);
  if (!userId) return null;
  return { userId, expiresAt: now + 3600_000 };
}

export function createSession(userId: string, now: number) {
  return { userId, expiresAt: now + 3600_000 };
}

export function refreshSession(token: string) {
  const session = validateSession(token, Date.now());
  if (!session) throw new Error("Session expired");
  return createSession(session.userId, Date.now());
}
`,
  "src/auth/legacy.ts": `import { signToken } from "./tokens";

export function legacyLogin(user: string) {
  return signToken(user, "legacy");
}
`,
  "src/auth/auth.service.ts": `import { createSession, validateSession } from "./session";
import { signToken } from "./tokens";
import { legacyLogin } from "./legacy";

export function login(userId: string, secret: string) {
  const session = createSession(userId, Date.now());
  return { session, token: signToken(userId, secret) };
}

export function requireUser(token: string) {
  const session = validateSession(token, Date.now());
  if (!session) throw new Error("Unauthorized");
  return session.userId;
}

export function loginLegacy(user: string) {
  return legacyLogin(user);
}
`,
  "src/api/middleware/auth-guard.ts": `import { validateSession } from "../../auth/session";

export function authGuard(token: string, next: () => unknown) {
  const session = validateSession(token, Date.now());
  if (!session) return { status: 401 };
  return next();
}
`,
  "src/api/routes/account.ts": `import { requireUser } from "../../auth/auth.service";
import { authGuard } from "../middleware/auth-guard";

export function getAccount(token: string) {
  return authGuard(token, () => ({ userId: requireUser(token) }));
}
`,
  "src/api/routes/orders.ts": `import { requireUser } from "../../auth/auth.service";
import { placeOrder, getOrders } from "../../orders/orders.service";

export function listOrders(token: string) {
  return getOrders(requireUser(token));
}

export function createOrder(token: string, items: { price: number; qty: number }[]) {
  return placeOrder(requireUser(token), items);
}
`,
  "src/orders/orders.service.ts": `import { priceCart } from "./pricing";
import { saveOrder, findOrders } from "./orders.repo";

export function placeOrder(userId: string, items: { price: number; qty: number }[]) {
  const total = priceCart(items);
  return saveOrder(userId, total);
}

export function getOrders(userId: string) {
  return findOrders(userId);
}
`,
  "src/orders/pricing.ts": `export function priceCart(items: { price: number; qty: number }[]) {
  return applyDiscount(items.reduce((sum, i) => sum + i.price * i.qty, 0));
}

export function applyDiscount(total: number) {
  return total > 100 ? total * 0.9 : total;
}
`,
  "src/orders/orders.repo.ts": `import { query } from "../infra/db";

export function saveOrder(userId: string, total: number) {
  return query("insert into orders values ($1, $2)", [userId, total]);
}

export function findOrders(userId: string) {
  return query("select * from orders where user_id = $1", [userId]);
}
`,
  "tests/session.test.ts": `import { validateSession, createSession } from "../src/auth/session";

test("rejects an unsigned token", () => {
  expect(validateSession("abc", Date.now())).toBeNull();
});

test("creates a session for an hour", () => {
  expect(createSession("u1", 0).expiresAt).toBe(3600000);
});
`,
  "tests/auth.service.test.ts": `import { login } from "../src/auth/auth.service";

test("login returns a token", () => {
  expect(login("u1", "secret").token).toContain("u1");
});
`,
  "tests/pricing.test.ts": `import { priceCart } from "../src/orders/pricing";

test("discounts large carts", () => {
  expect(priceCart([{ price: 200, qty: 1 }])).toBe(180);
});
`,
};

/** The pull request, one commit at a time. */
const prCommits: { message: string; edit: (f: Record<string, string>) => void }[] = [
  {
    message: "Cache validated sessions",
    edit: (f) => {
      f["src/infra/cache.ts"] = `const store = new Map<string, { value: unknown; expires: number }>();

export function cacheGet(key: string, now: number) {
  const hit = store.get(key);
  return hit && hit.expires > now ? hit.value : undefined;
}

export function cacheSet(key: string, value: unknown, ttlMs: number, now: number) {
  store.set(key, { value, expires: now + ttlMs });
}
`;
      f["src/auth/session.ts"] = `import { verifyToken } from "./tokens";
import { cacheGet, cacheSet } from "../infra/cache";

export type Session = { userId: string; expiresAt: number };
export type ValidateOptions = { now: number; useCache?: boolean };

export function validateSession(token: string, opts: ValidateOptions) {
  const cached = opts.useCache ? cacheGet(token, opts.now) : undefined;
  if (cached) return cached as Session;
  const userId = verifyToken(token);
  if (!userId) return null;
  const session = { userId, expiresAt: opts.now + 3600_000 };
  cacheSet(token, session, 60_000, opts.now);
  return session;
}

export function createSession(userId: string, now: number) {
  return { userId, expiresAt: now + 3600_000 };
}

export function refreshSession(token: string) {
  const session = validateSession(token, { now: Date.now() });
  if (!session) throw new Error("Session expired");
  return createSession(session.userId, Date.now());
}
`;
      f["tests/session.test.ts"] = f["tests/session.test.ts"].replace('validateSession("abc", Date.now())', 'validateSession("abc", { now: 0 })');
    },
  },
  {
    message: "Rotate tokens on refresh",
    edit: (f) => {
      f["src/auth/tokens.ts"] = `import { refreshSession } from "./session";

export function signToken(payload: string, secret: string) {
  return \`\${payload}.\${secret.length}\`;
}

export function verifyToken(token: string) {
  const [payload, sig] = token.split(".");
  return sig ? payload : null;
}

export function rotateToken(token: string, secret: string) {
  const session = refreshSession(token);
  return signToken(session.userId, secret);
}
`;
    },
  },
  {
    message: "Pass options to validateSession in auth guard",
    edit: (f) => {
      f["src/api/middleware/auth-guard.ts"] = f["src/api/middleware/auth-guard.ts"].replace(
        "validateSession(token, Date.now())",
        "validateSession(token, { now: Date.now(), useCache: true })",
      );
    },
  },
  {
    message: "Remove legacy login",
    edit: (f) => {
      delete f["src/auth/legacy.ts"];
      f["src/auth/auth.service.ts"] = f["src/auth/auth.service.ts"]
        .replace('import { legacyLogin } from "./legacy";\n', "")
        .replace("\nexport function loginLegacy(user: string) {\n  return legacyLogin(user);\n}\n", "");
    },
  },
];

/** Architecture configuration for the fixture. Shown verbatim in the UI. */
export const LAYER_CONFIG: { source: string; layers: Layer[]; rules: LayerRule[] } = {
  source: "gitprism.layers.json",
  layers: [
    { id: "presentation", label: "Presentation", patterns: ["src/api/"] },
    { id: "application", label: "Application", patterns: [".service.ts"] },
    { id: "domain", label: "Domain", patterns: ["src/auth/session.ts", "src/auth/tokens.ts", "src/auth/legacy.ts", "src/orders/pricing.ts"] },
    { id: "infrastructure", label: "Infrastructure", patterns: ["src/infra/", ".repo.ts"] },
  ],
  rules: [
    { id: "no-upward", text: "A layer may import only from itself or layers listed below it." },
    { id: "pure-domain", text: "Domain code must not import infrastructure." },
  ],
};

export type FixtureCommit = { oid: string; message: string; timestamp: number; files: Record<string, string> };

function run(s: RepositoryState, cmd: RepositoryCommand) {
  const r = apply(s, cmd);
  if (!r.ok) throw new Error(`Fixture failed on ${cmd.type}: ${r.error}`);
  return r.state;
}

function syncWorktree(s: RepositoryState, files: Record<string, string>) {
  for (const p of Object.keys(s.worktree)) if (!(p in files)) s = run(s, { type: "DELETE_FILE", path: p });
  for (const [p, c] of Object.entries(files)) {
    if (!(p in s.worktree)) s = run(s, { type: "CREATE_FILE", path: p, content: c });
    else if (s.worktree[p] !== c) s = run(s, { type: "EDIT_FILE", path: p, content: c });
  }
  const paths = [...new Set([...Object.keys(s.worktree), ...Object.keys(s.index)])];
  return run(s, { type: "STAGE_PATHS", paths });
}

let cached: { base: FixtureCommit; commits: FixtureCommit[] } | null = null;

/** base = tip of main; commits = the PR's commits, oldest first. */
export function fixtureHistory() {
  if (cached) return cached;
  let s = emptyRepository(FIXTURE.repo);
  s = syncWorktree(s, base);
  s = run(s, { type: "COMMIT", message: "Storefront with sessions and orders", timestamp: T0 });
  const read = (oid: string) =>
    Object.fromEntries(Object.entries(commitFiles(s, oid)).map(([p, b]) => [p, blobContent(s, b) ?? ""]));
  const toCommit = (oid: string): FixtureCommit => {
    const c = getCommit(s, oid)!;
    return { oid, message: c.message, timestamp: c.timestamp, files: read(oid) };
  };
  const baseCommit = toCommit(s.branches.main);
  s = run(s, { type: "CREATE_BRANCH", name: FIXTURE.source, at: s.branches.main });
  s = run(s, { type: "SWITCH_BRANCH", name: FIXTURE.source });
  const files = { ...base };
  const commits: FixtureCommit[] = [];
  prCommits.forEach((c, i) => {
    c.edit(files);
    s = syncWorktree(s, files);
    s = run(s, { type: "COMMIT", message: c.message, timestamp: T0 + 3600 * (i + 1) });
    commits.push(toCommit(s.branches[FIXTURE.source]));
  });
  cached = { base: baseCommit, commits };
  return cached;
}

export function isFixture(owner: string, repo: string, number: string | number) {
  return owner === FIXTURE.owner && repo === FIXTURE.repo && String(number) === String(FIXTURE.number);
}
