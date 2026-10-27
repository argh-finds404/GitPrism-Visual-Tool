/**
 * In-browser parser for a local .git directory.
 *
 * Reads .git files provided by <input type="file" webkitdirectory> or folder drag-and-drop.
 * Unpacks loose commit and tree objects with native Web Streams DecompressionStream('deflate'),
 * resolves branch pointers and reflogs, and builds the commit graph and snapshot trees.
 */

export type GitAuthor = {
  name: string;
  email: string;
  timestamp: number;
  tz?: string;
};

export type GitTreeEntry = {
  mode: string;
  name: string;
  oid: string;
  isDir: boolean;
};

export type GitCommit = {
  oid: string;
  shortOid: string;
  tree?: string;
  treeEntries?: GitTreeEntry[];
  parents: string[];
  author: GitAuthor;
  committer?: GitAuthor;
  message: string;
  summary: string;
  branches: string[];
  isHead?: boolean;
};

export type GitContributor = {
  name: string;
  email: string;
  commitCount: number;
};

export type ParsedGitRepo = {
  name: string;
  headBranch: string;
  headOid: string;
  branches: Record<string, string>; // branch name -> commit SHA
  commits: GitCommit[];
  commitsByOid: Map<string, GitCommit>;
  contributors: GitContributor[];
  totalCommits: number;
  treesByOid: Map<string, GitTreeEntry[]>;
  timeSpan?: {
    first: number;
    latest: number;
  };
};

/** Decompresses a zlib-deflated loose Git object using the browser's native Web Streams API */
async function inflate(buffer: ArrayBuffer): Promise<Uint8Array | null> {
  try {
    const stream = new Response(buffer).body?.pipeThrough(new DecompressionStream("deflate"));
    if (!stream) return null;
    const decompressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(decompressed);
  } catch {
    return null;
  }
}

function parseCommitContent(bytes: Uint8Array): {
  tree: string;
  parents: string[];
  author?: GitAuthor;
  committer?: GitAuthor;
  message: string;
} {
  const text = new TextDecoder().decode(bytes);
  const nullIdx = text.indexOf("\0");
  const body = nullIdx >= 0 ? text.slice(nullIdx + 1) : text;
  const lines = body.split("\n");
  let tree = "";
  const parents: string[] = [];
  let author: GitAuthor | undefined;
  let committer: GitAuthor | undefined;
  let msgStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === "") {
      msgStart = i + 1;
      break;
    }
    if (line.startsWith("tree ")) {
      tree = line.slice(5).trim();
    } else if (line.startsWith("parent ")) {
      parents.push(line.slice(7).trim());
    } else if (line.startsWith("author ")) {
      const match = line.slice(7).match(/^(.*?) <(.*?)> (\d+) ([+-]\d{4})$/);
      if (match) {
        author = {
          name: match[1],
          email: match[2],
          timestamp: parseInt(match[3], 10) * 1000,
          tz: match[4],
        };
      }
    } else if (line.startsWith("committer ")) {
      const match = line.slice(10).match(/^(.*?) <(.*?)> (\d+) ([+-]\d{4})$/);
      if (match) {
        committer = {
          name: match[1],
          email: match[2],
          timestamp: parseInt(match[3], 10) * 1000,
          tz: match[4],
        };
      }
    }
  }

  const message = msgStart >= 0 ? lines.slice(msgStart).join("\n").trim() : "";
  return { tree, parents, author, committer, message };
}

