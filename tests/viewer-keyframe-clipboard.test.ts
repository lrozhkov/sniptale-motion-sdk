import { describe, expect, it, vi } from "vitest";

import {
  findCollisionFreeKeyframeOffset,
  createKeyframeClipboardActions,
} from "../src/apps/viewer/timeline/interaction/keyframe-clipboard";

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
    Object.assign(
      ctx,
      createKeyframeClipboardActions(() => ctx),
    );
    const value = { nested: [true, ""], zero: 0 };
    ctx.state.timelineOverrides.set("template", {
      duration: 4,
      phases: [],
      tracks: [{ id: "opacity", keyframes: [{ id: "a", time: 1, value }] }],
    });
    expect(ctx.copySelectedKeyframes()).toBe(true);
    const copied: unknown = ctx.state.keyframeClipboard[0].keyframe.value;
    expect(copied).toEqual(value);
    expect(copied).not.toBe(value);
  });

  it("keeps an existing clipboard when part of the selected source is missing", () => {
    const ctx = createContext();
    Object.assign(
      ctx,
      createKeyframeClipboardActions(() => ctx),
    );
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
    Object.assign(
      ctx,
      createKeyframeClipboardActions(() => ctx),
    );

    expect(ctx.duplicateSelectedKeyframes()).toBe(true);
    expect(ctx.beginEditorCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "duplicateKeyframes" }),
    );
    const duplicated = ctx.state.timelineOverrides
      .get("template")
      .tracks[0].keyframes.find((keyframe) => keyframe.id !== "a");
    expect(duplicated.time).toBeCloseTo(1 + 1 / 30);
    expect(ctx.state.selectedKeyframes).toEqual([
      { keyframeId: duplicated.id, trackId: "opacity" },
    ]);

    expect(ctx.deleteSelectedKeyframes()).toBe(true);
    expect(ctx.beginEditorCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "deleteKeyframes" }),
    );
    expect(
      ctx.state.timelineOverrides.get("template").tracks[0].keyframes,
    ).toEqual([{ id: "a", time: 1, value: 0 }]);
  });
});

function createContext(): any {
  const template = { duration: 4, id: "template" };
  const baseTimeline = {
    duration: 4,
    phases: [],
    tracks: [
      {
        id: "opacity",
        keyframes: [{ id: "a", time: 1, value: 0 }],
      },
    ],
  };
  const state: any = {
    currentTemplate: template,
    keyframeClipboard: null,
    selectedKeyframes: [{ keyframeId: "a", trackId: "opacity" }],
    timelineOverrides: new Map(),
  };
  return {
    assignKeyframeOwnershipAtTime: vi.fn(),
    beginEditorCommand: vi.fn(),
    createKeyframeId: (_timeline, trackId, prefix, time) =>
      `${trackId}-${prefix}-${time.toFixed(3)}`,
    deps: {
      clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
      deepClone: (value) => structuredClone(value),
      normalizeTimeline: (timeline) => structuredClone(timeline),
      t: (_key, fallback) => fallback,
    },
    getEffectiveDuration: () => 4,
    getEffectiveTimeline: () =>
      structuredClone(state.timelineOverrides.get("template") ?? baseTimeline),
    getSelectedKeyframeRefs: () => structuredClone(state.selectedKeyframes),
    logDiagnostic: vi.fn(),
    refs: {
      fpsInput: { value: "30" },
      timeSlider: { value: "1" },
    },
    renderCurrentFrame: vi.fn(),
    renderTimelineEditor: vi.fn(),
    setSelectedKeyframes(refs) {
      state.selectedKeyframes = structuredClone(refs);
    },
    setSidebarGroup: vi.fn(),
    snapTime: (value) => value,
    state,
  };
}
