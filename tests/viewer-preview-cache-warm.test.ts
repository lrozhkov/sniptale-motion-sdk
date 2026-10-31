import { describe, expect, it } from "vitest";

import {
  advancePreviewCacheWarm,
  beginPreviewCacheWarm,
  cancelPreviewCacheWarm,
  resolvePreviewCacheRenderTime,
  resolvePreviewCacheWarmProgress,
} from "../src/apps/viewer/playback/cache-warm";

function createState(overrides: Record<string, unknown> = {}) {
  return {
    playing: false,
    previewCacheWarmActive: false,
    previewCacheWarmAverageFrameMs: 0,
    previewCacheWarmElapsedMs: 0,
    previewCacheWarmSampleCount: 0,
    previewCacheWarmScale: 0,
    previewCacheWarmCapacityLimited: false,
    previewCacheWarmPrepared: false,
    previewCacheWarmPublicTime: 0,
    previewCacheWarmRangeEndFrame: 0,
    previewCacheWarmRangeStartFrame: 0,
    previewCacheWarmRenderTime: 0,
    previewCacheWarmStartTime: 0,
    previewCacheWarmTargetFrames: 0,
    previewCacheWarmUnsupportedResults: 0,
    previewCacheWarmVisitedFrames: 0,
    previewFrameCacheComplete: false,
    ...overrides,
  };
}

describe("viewer preview cache warm playback", () => {
  it("walks every frame once and restarts from the requested time", () => {
    const state = createState();
    const options = { currentTime: 0, duration: 0.1, fps: 30 };

    expect(beginPreviewCacheWarm(state, options)).toBe(true);
    expect(state.previewCacheWarmPublicTime).toBe(0);
    expect(resolvePreviewCacheRenderTime(state, 0.08)).toBe(0.08);
    state.playing = true;
    expect(resolvePreviewCacheRenderTime(state, 0.08)).toBe(0);
    expect(
      advancePreviewCacheWarm(state, { previewCacheHit: false }, options),
    ).toEqual({ finished: false, prepared: false, time: 1 / 30 });
    expect(state.previewCacheWarmRenderTime).toBe(1 / 30);
    expect(resolvePreviewCacheWarmProgress(state)).toBeCloseTo(1 / 4);
    expect(
      advancePreviewCacheWarm(
        state,
        { previewCacheHit: false },
        { ...options, currentTime: 1 / 30 },
      ),
    ).toEqual({ finished: false, prepared: false, time: 2 / 30 });
    expect(
      advancePreviewCacheWarm(
        state,
        { previewCacheHit: false },
        { ...options, currentTime: 2 / 30 },
      ),
    ).toEqual({ finished: false, prepared: false, time: 0.1 });
    expect(
      advancePreviewCacheWarm(
        state,
        { previewCacheComplete: true, previewCacheHit: false },
        { ...options, currentTime: 0.1 },
      ),
    ).toEqual({ finished: true, prepared: true, time: 0 });
    expect(state.previewCacheWarmPrepared).toBe(true);
    expect(resolvePreviewCacheRenderTime(state, 0.08)).toBe(0.08);
  });

  it("warms only the selected playback range", () => {
    const state = createState();
    const options = {
      currentTime: 1,
      duration: 4,
      fps: 10,
      range: { end: 1.3, start: 1 },
    };

    beginPreviewCacheWarm(state, options);
    expect(state.previewCacheWarmTargetFrames).toBe(4);
    expect(
      advancePreviewCacheWarm(state, { previewCacheHit: true }, options),
    ).toMatchObject({ time: 1.1 });
  });

  it("stops retrying when a complete lossless sequence exceeds the cache budget", () => {
    const state = createState();
    const options = { currentTime: 0, duration: 0.1, fps: 30 };
    expect(beginPreviewCacheWarm(state, options)).toBe(true);

    let step;
    do {
      step = advancePreviewCacheWarm(
        state,
        { previewCacheComplete: false, previewCacheHit: false },
        options,
      );
    } while (step && !step.finished);

    expect(step).toEqual({ finished: true, prepared: false, time: 0 });
    expect(state.previewCacheWarmCapacityLimited).toBe(true);
    expect(state.previewCacheWarmPrepared).toBe(false);
  });

  it("skips a prepared surface and safely exits unsupported caching", () => {
    const prepared = createState({ previewCacheWarmPrepared: true });
    expect(
      beginPreviewCacheWarm(prepared, {
        currentTime: 0,
        duration: 1,
        fps: 30,
      }),
    ).toBe(false);

    const unsupported = createState();
    const options = { currentTime: 0.4, duration: 1, fps: 30 };
    beginPreviewCacheWarm(unsupported, options);
    expect(advancePreviewCacheWarm(unsupported, {}, options)).toEqual({
      finished: false,
      prepared: false,
      time: 0.4,
    });
    expect(advancePreviewCacheWarm(unsupported, {}, options)).toEqual({
      finished: false,
      prepared: false,
      time: 0.4,
    });
    expect(advancePreviewCacheWarm(unsupported, {}, options)).toEqual({
      finished: true,
      prepared: false,
      time: 0.4,
    });
    cancelPreviewCacheWarm(unsupported);
    expect(unsupported.previewCacheWarmActive).toBe(false);
  });
});
