import { describe, expect, it } from "vitest";

import {
  recordPreviewCacheWarmSample,
  resetPreviewCacheWarmEstimate,
  resolvePreviewCacheWarmRemainingMs,
} from "../src/apps/viewer/playback/cache-warm-estimate";

describe("viewer preview cache warm estimate", () => {
  it("waits for current-pass evidence instead of reusing unrelated latency", () => {
    const state = {
      averagePreviewLatencyMs: 20,
      previewCacheWarmActive: true,
      previewCacheWarmAverageFrameMs: 0,
      previewCacheWarmElapsedMs: 0,
      previewCacheWarmSampleCount: 0,
      previewCacheWarmTargetFrames: 196,
      previewCacheWarmVisitedFrames: 1,
    };

    recordPreviewCacheWarmSample(state, 1200);

    expect(resolvePreviewCacheWarmRemainingMs(state)).toBeNull();
    expect(state.previewCacheWarmSampleCount).toBe(1);
  });

  it("uses the slower of cumulative and recent throughput for an honest ETA", () => {
    const state = {
      previewCacheWarmActive: true,
      previewCacheWarmAverageFrameMs: 0,
      previewCacheWarmElapsedMs: 0,
      previewCacheWarmSampleCount: 0,
      previewCacheWarmTargetFrames: 10,
      previewCacheWarmVisitedFrames: 3,
    };

    recordPreviewCacheWarmSample(state, 100);
    recordPreviewCacheWarmSample(state, 100);
    recordPreviewCacheWarmSample(state, 100);
    recordPreviewCacheWarmSample(state, 100);
    recordPreviewCacheWarmSample(state, 1000);

    state.previewCacheWarmVisitedFrames = 5;
    expect(state.previewCacheWarmElapsedMs).toBe(1400);
    expect(state.previewCacheWarmSampleCount).toBe(5);
    expect(state.previewCacheWarmAverageFrameMs).toBeCloseTo(325);
    expect(resolvePreviewCacheWarmRemainingMs(state)).toBeCloseTo(1868.75);
  });

  it("resets timing when a new pass starts and ignores paused samples", () => {
    const state = {
      previewCacheWarmActive: true,
      previewCacheWarmAverageFrameMs: 900,
      previewCacheWarmElapsedMs: 2700,
      previewCacheWarmSampleCount: 3,
    };

    resetPreviewCacheWarmEstimate(state);
    state.previewCacheWarmActive = false;
    recordPreviewCacheWarmSample(state, 5000);

    expect(state).toMatchObject({
      previewCacheWarmAverageFrameMs: 0,
      previewCacheWarmElapsedMs: 0,
      previewCacheWarmSampleCount: 0,
    });
  });
});
