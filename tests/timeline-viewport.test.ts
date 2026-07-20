import { describe, expect, it } from "vitest";

import {
  calculateFrameTimelineRangeState,
  calculateTimelinePlaybackStep,
  calculatePannedTimelineOffset,
  calculateTimelineViewport,
  calculateTimelineZoomState,
  getTimelineTickStep,
  normalizeTimelinePlaybackRange,
  snapTimelineDuration,
  snapTimelineTime,
  timelinePercentForViewport,
} from "../src/apps/viewer/timeline/viewport";

describe("timeline viewport model", () => {
  it("clamps viewport zoom and offset", () => {
    expect(calculateTimelineViewport(10, 20, 99)).toEqual({
      end: 10,
      maxStart: 8.75,
      span: 1.25,
      start: 8.75,
      zoom: 8,
    });
  });

  it("keeps zoom anchored around the requested time", () => {
    expect(
      calculateTimelineZoomState({
        anchorTime: 6,
        currentOffset: 0,
        currentZoom: 1,
        duration: 12,
        nextZoom: 2,
      }),
    ).toEqual({ offset: 3, zoom: 2 });
  });

  it("snaps time and duration according to mode", () => {
    expect(
      snapTimelineTime(1.234, { duration: 10, fps: 30, snapMode: "frames" }),
    ).toBe(1.2333333333333334);
    expect(
      snapTimelineTime(1.234, { duration: 10, fps: 30, snapMode: "tenths" }),
    ).toBe(1.2);
    expect(snapTimelineDuration(0.01, { fps: 30, snapMode: "free" })).toBe(
      0.05,
    );
  });

  it("calculates panning, ticks, percent, and selected range framing", () => {
    const viewport = calculateTimelineViewport(10, 2, 1);

    expect(
      calculatePannedTimelineOffset({
        currentOffset: 1,
        currentZoom: 2,
        deltaSeconds: 3,
        duration: 10,
      }),
    ).toBe(4);
    expect(getTimelineTickStep(viewport.span)).toBe(0.5);
    expect(timelinePercentForViewport(3.5, viewport)).toBe(50);
    expect(calculateFrameTimelineRangeState(2, 4, 10)).toEqual({
      center: 3,
      offset: 1.1,
      zoom: 2.6315789473684212,
    });
  });

  it("normalizes playback range and keeps playback inside the range", () => {
    expect(normalizeTimelinePlaybackRange({ end: 2, start: 5 }, 10)).toEqual({
      end: 5,
      start: 2,
    });
    expect(normalizeTimelinePlaybackRange({ end: 2, start: 2 }, 10)).toBeNull();
    expect(
      calculateTimelinePlaybackStep({
        current: 6,
        deltaSeconds: 1,
        duration: 10,
        loop: false,
        range: { end: 5, start: 2 },
      }),
    ).toEqual({
      finished: false,
      range: { end: 5, start: 2 },
      time: 3,
    });
    expect(
      calculateTimelinePlaybackStep({
        current: 4.5,
        deltaSeconds: 1,
        duration: 10,
        loop: false,
        range: { end: 5, start: 2 },
      }),
    ).toEqual({
      finished: true,
      range: { end: 5, start: 2 },
      time: 5,
    });
    expect(
      calculateTimelinePlaybackStep({
        current: 4.5,
        deltaSeconds: 1,
        duration: 10,
        loop: true,
        range: { end: 5, start: 2 },
      }),
    ).toEqual({
      finished: false,
      range: { end: 5, start: 2 },
      time: 2.5,
    });
  });
});
