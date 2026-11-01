import { afterEach, describe, expect, it, vi } from "vitest";

import { beginSandboxRenderProgress } from "../src/apps/sandbox/runtime/render-progress";

describe("sandbox render progress", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps the watchdog alive across queue, render, and cache phases", async () => {
    vi.useFakeTimers();
    const post =
      vi.fn<Parameters<typeof beginSandboxRenderProgress>[0]["post"]>();
    const progress = beginSandboxRenderProgress({
      post,
      requestId: "frame:slow",
      sequenceId: 9,
    });

    await vi.advanceTimersByTimeAsync(260);
    expect(post).toHaveBeenLastCalledWith({
      kind: "renderFrameProgress",
      phase: "queued",
      requestId: "frame:slow",
      sequenceId: 9,
    });

    progress.setPhase("rendering");
    await vi.advanceTimersByTimeAsync(250);
    expect(post).toHaveBeenLastCalledWith({
      kind: "renderFrameProgress",
      phase: "rendering",
      requestId: "frame:slow",
      sequenceId: 9,
    });

    progress.setPhase("preview-cache-store");
    await vi.advanceTimersByTimeAsync(250);
    expect(post).toHaveBeenLastCalledWith({
      kind: "renderFrameProgress",
      phase: "preview-cache-store",
      requestId: "frame:slow",
      sequenceId: 9,
    });

    progress.stop();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(post).toHaveBeenCalledTimes(3);
  });

  it("eventually releases a responsive but unresolved render", async () => {
    vi.useFakeTimers();
    const post =
      vi.fn<Parameters<typeof beginSandboxRenderProgress>[0]["post"]>();
    beginSandboxRenderProgress({
      post,
      requestId: "frame:unresolved",
      sequenceId: 10,
    });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(post).toHaveBeenCalledTimes(180);
  });

  it("keeps an explicitly requested cache render alive beyond the ordinary limit", async () => {
    vi.useFakeTimers();
    const post =
      vi.fn<Parameters<typeof beginSandboxRenderProgress>[0]["post"]>();
    const progress = beginSandboxRenderProgress({
      post,
      previewCacheEnabled: true,
      requestId: "frame:cache-slow",
      sequenceId: 11,
    });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(post.mock.calls.length).toBeGreaterThan(180);
    expect(post).toHaveBeenLastCalledWith({
      kind: "renderFrameProgress",
      phase: "queued",
      requestId: "frame:cache-slow",
      sequenceId: 11,
    });
    progress.stop();
  });
});
