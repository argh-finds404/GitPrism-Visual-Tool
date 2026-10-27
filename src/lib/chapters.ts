// The homepage story, in order. Each chapter's ID is the real blob ID of its
// log line (`echo "chapter 1: the problem" | git hash-object --stdin`).

import { hashBlob, short } from "./git";

export const chapterLine = (n: number, name: string) => `chapter ${n}: ${name}`;
export const chapterId = (n: number, name: string) => short(hashBlob(`${chapterLine(n, name)}\n`));

const list = [
  { n: 1, name: "the problem", anchor: "problem", color: "var(--magenta)" },
  { n: 2, name: "the reveal", anchor: "how", color: "var(--violet)" },
  { n: 3, name: "the lab", anchor: "playground", color: "var(--cyan)" },
  { n: 4, name: "the difference", anchor: "diff", color: "var(--add)" },
  { n: 5, name: "history", anchor: "history", color: "var(--amber)" },
  { n: 6, name: "the invisible part", anchor: "identity", color: "var(--violet)" },
];

export const CHAPTERS = list.map((c) => ({ ...c, id: chapterId(c.n, c.name) }));
