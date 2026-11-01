import { createViewerPlaybackFixture } from "./helpers/viewer-playback-fixture.js";
import type { ViewerAppContext } from "../src/apps/viewer/app/context.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  advancePlaybackCacheWarmResult,
  beginPlaybackCacheWarm,
  invalidatePlaybackCacheRangeCoverage,
} from "../src/apps/viewer/playback/cache-warm-controller";

type CacheOverrides = Partial<
  Omit<ViewerAppContext["state"], "previewVideoCache">
> & {
  previewVideoCache?: Partial<ViewerAppContext["state"]["previewVideoCache"]>;
};
function createContext(overrides: CacheOverrides = {}) {
  const ctx = createViewerPlaybackFixture();
  ctx.state.currentTemplate.duration = 1;
  ctx.state.playing = true;
  ctx.state.previewCacheEnabled = true;
  const { previewVideoCache, ...state } = overrides;
  Object.assign(ctx.state, state);
  Object.assign(ctx.state.previewVideoCache, previewVideoCache);
  ctx.lastPlaybackAudioTs = 0;
  ctx.lastPlaybackRenderTs = 10;
  ctx.lastPlaybackTs = 10;
  ctx.lastPlaybackUiTs = 10;
  return ctx;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
    const syncPlaybackCacheButton = vi
      .spyOn(ctx, "syncPlaybackCacheButton")
      .mockImplementation(() => {});

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
    expect(syncPlaybackCacheButton).toHaveBeenCalledOnce();
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