function parseTreeContent(bytes: Uint8Array): GitTreeEntry[] {
  let nullIdx = -1;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0) {
      nullIdx = i;
      break;
    }
  }
  if (nullIdx === -1) return [];

  const body = bytes.subarray(nullIdx + 1);
  const entries: GitTreeEntry[] = [];
  let pos = 0;
  const decoder = new TextDecoder();

  while (pos < body.length) {
    let spaceIdx = -1;
    for (let i = pos; i < body.length; i++) {
      if (body[i] === 32) {
        spaceIdx = i;
        break;
      }
    }
    if (spaceIdx === -1) break;

    const mode = decoder.decode(body.subarray(pos, spaceIdx));
    let nameNullIdx = -1;
    for (let i = spaceIdx + 1; i < body.length; i++) {
      if (body[i] === 0) {
        nameNullIdx = i;
        break;
      }
    }
    if (nameNullIdx === -1) break;

    const name = decoder.decode(body.subarray(spaceIdx + 1, nameNullIdx));
    const oidBuf = body.subarray(nameNullIdx + 1, nameNullIdx + 21);
    if (oidBuf.length < 20) break;

    let hexOid = "";
    for (let i = 0; i < oidBuf.length; i++) {
      hexOid += oidBuf[i].toString(16).padStart(2, "0");
    }

    entries.push({
      mode,
      name,
      oid: hexOid,
      isDir: mode.startsWith("40"),
    });

    pos = nameNullIdx + 21;
  }

  return entries.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function readLocalGitRepo(files: ArrayLike<File>): Promise<ParsedGitRepo | null> {
  const fileArray = Array.from(files);
  const gitFiles = new Map<string, File>();

  for (const f of fileArray) {
    const rawPath = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const gitIdx = rawPath.indexOf(".git/");
    if (gitIdx !== -1) {
      const internalPath = rawPath.slice(gitIdx + 5);
      gitFiles.set(internalPath, f);
    }
  }

  if (gitFiles.size === 0) {
    return null;
  }

  // 1. Read HEAD
  let headBranch = "main";
  let headOid = "";
  const headFile = gitFiles.get("HEAD");
  if (headFile) {
    const headText = (await headFile.text()).trim();
    if (headText.startsWith("ref: refs/heads/")) {
      headBranch = headText.slice(16);
    } else if (/^[0-9a-f]{40}$/i.test(headText)) {
      headOid = headText;
      headBranch = "HEAD (detached)";
    }
  }

  // 2. Read branch refs under refs/heads/
  const branches: Record<string, string> = {};
  for (const [path, file] of gitFiles.entries()) {
    if (path.startsWith("refs/heads/")) {
      const branchName = path.slice(11);
      const sha = (await file.text()).trim();
      if (/^[0-9a-f]{40}$/i.test(sha)) {
        branches[branchName] = sha;
      }
    }
  }

  // 3. Read packed-refs if present
  const packedRefsFile = gitFiles.get("packed-refs");
  if (packedRefsFile) {
    const text = await packedRefsFile.text();
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || trimmed.startsWith("^") || !trimmed) continue;
      const parts = trimmed.split(" ");
      if (parts.length === 2 && /^[0-9a-f]{40}$/i.test(parts[0])) {
        const refName = parts[1];
        if (refName.startsWith("refs/heads/")) {
          const bName = refName.slice(11);
          if (!branches[bName]) branches[bName] = parts[0];
        }
      }
    }
  }

  if (!headOid && branches[headBranch]) {
    headOid = branches[headBranch];
  }

  // 4. Discover and parse loose commit & tree objects
  const commitsByOid = new Map<string, GitCommit>();
  const treesByOid = new Map<string, GitTreeEntry[]>();

  for (const [path, file] of gitFiles.entries()) {
    if (path.startsWith("objects/")) {
      const rest = path.slice(8);
      const match = rest.match(/^([0-9a-f]{2})\/([0-9a-f]{38})$/i);
      if (match) {
        const oid = (match[1] + match[2]).toLowerCase();
        try {
          const buf = await file.arrayBuffer();
          const decompressed = await inflate(buf);
          if (!decompressed) continue;

          // Check prefix
          const headerPrefix = new TextDecoder().decode(decompressed.subarray(0, 16));
          if (headerPrefix.startsWith("commit ")) {
            const parsed = parseCommitContent(decompressed);
            if (parsed.author) {
              const summary = parsed.message.split("\n")[0] || "No message";
              commitsByOid.set(oid, {
                oid,
                shortOid: oid.slice(0, 7),
                tree: parsed.tree,
                parents: parsed.parents,
                author: parsed.author,
                committer: parsed.committer,
                message: parsed.message,
                summary,
                branches: [],
              });
            }
          } else if (headerPrefix.startsWith("tree ")) {
            const entries = parseTreeContent(decompressed);
            treesByOid.set(oid, entries);
          }
        } catch {
          // ignore unparseable objects
        }
      }
    }
  }

  // 5. Read reflogs (logs/HEAD) to catch historical commits even if older objects were packed
  const reflogFile = gitFiles.get("logs/HEAD");
  if (reflogFile) {
    try {
      const logText = await reflogFile.text();
      for (const line of logText.trim().split("\n")) {
        const tabIdx = line.indexOf("\t");
        if (tabIdx === -1) continue;
        const meta = line.slice(0, tabIdx);
        const action = line.slice(tabIdx + 1);
        const match = meta.match(/^([0-9a-f]{40}) ([0-9a-f]{40}) (.*?) <(.*?)> (\d+) ([+-]\d{4})$/);
        if (!match) continue;
        const [, oldSha, newSha, authorName, authorEmail, timeStr, tz] = match;
        const timestamp = parseInt(timeStr, 10) * 1000;

        let msg = action;
        if (action.startsWith("commit: ")) msg = action.slice(8);
        else if (action.startsWith("commit (amend): ")) msg = action.slice(16);
        else if (action.startsWith("commit (initial): ")) msg = action.slice(18);

        const summary = msg.split("\n")[0] || msg;
        const parent = oldSha !== "0000000000000000000000000000000000000000" ? oldSha : undefined;

        if (!commitsByOid.has(newSha)) {
          commitsByOid.set(newSha, {
            oid: newSha,
            shortOid: newSha.slice(0, 7),
            parents: parent ? [parent] : [],
            author: { name: authorName, email: authorEmail, timestamp, tz },
            message: msg,
            summary,
            branches: [],
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // 6. Label commits with branch pointers and attach tree entries
  for (const [bName, bOid] of Object.entries(branches)) {
    const commit = commitsByOid.get(bOid);
    if (commit && !commit.branches.includes(bName)) {
      commit.branches.push(bName);
    }
  }

  if (headOid) {
    const headCommit = commitsByOid.get(headOid);
    if (headCommit) {
      headCommit.isHead = true;
    }
  }

  for (const commit of commitsByOid.values()) {
    if (commit.tree && treesByOid.has(commit.tree)) {
      commit.treeEntries = treesByOid.get(commit.tree);
    }
  }

  // 7. Sort commits chronologically (newest first)
  const commitList = Array.from(commitsByOid.values()).sort(
    (a, b) => b.author.timestamp - a.author.timestamp
  );

  // 8. Compute contributor statistics
  const contributorMap = new Map<string, GitContributor>();
  for (const c of commitList) {
    const key = `${c.author.name} <${c.author.email}>`;
    const existing = contributorMap.get(key);
    if (existing) {
      existing.commitCount += 1;
    } else {
      contributorMap.set(key, {
        name: c.author.name,
        email: c.author.email,
        commitCount: 1,
      });
    }
  }
  const contributors = Array.from(contributorMap.values()).sort((a, b) => b.commitCount - a.commitCount);

  const projectName = fileArray[0]
    ? (fileArray[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split("/")[0] || "project"
    : "project";

  const timeSpan =
    commitList.length > 0
      ? {
          first: commitList[commitList.length - 1].author.timestamp,
          latest: commitList[0].author.timestamp,
        }
      : undefined;

  return {
    name: projectName,
    headBranch,
    headOid,
    branches,
    commits: commitList,
    commitsByOid,
    contributors,
    totalCommits: commitList.length,
    treesByOid,
    timeSpan,
  };
}
