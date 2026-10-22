// Sample repository used by the story sections. Every ID is computed from
// real Git object bytes, never hard-coded.

import { commitText, hashBlob, hashCommit, hashTree, type TreeEntry } from "./git";

export const BASE_TIME = 1767225600; // 2026-01-01T00:00:00Z, fixed for stable renders

export const files = {
  hello: { name: "hello.txt", content: "Hello GitPrism!\n" },
  notes: { name: "notes.md", content: "# Notes\nSnapshots never change.\n" },
};

export const blobs = {
  hello: hashBlob(files.hello.content),
  notes: hashBlob(files.notes.content),
};

export const treeEntries: TreeEntry[] = [
  { mode: "100644", name: files.hello.name, oid: blobs.hello },
  { mode: "100644", name: files.notes.name, oid: blobs.notes },
];
export const tree = hashTree(treeEntries);

const firstTreeEntries: TreeEntry[] = [{ mode: "100644", name: files.notes.name, oid: blobs.notes }];
const firstTree = hashTree(firstTreeEntries);

const c1Input = { tree: firstTree, parents: [], message: "Start project notes", time: BASE_TIME };
const c1 = hashCommit(c1Input);
const c2Input = { tree, parents: [c1], message: "Add hello.txt", time: BASE_TIME + 3600 };
const c2 = hashCommit(c2Input);

const laterHello = "Hello GitPrism!\nHello history.\n";
const laterTree = hashTree([
  { mode: "100644", name: files.hello.name, oid: hashBlob(laterHello) },
  { mode: "100644", name: files.notes.name, oid: blobs.notes },
]);
const c3Input = { tree: laterTree, parents: [c2], message: "Greet the history", time: BASE_TIME + 7200 };
const c3 = hashCommit(c3Input);

export const commits = {
  c1: { oid: c1, text: commitText(c1Input), message: c1Input.message, tree: firstTree },
  c2: { oid: c2, text: commitText(c2Input), message: c2Input.message, tree },
  c3: { oid: c3, text: commitText(c3Input), message: c3Input.message, tree: laterTree },
};

export function treeText(entries: TreeEntry[]) {
  return entries.map((e) => `${e.mode} blob ${e.oid}\t${e.name}`).join("\n");
}
