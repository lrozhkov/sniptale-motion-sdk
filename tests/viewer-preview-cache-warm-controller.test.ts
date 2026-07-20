import { describe, expect, it, vi } from "vitest";

import {
  advancePlaybackCacheWarmResult,
  beginPlaybackCacheWarm,
  invalidatePlaybackCacheRangeCoverage,
} from "../src/apps/viewer/playback/cache-warm-controller";

function createContext(overrides: Record<string, unknown> = {}) {
  const state = {
    playbackRange: null,
    playing: true,
    previewCacheEnabled: true,
    previewCacheWarmActive: false,
    previewCacheWarmCapacityLimited: false,
    previewCacheWarmPrepared: false,
    previewCacheWarmPublicTime: 0,
    previewCacheWarmRangeEndFrame: 0,
    previewCacheWarmRangeStartFrame: 0,
    previewCacheWarmRenderTime: 0,
    previewCacheWarmScale: 0,
    previewCacheWarmStartTime: 0,
    previewCacheWarmTargetFrames: 0,
    previewCacheWarmUnsupportedResults: 0,
    previewCacheWarmVisitedFrames: 0,
    previewFrameCacheComplete: false,
    ...overrides,
  };
  return {
    formatSeconds: (time: number) => `${time}s`,
    getEffectiveDuration: () => 1,
    isPreviewFullscreenActive: () => false,
    lastPlaybackAudioTs: 0,
    lastPlaybackRenderTs: 10,
    lastPlaybackTs: 10,
    lastPlaybackUiTs: 10,
    refs: {
      fpsInput: { value: "30" },
      fullscreenTimeOutput: null,
      fullscreenTimeSlider: null,
      timeOutput: { textContent: "" },
      timeSlider: { value: "0" },
    },
    state,
    stopPreviewAudio: vi.fn(),
    syncPreviewAudio: vi.fn(),
    updateTimelinePlayhead: vi.fn(),
  } as any;
}

