import { createViewerState } from "../src/apps/viewer/app/state.js";
import { describe, expect, it } from "vitest";

import { createPlaybackVideoCacheSegmentPlan } from "../src/apps/viewer/playback/video-cache-segments";
import {
  advancePlaybackVideoSegmentWarm,
  beginPlaybackVideoSegmentWarm,
} from "../src/apps/viewer/playback/video-cache-warm";

describe("viewer playback video cache segments", () => {
  it("splits a selected range into contiguous bounded segments", () => {
    expect(
      createPlaybackVideoCacheSegmentPlan(
        {
          endFrame: 41,
          endTime: 5,
          startFrame: 0,
          startTime: 0,
        },
        8,
      ),
    ).toEqual([
      {
        endFrame: 16,
        endTime: 2,
        index: 0,
        startFrame: 0,
        startTime: 0,
      },
      {
        endFrame: 32,
        endTime: 4,
        index: 1,
        startFrame: 16,
        startTime: 2,
      },
      {
        endFrame: 41,
        endTime: 5,
        index: 2,
        startFrame: 32,
        startTime: 4,
      },
    ]);
  });

  it("keeps unsupported codecs on one complete segment", () => {
    expect(
      createPlaybackVideoCacheSegmentPlan(
        {
          endFrame: 31,
          endTime: 3,
          startFrame: 10,
          startTime: 1,
        },
        10,
        false,
      ),
    ).toEqual([
      {
        endFrame: 31,
        endTime: 3,
        index: 0,
        startFrame: 10,
        startTime: 1,
      },
    ]);
  });

  it.each([[-1], [0.5], [2], [0, 2]])(
    "rejects an invalid pending plan before warming: %j",
    (...pending) => {
      const state = createViewerState();
      const cache = state.previewVideoCache;
      const before = structuredClone(cache);
      const segments = createPlaybackVideoCacheSegmentPlan(
        { startFrame: 0, endFrame: 8, startTime: 0, endTime: 1 },
        8,
      );
      expect(
        beginPlaybackVideoSegmentWarm(state, cache, {
          currentTime: 0,
          duration: 1,
          fps: 8,
          pendingSegmentIndexes: pending,
          segments,
        }),
      ).toBe(false);
      expect(cache).toEqual(before);
      expect(state.previewCacheWarmActive).toBe(false);
    },
  );

  it("skips reusable middle segments during partial regeneration", () => {
    const segments = createPlaybackVideoCacheSegmentPlan(
      {
        endFrame: 41,
        endTime: 5,
        startFrame: 0,
        startTime: 0,
      },
      8,
    );
    const state: any = {
      previewCacheWarmActive: false,
      previewCacheWarmPrepared: false,
    };
    const cache: any = {};

    expect(
      beginPlaybackVideoSegmentWarm(state, cache, {
        currentTime: 0,
        duration: 5,
        fps: 8,
        pendingSegmentIndexes: [0, 2],
        segments,
      }),
    ).toBe(true);
    expect(state.previewCacheWarmTargetFrames).toBe(25);
    expect(cache.segmentIndex).toBe(0);
    expect(
      advancePlaybackVideoSegmentWarm(state, cache, {
        currentFrame: 15,
        fps: 8,
        segments,
      }),
    ).toMatchObject({ finished: false, time: 4 });
    expect(cache.pendingSegmentCursor).toBe(1);
  });
});
