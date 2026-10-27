"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { hashBlob, hashCommit, hashTree } from "@/lib/git";
import { BASE_TIME } from "@/lib/sample";

export type Snapshot = {
  oid: string;
  parent: string | null;
  message: string;
  content: string;
  blob: string;
  tree: string;
  time: number;
  /** True when this snapshot's blob already existed in an earlier one. */
  reusedBlob: boolean;
};

function makeSnapshot(content: string, message: string, parent: Snapshot | null, time: number, history: Snapshot[]): Snapshot {
  const blob = hashBlob(content);
  const tree = hashTree([{ mode: "100644", name: "hello.txt", oid: blob }]);
  const oid = hashCommit({ tree, parents: parent ? [parent.oid] : [], message, time });
  return {
    oid,
    parent: parent?.oid ?? null,
    message,
    content,
    blob,
    tree,
    time,
    reusedBlob: history.some((s) => s.blob === blob),
  };
}

const V1 = "Hello GitPrism!\nVersion one.\n";
const V2 = "Hello GitPrism!\nVersion two.\nEvery snapshot is saved whole.\n";

function seed() {
  const a = makeSnapshot(V1, "First snapshot", null, BASE_TIME, []);
  const b = makeSnapshot(V2, "Describe snapshots", a, BASE_TIME + 3600, [a]);
  return [a, b];
}

type Lab = {
  working: string;
  setWorking: (s: string) => void;
  snapshots: Snapshot[];
  save: (message: string) => Snapshot;
  reset: () => void;
  compare: { from: string; to: string };
  setCompare: (c: { from: string; to: string }) => void;
};

const LabContext = createContext<Lab | null>(null);

export function LabProvider({ children }: { children: ReactNode }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>(seed);
  const [working, setWorking] = useState(V2 + "Edit me, then save a snapshot.\n");
  const [compare, setCompare] = useState(() => {
    const [a, b] = seed();
    return { from: a.oid, to: b.oid };
  });

  const save = useCallback(
    (message: string) => {
      const head = snapshots[snapshots.length - 1] ?? null;
      const time = Math.max(head ? head.time + 60 : BASE_TIME, Math.floor(Date.now() / 1000));
      const snap = makeSnapshot(working, message.trim() || "Update hello.txt", head, time, snapshots);
      setSnapshots([...snapshots, snap]);
      if (head) setCompare({ from: head.oid, to: snap.oid });
      return snap;
    },
    [snapshots, working],
  );

  const reset = useCallback(() => {
    const s = seed();
    setSnapshots(s);
    setWorking(V2 + "Edit me, then save a snapshot.\n");
    setCompare({ from: s[0].oid, to: s[1].oid });
  }, []);

  const value = useMemo(
    () => ({ working, setWorking, snapshots, save, reset, compare, setCompare }),
    [working, snapshots, save, reset, compare],
  );
  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}

export function useLab() {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error("useLab must be used inside <LabProvider>");
  return ctx;
}
