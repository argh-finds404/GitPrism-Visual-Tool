// Guided challenges. Each one checks real repository and selection state.

import { commitFiles, currentBranch, fileStatuses, getCommit, headCommitId } from "./engine";
import { createSampleRepository } from "./sample";
import type { ObjectId, RepositoryCommand, RepositoryState } from "./types";

export type ChallengeContext = {
  state: RepositoryState;
  selectedOid: ObjectId | null;
  commands: RepositoryCommand[];
};

export type Challenge = {
  id: string;
  title: string;
  hint: string;
  explain: string;
  done: (c: ChallengeContext) => boolean;
};

const sample = createSampleRepository();
const sampleHead = getCommit(sample, sample.branches.main)!;
const readmeBlob = commitFiles(sample, sampleHead.oid)["README.md"];

export const challenges: Challenge[] = [
  {
    id: "find-parent",
    title: "Find the parent of “Update README”",
    hint: "Select the newest commit on main, then look at Parent in the Prism Lens. Click it.",
    explain: "Every commit stores the ID of the commit before it. Following parents is how Git walks back through history.",
    done: (c) => c.selectedOid === sampleHead.parents[0],
  },
  {
    id: "find-readme-blob",
    title: "Select the object that stores README.md's content",
    hint: "Open the latest commit's tree (Inspect tree) and pick the README.md entry. It's a circle: a blob.",
    explain: "The README text lives in a blob. The name README.md is stored in the tree entry that points to it.",
    done: (c) => c.selectedOid === readmeBlob,
  },
  {
    id: "stage-app",
    title: "Change src/app.js and stage it",
    hint: "Open src/app.js from Files, edit a line, then press Stage file.",
    explain: "Staging wrote your new content as a blob and pointed the index at it. The commit history hasn't changed yet.",
    done: (c) => fileStatuses(c.state).some((s) => s.path === "src/app.js" && s.staged === "modified"),
  },
  {
    id: "commit",
    title: "Create a commit",
    hint: "Stage something, then write a message in Changes and press Commit.",
    explain: "Git built a tree from the index and wrote a commit pointing at that tree and at the previous commit. The branch moved forward.",
    done: (c) => c.commands.some((k) => k.type === "COMMIT"),
  },
  {
    id: "branch",
    title: "Create a branch and switch to it",
    hint: "In Refs, type a name under New branch, press Create, then Switch.",
    explain: "Your new branch is just a name for a commit. After switching, HEAD refers to it, so your next commit moves it, not main.",
    done: (c) => {
      const b = currentBranch(c.state);
      return !!b && !(b in sample.branches) && !!headCommitId(c.state);
    },
  },
];