describe("viewer preview cache warm controller", () => {
  it("invalidates paused exact-frame coverage when the playback range changes", () => {
    const ctx = createContext({
      previewCacheWarmActive: true,
      previewCacheWarmCapacityLimited: true,
      previewCacheWarmPrepared: true,
      previewCacheWarmRangeEndFrame: 181,
      previewCacheWarmTargetFrames: 181,
      previewCacheWarmVisitedFrames: 12,
      previewFrameCacheComplete: true,
      previewFrameCacheEntries: 12,
      previewFrameCacheFrames: 12,
      previewFrameCacheTotalFrames: 181,
      previewVideoCache: {},
    });
    ctx.syncPlaybackCacheButton = vi.fn();
    ctx.syncPreviewQualityBadge = vi.fn();

    invalidatePlaybackCacheRangeCoverage(ctx);

    expect(ctx.state).toMatchObject({
      previewCacheWarmActive: false,
      previewCacheWarmCapacityLimited: false,
      previewCacheWarmPrepared: false,
      previewCacheWarmRangeEndFrame: 0,
      previewCacheWarmTargetFrames: 0,
      previewCacheWarmVisitedFrames: 0,
      previewFrameCacheComplete: false,
      previewFrameCacheEntries: 0,
      previewFrameCacheFrames: 0,
      previewFrameCacheTotalFrames: 0,
    });
    expect(ctx.syncPlaybackCacheButton).toHaveBeenCalledOnce();
    expect(ctx.syncPreviewQualityBadge).toHaveBeenCalledOnce();
  });

  it("keeps range-independent video cache preparation intact", () => {
    const ctx = createContext({
      previewCacheWarmActive: true,
      previewCacheWarmTargetFrames: 181,
      previewVideoCache: { recording: true },
    });

    invalidatePlaybackCacheRangeCoverage(ctx);

    expect(ctx.state.previewCacheWarmActive).toBe(true);
    expect(ctx.state.previewCacheWarmTargetFrames).toBe(181);
  });

  it("never starts fallback preparation in Live mode", () => {
    const ctx = createContext({ previewCacheEnabled: false });

    const step = advancePlaybackCacheWarmResult(
      ctx,
      { previewCacheComplete: false, previewCacheHit: false },
      { currentTime: 0, duration: 1, fps: 30 },
    );

    expect(step).toBeNull();
    expect(ctx.state.previewCacheWarmActive).toBe(false);
    expect(ctx.stopPreviewAudio).not.toHaveBeenCalled();
  });

  it("does not loop preparation after the lossless cache reaches its memory limit", () => {
    const ctx = createContext({ previewCacheWarmCapacityLimited: true });

    const step = advancePlaybackCacheWarmResult(
      ctx,
      { previewCacheComplete: false, previewCacheHit: false },
      { currentTime: 0, duration: 1, fps: 30 },
    );

    expect(step).toBeNull();
    expect(ctx.state.previewCacheWarmActive).toBe(false);
    expect(ctx.stopPreviewAudio).not.toHaveBeenCalled();
  });

  it("restarts warming when an edit invalidates a previously prepared cache", () => {
    const ctx = createContext({ previewCacheWarmPrepared: true });

    const step = advancePlaybackCacheWarmResult(
      ctx,
      { previewCacheComplete: false, previewCacheHit: false },
      { currentTime: 0, duration: 1, fps: 30 },
    );

    expect(step).toEqual({
      finished: false,
      prepared: false,
      time: 1 / 30,
    });
    expect(ctx.state.previewCacheWarmActive).toBe(true);
    expect(ctx.state.previewCacheWarmPrepared).toBe(false);
    expect(ctx.stopPreviewAudio).toHaveBeenCalledOnce();
  });

  it("keeps the public playhead stable when coverage completes", () => {
    const ctx = createContext();
    ctx.refs.timeSlider.value = "0.4";
    expect(beginPlaybackCacheWarm(ctx)).toBe(true);

    const step = advancePlaybackCacheWarmResult(
      ctx,
      { previewCacheComplete: true, previewCacheHit: false },
      { currentTime: 0, duration: 1, fps: 30 },
    );

    expect(step).toEqual({ finished: true, prepared: true, time: 0.4 });
    expect(ctx.state.previewCacheWarmPrepared).toBe(true);
    expect(ctx.refs.timeSlider.value).toBe("0.4");
    expect(ctx.syncPreviewAudio).toHaveBeenCalledWith(0.4);
    expect(ctx.lastPlaybackRenderTs).toBe(0);
    expect(ctx.updateTimelinePlayhead).not.toHaveBeenCalled();
  });

  it("records only the current warm pass latency for its ETA", () => {
    const ctx = createContext();
    expect(beginPlaybackCacheWarm(ctx)).toBe(true);

    advancePlaybackCacheWarmResult(
      ctx,
      { previewCacheComplete: false, previewCacheHit: false },
      { currentTime: 0, duration: 1, fps: 30, frameLatencyMs: 1250 },
    );

    expect(ctx.state.previewCacheWarmAverageFrameMs).toBe(1250);
    expect(ctx.state.previewCacheWarmElapsedMs).toBe(1250);
    expect(ctx.state.previewCacheWarmSampleCount).toBe(1);
  });

  it("does not contaminate the ETA with an unsupported pre-warm result", () => {
    const ctx = createContext();
    expect(beginPlaybackCacheWarm(ctx)).toBe(true);

    advancePlaybackCacheWarmResult(
      ctx,
      {},
      { currentTime: 0, duration: 1, fps: 30, frameLatencyMs: 5000 },
    );

    expect(ctx.state.previewCacheWarmElapsedMs).toBe(0);
    expect(ctx.state.previewCacheWarmSampleCount).toBe(0);
  });

  it("restarts an active pass when edited content resets cache coverage", () => {
    const ctx = createContext();
    beginPlaybackCacheWarm(ctx);
    ctx.state.previewCacheWarmVisitedFrames = 8;

    const step = advancePlaybackCacheWarmResult(
      ctx,
      {
        previewCacheComplete: false,
        previewCacheFrames: 1,
        previewCacheHit: false,
      },
      {
        currentTime: 0,
        duration: 1,
        fps: 30,
        previousCacheFrames: 8,
      },
    );

    expect(step).toEqual({
      finished: false,
      prepared: false,
      time: 1 / 30,
    });
    expect(ctx.state.previewCacheWarmVisitedFrames).toBe(1);
    expect(ctx.state.previewCacheWarmTargetFrames).toBe(31);
  });
});
