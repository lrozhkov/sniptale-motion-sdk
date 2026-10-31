import { describe, expect, it, vi } from "vitest";
import { readWorkerRuntimeScope } from "../src/apps/sandbox/runtime/worker-scope.js";

describe("sandbox worker messaging boundary", () => {
  it.each([
    null,
    {},
    { postMessage: () => {} },
    { postMessage: 1, addEventListener: () => {} },
  ])("rejects missing messaging capabilities: %j", (value) => {
    expect(() => readWorkerRuntimeScope(value)).toThrow(
      "messaging is unavailable",
    );
  });
  it("preserves the browser receiver when posting and subscribing", () => {
    const calls: object[] = [];
    const source = {
      postMessage() {
        calls.push(this);
      },
      addEventListener() {
        calls.push(this);
      },
    };
    const scope = readWorkerRuntimeScope(source);
    scope.postMessage({ kind: "workerReady" });
    scope.addEventListener("message", vi.fn());
    expect(calls).toEqual([source, source]);
  });
});
