import { requiredEntry } from "./helpers/required-entry.js";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findCollisionFreeKeyframeOffset } from "../src/apps/viewer/timeline/interaction/keyframe-clipboard";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer keyframe clipboard", () => {
  it("finds one common frame offset without changing relative timing", () => {
    const timeline = {
      tracks: [
        {
          id: "opacity",
          keyframes: [{ id: "existing", time: 1 }],
        },
        {
          id: "scale",
          keyframes: [{ id: "existing-scale", time: 2 }],
        },
      ],
    };
    const clipboard = [
      { keyframe: { id: "a", time: 1 }, trackId: "opacity" },
      { keyframe: { id: "b", time: 2 }, trackId: "scale" },
    ];

    expect(
      findCollisionFreeKeyframeOffset(timeline, clipboard, 0, 4, 1 / 30),
    ).toBeCloseTo(1 / 30);
  });

  it("rejects stale tracks and non-finite placement values", () => {
    const timeline = { tracks: [{ id: "track", keyframes: [] }] };
    expect(
      findCollisionFreeKeyframeOffset(
        timeline,
        [{ trackId: "missing", keyframe: { time: 1 } }],
        0,
        1,
        1 / 30,
      ),
    ).toBeNull();
    expect(
      findCollisionFreeKeyframeOffset(
        timeline,
        [{ trackId: "track", keyframe: { time: NaN } }],
        0,
        1,
        1 / 30,
      ),
    ).toBeNull();
    expect(
      findCollisionFreeKeyframeOffset(timeline, [], Infinity, 1, 1 / 30),
    ).toBeNull();
    expect(
      findCollisionFreeKeyframeOffset(timeline, [], 0, Infinity, 1 / 30),
    ).toBeNull();
    expect(findCollisionFreeKeyframeOffset(timeline, [], 0, 1, 0)).toBeNull();
  });

  it("copies opaque keyframe values without sharing the source payload", () => {
    const ctx = createContext();

    const value = { nested: [true, ""], zero: 0 };
    ctx.state.timelineOverrides.set("template", {
      duration: 4,
      phases: [],
      tracks: [{ id: "opacity", keyframes: [{ id: "a", time: 1, value }] }],
    });
    expect(ctx.copySelectedKeyframes()).toBe(true);
    const copied: unknown = requiredEntry(ctx.state.keyframeClipboard ?? [], 0)
      .keyframe.value;
    expect(copied).toEqual(value);
    expect(copied).not.toBe(value);
  });

  it("keeps an existing clipboard when part of the selected source is missing", () => {
    const ctx = createContext();

    expect(ctx.copySelectedKeyframes()).toBe(true);
    const previous = ctx.state.keyframeClipboard;
    ctx.state.selectedKeyframes.push({
      trackId: "opacity",
      keyframeId: "missing",
    });
    expect(ctx.copySelectedKeyframes()).toBe(false);
    expect(ctx.state.keyframeClipboard).toBe(previous);
    expect(ctx.beginEditorCommand).not.toHaveBeenCalled();
  });

  it("duplicates and deletes the whole selection with one command each", () => {
    const ctx = createContext();
    const originalKeyframes = requiredEntry(
      ctx.deps.normalizeTimeline(ctx.getEffectiveTimeline(), 4).tracks,
      0,
    ).keyframes;

    expect(ctx.duplicateSelectedKeyframes()).toBe(true);
    expect(ctx.beginEditorCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "duplicateKeyframes" }),
    );
    const duplicated = requiredEntry(
      ctx.getEffectiveTimeline().tracks,
      0,
    ).keyframes.find((keyframe) => keyframe.id !== "a");
    if (!duplicated) throw new Error("Missing duplicated keyframe fixture");
    expect(duplicated.time).toBeCloseTo(1 + 1 / 30);
    expect(ctx.state.selectedKeyframes).toEqual([
      { keyframeId: duplicated.id, trackId: "opacity" },
    ]);

    expect(ctx.deleteSelectedKeyframes()).toBe(true);
    expect(ctx.beginEditorCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "deleteKeyframes" }),
    );
    expect(
      requiredEntry(ctx.getEffectiveTimeline().tracks, 0).keyframes,
    ).toEqual(originalKeyframes);
  });
});

function createContext() {
  const ctx = createViewerContextFixture();
  ctx.state.currentTemplate = {
    duration: 4,
    id: "template",
    timeline: {
      duration: 4,
      phases: [],
      tracks: [{ id: "opacity", keyframes: [{ id: "a", time: 1, value: 0 }] }],
    },
  };
  ctx.state.selectedKeyframes = [{ keyframeId: "a", trackId: "opacity" }];
  ctx.refs.fpsInput.value = "30";
  ctx.refs.timeSlider.value = "1";
  const beginEditorCommand = vi
    .spyOn(ctx, "beginEditorCommand")
    .mockImplementation(() => {});
  for (const key of [
    "assignKeyframeOwnershipAtTime",
    "logDiagnostic",
    "renderTimelineEditor",
    "setSidebarGroup",
  ] as const)
    vi.spyOn(ctx, key).mockImplementation(() => {});
  vi.spyOn(ctx, "renderCurrentFrame").mockResolvedValue(undefined);
  vi.spyOn(ctx, "snapTime").mockImplementation((value) => value);
  return Object.assign(ctx, { beginEditorCommand });
}
