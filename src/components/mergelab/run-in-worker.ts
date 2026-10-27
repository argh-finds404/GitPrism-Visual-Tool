import type { TestOutcome } from "@/features/testing/harness";

const TIME_LIMIT_MS = 2000;

/** Run one test in a fresh worker; a runaway test is stopped by terminating the worker. */
export function runInWorker(modules: Record<string, string>, testPath: string, testName: string): Promise<TestOutcome> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const worker = new Worker(new URL("./test-worker.ts", import.meta.url), { type: "module" });
    const finish = (o: TestOutcome) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(o);
    };
    const timer = setTimeout(() => finish({ status: "error", detail: `Timed out after ${TIME_LIMIT_MS} ms`, ms: TIME_LIMIT_MS }), TIME_LIMIT_MS);
    worker.onmessage = (e: MessageEvent<TestOutcome>) => finish(e.data);
    worker.onerror = (e) => finish({ status: "error", detail: e.message || "The test worker failed", ms: Math.round(performance.now() - t0) });
    worker.postMessage({ modules, testPath, testName });
  });
}
