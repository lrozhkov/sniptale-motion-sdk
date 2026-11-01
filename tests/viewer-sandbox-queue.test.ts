import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createViewerState } from "../src/apps/viewer/app/state.js";
import {
  cancelPendingSandboxRequests,
  completePending,
  completeRender,
  postToSandboxWithTimeout,
  refreshPendingSandboxRequestTimeout,
  SandboxRuntimeRecoveryError,
} from "../src/apps/viewer/transport/sandbox-client.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("window", {
    clearTimeout: globalThis.clearTimeout,
    setTimeout: globalThis.setTimeout,
    location: { href: "http://127.0.0.1:4177/" },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function frame(postMessage = vi.fn<() => undefined>(() => undefined)) {
  return {
    src: "http://127.0.0.1:4178/sandbox.html",
    contentWindow: { postMessage },
  };
}

describe("sandbox request queue", () => {
  it("releases a failed post immediately", async () => {
    const state = createViewerState();
    const error = new Error("Cannot clone payload");
    const target = frame(
      vi.fn<() => never>(() => {
        throw error;
      }),
    );
    const pending = postToSandboxWithTimeout(
      state,
      target,
      { kind: "renderFrame", requestId: "failed" },
      100,
    );
    await expect(pending).rejects.toBe(error);
    expect(state.pending.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps the first request intact when an id is reused", async () => {
    const state = createViewerState();
    const target = frame();
    const first = postToSandboxWithTimeout(
      state,
      target,
      { kind: "renderFrame", requestId: "same" },
      100,
    );
    const duplicate = postToSandboxWithTimeout(
      state,
      target,
      { kind: "renderFrame", requestId: "same" },
      100,
    );
    await expect(duplicate).rejects.toThrow(/Duplicate sandbox request/);
    expect(target.contentWindow.postMessage).toHaveBeenCalledOnce();
    completePending(state, { requestId: "same", payload: { retained: true } });
    await expect(first).resolves.toEqual({
      requestId: "same",
      payload: { retained: true },
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not consume a request for a malformed completion identity", async () => {
    const state = createViewerState();
    const pending = postToSandboxWithTimeout(
      state,
      frame(),
      { kind: "renderFrame", requestId: "valid" },
      100,
    );
    completePending(state, { requestId: { toString: 0 } });
    completeRender(state, { requestId: null });
    expect(state.pending.size).toBe(1);
    expect(state.staleResponses).toBe(0);
    completePending(state, { requestId: "valid", ok: true });
    await expect(pending).resolves.toEqual({ requestId: "valid", ok: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels every pending caller and treats late render replies as stale", async () => {
    const state = createViewerState();
    const first = postToSandboxWithTimeout(
      state,
      frame(),
      { kind: "renderFrame", requestId: "first" },
      100,
    );
    const second = postToSandboxWithTimeout(
      state,
      frame(),
      { kind: "renderFrame", requestId: "second" },
      100,
    );
    const settled = Promise.allSettled([first, second]);
    expect(cancelPendingSandboxRequests(state)).toBe(2);
    completeRender(state, { requestId: "first", ok: true });
    const results = await settled;
    for (const result of results) {
      expect(result.status).toBe("rejected");
      const error: unknown =
        result.status === "rejected" ? result.reason : undefined;
      expect(error).toBeInstanceOf(SandboxRuntimeRecoveryError);
    }
    expect(state.pending.size).toBe(0);
    expect(state.staleResponses).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("expires the original request after its sender object changes", async () => {
    const state = createViewerState();
    const coercion = vi.fn<() => never>(() => {
      throw new Error("Must not coerce metadata");
    });
    const request = {
      kind: "renderFrame",
      requestId: "original",
      effectId: { toString: coercion },
    };
    const pending = postToSandboxWithTimeout(state, frame(), request, 100);
    request.requestId = "changed";
    await Promise.all([
      expect(pending).rejects.toMatchObject({
        requestId: "original",
        requestTarget: "",
      }),
      vi.advanceTimersByTimeAsync(100),
    ]);
    expect(state.pending.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(coercion).not.toHaveBeenCalled();
  });

  it("extends only the active request timeout", async () => {
    const state = createViewerState();
    const pending = postToSandboxWithTimeout(
      state,
      frame(),
      { kind: "renderFrame", requestId: "active" },
      100,
    );
    await vi.advanceTimersByTimeAsync(75);
    expect(refreshPendingSandboxRequestTimeout(state, "active")).toBe(true);
    expect(refreshPendingSandboxRequestTimeout(state, "missing")).toBe(false);
    await vi.advanceTimersByTimeAsync(30);
    expect(state.pending.size).toBe(1);
    completePending(state, { requestId: "active", ok: true });
    await pending;
    expect(vi.getTimerCount()).toBe(0);
  });
});
