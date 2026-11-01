import { afterEach, describe, expect, it, vi } from "vitest";

import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import type { PendingSandboxRequest } from "../src/apps/viewer/transport/state.js";
import type { DirectRenderResponsePort } from "../src/apps/viewer/transport/direct-render-channel.js";

import { SandboxRequestTimeoutError } from "../src/apps/viewer/transport/sandbox-client";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
    const ctx = createViewerContextFixture();
    vi.spyOn(ctx.deps, "postToSandboxWithTimeout")
      .mockRejectedValueOnce(firstTimeout)
      .mockRejectedValueOnce(secondTimeout);
    const pendingReject = vi.fn<PendingSandboxRequest["reject"]>();
    const logDiagnostic = vi
      .spyOn(ctx, "logDiagnostic")
      .mockImplementation(() => {});
    const close = vi.fn<DirectRenderResponsePort["close"]>();
    const stopPlaybackForRuntimeRecovery = vi
      .spyOn(ctx, "stopPlaybackForRuntimeRecovery")
      .mockImplementation(() => {});
    vi.spyOn(ctx, "createSandboxUrl").mockReturnValue(
      "http://localhost:4178/sandbox.html",
    );
    ctx.deps.t = (key, fallback) => fallback ?? key;
    ctx.refs.sandboxFrame.src = "http://localhost:4178/sandbox.html";
    ctx.state.currentTemplate = { id: "complex", duration: 1 };
    ctx.state.directRenderResponsePort = {
      close,
      postMessage: vi.fn<DirectRenderResponsePort["postMessage"]>(),
      presentationSurfaceAttached: true,
    };
    ctx.state.pending.set("contract:1", {
      reject: pendingReject,
      timer: 42,
      expire: vi.fn<PendingSandboxRequest["expire"]>(),
      resolve: vi.fn<PendingSandboxRequest["resolve"]>(),
      timeoutMs: 900,
    });
    ctx.state.queuedRenderOptions = { interactive: true };
    ctx.state.renderQueued = true;
    ctx.state.sandboxReady = true;
    vi.stubGlobal("window", {
      clearTimeout: vi.fn<Window["clearTimeout"]>(),
      location: { href: "http://127.0.0.1:4177/" },
    });
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
  });
});
