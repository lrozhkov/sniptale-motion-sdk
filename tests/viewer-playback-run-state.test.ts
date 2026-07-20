import { describe, expect, it, vi } from "vitest";

import { beginPlaybackRun } from "../src/apps/viewer/playback/run";
import {
  beginPlaybackRunState,
  isPlaybackRunCurrent,
  pausePlaybackRunState,
  resolvePlaybackRunPhase,
} from "../src/apps/viewer/playback/run-state";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function createRunContext() {
  return {
    beginPlaybackVideoCache: vi.fn(),
    refs: {
      fpsInput: { value: "30" },
      timeSlider: { value: "0" },
    },
    schedulePlaybackTick: vi.fn(),
    shouldPreferPlaybackVideoCache: vi.fn(() => true),
    stopPreviewAudio: vi.fn(),
    syncPreviewAudio: vi.fn(),
    state: {
      currentTemplate: { id: "composition" },
      playbackRun: {
        generation: 0,
        mode: "cache",
        phase: "idle",
        templateId: "composition",
      },
      playing: true,
      previewCacheEnabled: true,
      previewCacheWarmActive: false,
      previewFrameCacheComplete: false,
      previewVideoCache: {
        finalizing: false,
        playbackActive: false,
        preparePromise: null,
        preparing: false,
        recording: false,
      },
    },
  } as any;
}

describe("viewer playback run state", () => {
  it("derives one canonical phase from live, preparation, cache, and recovery state", () => {
    const state = {
      playing: true,
      previewCacheEnabled: true,
      previewCacheWarmActive: false,
      previewFrameCacheComplete: false,
      previewVideoCache: {
        finalizing: false,
        playbackActive: false,
        preparePromise: null,
        preparing: false,
        recording: false,
      },
      sandboxRecoveryPending: false,
    };

    expect(resolvePlaybackRunPhase(state)).toBe("live");
    state.previewCacheWarmActive = true;
    expect(resolvePlaybackRunPhase(state)).toBe("preparing-frame-cache");
    state.previewVideoCache.playbackActive = true;
    expect(resolvePlaybackRunPhase(state)).toBe("preparing-frame-cache");
    state.previewCacheWarmActive = false;
    state.previewVideoCache.recording = true;
    expect(resolvePlaybackRunPhase(state)).toBe("preparing-video-cache");
    state.playing = false;
    expect(resolvePlaybackRunPhase(state)).toBe("paused-preparation");
    state.previewVideoCache.recording = false;
    expect(resolvePlaybackRunPhase(state)).toBe("idle");
    state.sandboxRecoveryPending = true;
    expect(resolvePlaybackRunPhase(state)).toBe("recovering");
  });

  it("invalidates a pending asynchronous start when the user pauses", async () => {
    const ctx = createRunContext();
    const videoPreparation = deferred<
      "playback" | "recording" | "unavailable"
    >();
    ctx.beginPlaybackVideoCache.mockReturnValue(videoPreparation.promise);
    const token = beginPlaybackRunState(ctx);
    const pendingRun = beginPlaybackRun(ctx, token);

    ctx.state.playing = false;
    pausePlaybackRunState(ctx, true);
    videoPreparation.resolve("recording");
    await pendingRun;

    expect(isPlaybackRunCurrent(ctx, token)).toBe(false);
    expect(ctx.state.playbackRun.phase).toBe("paused-preparation");
    expect(ctx.stopPreviewAudio).toHaveBeenCalledOnce();
    expect(ctx.schedulePlaybackTick).not.toHaveBeenCalled();
  });

  it("does not let an older cache response overwrite a newer live run", async () => {
    const ctx = createRunContext();
    const videoPreparation = deferred<
      "playback" | "recording" | "unavailable"
    >();
    ctx.beginPlaybackVideoCache.mockReturnValue(videoPreparation.promise);
    const oldToken = beginPlaybackRunState(ctx);
    const oldRun = beginPlaybackRun(ctx, oldToken);

    ctx.state.previewCacheEnabled = false;
    const liveToken = beginPlaybackRunState(ctx);
    await beginPlaybackRun(ctx, liveToken);
    videoPreparation.resolve("recording");
    await oldRun;

    expect(ctx.state.playbackRun).toMatchObject({
      generation: liveToken.generation,
      mode: "live",
      phase: "live",
    });
    expect(ctx.schedulePlaybackTick).toHaveBeenCalledTimes(1);
  });

  it("starts audio together with an already prepared cached video", async () => {
    const ctx = createRunContext();
    ctx.beginPlaybackVideoCache.mockResolvedValue("playback");

    await beginPlaybackRun(ctx, beginPlaybackRunState(ctx));

    expect(ctx.stopPreviewAudio).toHaveBeenCalledOnce();
    expect(ctx.syncPreviewAudio).toHaveBeenCalledWith(0);
    expect(ctx.state.playbackRun.phase).toBe("cached-video-playback");
    expect(ctx.schedulePlaybackTick).toHaveBeenCalledOnce();
  });
});
