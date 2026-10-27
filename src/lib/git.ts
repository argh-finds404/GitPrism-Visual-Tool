// A tiny, synchronous implementation of Git's object model.
// Every ID produced here matches what `git hash-object` would print for the
// same bytes, so the homepage never shows a decorative, made-up hash.

const encoder = new TextEncoder();

/* ------------------------------------------------------------------ */
/* SHA-1                                                               */
/* ------------------------------------------------------------------ */

function rotl(x: number, n: number) {
  return (x << n) | (x >>> (32 - n));
}

export function sha1(bytes: Uint8Array): string {
  const ml = bytes.length;
  const withPadding = ((ml + 9 + 63) >> 6) << 6;
  const buf = new Uint8Array(withPadding);
  buf.set(bytes);
  buf[ml] = 0x80;
  const view = new DataView(buf.buffer);
  // Message length in bits, big-endian 64-bit (high word stays 0 for our sizes).
  view.setUint32(withPadding - 4, (ml * 8) >>> 0);
  view.setUint32(withPadding - 8, Math.floor((ml * 8) / 2 ** 32));

  let h0 = 0x67452301,
    h1 = 0xefcdab89,
    h2 = 0x98badcfe,
    h3 = 0x10325476,
    h4 = 0xc3d2e1f0;
  const w = new Uint32Array(80);

  for (let off = 0; off < withPadding; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);

    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) [f, k] = [(b & c) | (~b & d), 0x5a827999];
      else if (i < 40) [f, k] = [b ^ c ^ d, 0x6ed9eba1];
      else if (i < 60) [f, k] = [(b & c) | (b & d) | (c & d), 0x8f1bbcdc];
      else [f, k] = [b ^ c ^ d, 0xca62c1d6];
      const t = (rotl(a, 5) + f + e + k + w[i]) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30) >>> 0;
      b = a;
      a = t;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }
  return [h0, h1, h2, h3, h4].map((h) => h.toString(16).padStart(8, "0")).join("");
}

function hexToBytes(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function concat(parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Objects                                                             */
/* ------------------------------------------------------------------ */

export type ObjectType = "blob" | "tree" | "commit";

/** Hash raw object content the way Git does: "<type> <size>\0" + body. */
export function hashObject(type: ObjectType, body: Uint8Array) {
  const header = encoder.encode(`${type} ${body.length}\0`);
  return sha1(concat([header, body]));
}

export function blobHeader(content: string) {
  return `blob ${encoder.encode(content).length}\\0`;
}

export function hashBlob(content: string) {
  return hashObject("blob", encoder.encode(content));
}

export type TreeEntry = { mode: "100644" | "100755" | "040000"; name: string; oid: string };

export function hashTree(entries: TreeEntry[]) {
  // Git sorts entries by name (directories compare as if they had a trailing "/").
  const sorted = [...entries].sort((a, b) => {
    const an = a.mode === "040000" ? a.name + "/" : a.name;
    const bn = b.mode === "040000" ? b.name + "/" : b.name;
    return an < bn ? -1 : an > bn ? 1 : 0;
  });
  const body = concat(
    sorted.flatMap((e) => [
      encoder.encode(`${e.mode === "040000" ? "40000" : e.mode} ${e.name}\0`),
      hexToBytes(e.oid),
    ]),
  );
  return hashObject("tree", body);
}

export type CommitInput = {
  tree: string;
  parents: string[];
  message: string;
  author?: string;
  /** Unix seconds. Fixed values keep server and client renders identical. */
  time: number;
};

export function commitText({ tree, parents, message, author = "Ada Prism <ada@gitprism.dev>", time }: CommitInput) {
  return (
    `tree ${tree}\n` +
    parents.map((p) => `parent ${p}\n`).join("") +
    `author ${author} ${time} +0000\n` +
    `committer ${author} ${time} +0000\n\n` +
    `${message}\n`
  );
}

export function hashCommit(input: CommitInput) {
  return hashObject("commit", encoder.encode(commitText(input)));
}

export const short = (oid: string, n = 7) => oid.slice(0, n);

/* ------------------------------------------------------------------ */
/* Line diff (LCS)                                                     */
/* ------------------------------------------------------------------ */

export type DiffLine =
  | { kind: "same"; text: string; a: number; b: number }
  | { kind: "add"; text: string; b: number }
  | { kind: "del"; text: string; a: number };

export function splitLines(text: string) {
  const lines = text.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

export function diffLines(before: string, after: string): DiffLine[] {
  const a = splitLines(before);
  const b = splitLines(after);
  const n = a.length,
    m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const out: DiffLine[] = [];
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i], a: i + 1, b: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "del", text: a[i], a: i + 1 });
      i++;
    } else {
      out.push({ kind: "add", text: b[j], b: j + 1 });
      j++;
    }
  }
  while (i < n) out.push({ kind: "del", text: a[i], a: ++i });
  while (j < m) out.push({ kind: "add", text: b[j], b: ++j });
  return out;
}

/** Group consecutive add/del lines into hunks so they can be navigated. */
export function hunkIds(lines: DiffLine[]) {
  const ids: (number | null)[] = [];
  let hunk = -1;
  let inHunk = false;
  for (const l of lines) {
    if (l.kind === "same") {
      inHunk = false;
      ids.push(null);
    } else {
      if (!inHunk) hunk++;
      inHunk = true;
      ids.push(hunk);
    }
  }
  return { ids, count: hunk + 1 };
}
