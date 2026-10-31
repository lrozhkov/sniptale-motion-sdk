import { describe, expect, it, vi } from "vitest";

import { createTransportRuntimeActions } from "../src/apps/viewer/transport/runtime-recovery";
import { SandboxRequestTimeoutError } from "../src/apps/viewer/transport/sandbox-client";

describe("viewer sandbox runtime recovery", () => {
  it("restarts once and clears the guard only after a healthy frame", async () => {
    const firstTimeout = new SandboxRequestTimeoutError(
      "frame:1",
      "renderFrame",
      900,
    );
    const secondTimeout = new SandboxRequestTimeoutError(
      "frame:2",
      "renderFrame",
      900,
    );
    const postToSandboxWithTimeout = vi
      .fn()
      .mockRejectedValueOnce(firstTimeout)
      .mockRejectedValueOnce(secondTimeout);
    const pendingReject = vi.fn();
    const logDiagnostic = vi.fn();
    const close = vi.fn();
    const stopPlaybackForRuntimeRecovery = vi.fn();
    const ctx = {
      createSandboxUrl: () => "http://localhost:4178/sandbox.html",
      deps: {
        postToSandboxWithTimeout,
        t: (_key, fallback) => fallback,
      },
      logDiagnostic,
      refs: {
        sandboxFrame: {
          src: "http://localhost:4178/sandbox.html",
        },
      },
      state: {
        currentTemplate: { id: "complex" },
        directRenderResponsePort: { close },
        pending: new Map([
          ["contract:1", { reject: pendingReject, timer: 42 }],
        ]),
        queuedRenderOptions: { interactive: true },
        renderQueued: true,
        sandboxReady: true,
        sandboxRecoveryAttempts: 0,
        sandboxRecoveryKey: null,
        sandboxRecoveryPending: false,
        sandboxRuntimeGeneration: 0,
      },
      stopPlaybackForRuntimeRecovery,
    } as any;
    vi.stubGlobal("window", {
      clearTimeout: vi.fn(),
      location: { href: "http://127.0.0.1:4177/" },
    });
    Object.assign(
      ctx,
      createTransportRuntimeActions(() => ctx),
    );
    try {
      await expect(
        ctx.requestSandbox(
          { effectId: "complex", kind: "renderFrame", requestId: "frame:1" },
          900,
        ),
      ).rejects.toBe(firstTimeout);
      expect(firstTimeout.recoveryStarted).toBe(true);
      expect(ctx.state.sandboxReady).toBe(false);
      expect(ctx.state.sandboxRuntimeGeneration).toBe(1);
      expect(ctx.state.renderQueued).toBe(false);
      expect(ctx.state.queuedRenderOptions).toBeNull();
      expect(close).toHaveBeenCalledOnce();
      expect(stopPlaybackForRuntimeRecovery).toHaveBeenCalledOnce();
      expect(pendingReject).toHaveBeenCalledOnce();
      expect(ctx.refs.sandboxFrame.src).toContain("runtimeRestart=");
      expect(logDiagnostic).toHaveBeenCalledOnce();

      await expect(
        ctx.requestSandbox(
          { effectId: "complex", kind: "renderFrame", requestId: "frame:2" },
          900,
        ),
      ).rejects.toBe(secondTimeout);
      expect(secondTimeout.recoveryStarted).toBe(false);
      expect(close).toHaveBeenCalledOnce();

      ctx.markSandboxRuntimeReady();
      expect(ctx.state.sandboxRecoveryPending).toBe(false);
      ctx.markSandboxRenderHealthy("complex");
      expect(ctx.state.sandboxRecoveryAttempts).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
