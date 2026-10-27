/// <reference lib="webworker" />
// Runs one candidate test off the main thread. The page terminates this worker on timeout.

import { runCompiled } from "@/features/testing/harness";

self.onmessage = (e: MessageEvent<{ modules: Record<string, string>; testPath: string; testName: string }>) => {
  const { modules, testPath, testName } = e.data;
  self.postMessage(runCompiled(modules, testPath, testName));
};
