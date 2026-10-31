import { describe, expect, it, vi } from "vitest";

import { createKeyframeSelectionInspectorModel } from "../src/apps/viewer/inspector/keyframe-selection-model";
import { createKeyframePropertyActions } from "../src/apps/viewer/timeline/interaction/keyframe-properties";

describe("viewer multi-keyframe inspector", () => {
  it("reports mixed values, ownership, and range capabilities", () => {
    const ctx = createContext();
    const model = createKeyframeSelectionInspectorModel(
      ctx,
      ctx.state.currentTemplate,
    );

    expect(model.bounds).toEqual({
      count: 3,
      duration: 2,
      end: 3,
      start: 1,
    });
    expect(model.trackCount).toBe(2);
    expect(model.value).toEqual({ mixed: true, value: null });
    expect(model.easing).toEqual({ mixed: true, value: null });
    expect(model.canDistribute).toBe(true);
    expect(model.canEditValue).toBe(true);
    expect(model.canEditEasing).toBe(true);
    expect(model.ownership).toEqual({
      phases: ["intro"],
      scenes: ["main"],
    });
  });

  it("updates every selected numeric keyframe with one command", () => {
    const ctx = createContext();
    Object.assign(
      ctx,
      createKeyframePropertyActions(() => ctx),
    );

    expect(ctx.updateSelectedKeyframesBatch({ value: 0.75 })).toBe(true);
    expect(ctx.beginEditorCommand).toHaveBeenCalledOnce();
    expect(ctx.beginEditorCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: "updateKeyframes" }),
    );
    expect(
      ctx.state.timelineOverrides
        .get("template")
        .tracks.flatMap((track) =>
          track.keyframes
            .filter((keyframe) => ["a", "b", "x"].includes(keyframe.id))
            .map((keyframe) => keyframe.value),
        ),
    ).toEqual([0.75, 0.75, 0.75]);
  });
});

function createContext(): any {
  const template = { duration: 5, id: "template" };
  const timeline = {
    duration: 5,
    phases: [],
    tracks: [
      {
        id: "opacity",
        phaseId: "intro",
        sceneId: "main",
        keyframes: [
          { easing: "linear", id: "a", time: 1, value: 0 },
          { easing: "out", id: "b", time: 3, value: 1 },
          { easing: "linear", id: "c", time: 4, value: 0 },
        ],
      },
      {
        id: "scale",
        phaseId: "intro",
        sceneId: "main",
        keyframes: [
          { easing: "linear", id: "x", time: 2, value: 2 },
          { easing: "linear", id: "y", time: 5, value: 1 },
        ],
      },
    ],
  };
  const state: any = {
    currentTemplate: template,
    selectedKeyframes: [
      { keyframeId: "a", trackId: "opacity" },
      { keyframeId: "b", trackId: "opacity" },
      { keyframeId: "x", trackId: "scale" },
    ],
    timelineOverrides: new Map(),
  };
  return {
    beginEditorCommand: vi.fn(),
    deps: {
      normalizeHandles: (handles) => ({
        x1: handles?.x1 ?? 0.25,
        x2: handles?.x2 ?? 0.25,
        y1: handles?.y1 ?? 0.1,
        y2: handles?.y2 ?? 1,
      }),
      normalizeTimeline: (value) => structuredClone(value),
    },
    getEffectiveDuration: () => 5,
    getEffectiveTimeline: () =>
      structuredClone(state.timelineOverrides.get("template") ?? timeline),
    getSelectedKeyframeRefs: () => structuredClone(state.selectedKeyframes),
    renderCurrentFrame: vi.fn(),
    renderTimelineEditor: vi.fn(),
    setSelectedKeyframes: vi.fn(),
    state,
  };
}
