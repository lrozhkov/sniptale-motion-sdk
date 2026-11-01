import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createKeyframeSelectionInspectorModel } from "../src/apps/viewer/inspector/keyframe-selection-model";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer multi-keyframe inspector", () => {
  it("reports mixed values, ownership, and range capabilities", () => {
    const ctx = createContext();
    const model = createKeyframeSelectionInspectorModel(
      ctx,
      ctx.state.currentTemplate,
    );

    if (!model) throw new Error("Missing keyframe selection model fixture");
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

  it.each([NaN, Infinity, -Infinity])(
    "does not enable numeric batch edits for %s",
    (value) => {
      const ctx = createContext();
      const timeline = ctx.getEffectiveTimeline();
      requiredEntry(requiredEntry(timeline.tracks, 0).keyframes, 0).value =
        value;
      ctx.getEffectiveTimeline = () => timeline;
      const model = createKeyframeSelectionInspectorModel(
        ctx,
        ctx.state.currentTemplate,
      );
      expect(model?.canEditValue).toBe(false);
      expect(model?.numericCount).toBe(2);
      expect(model?.value).toBeNull();
    },
  );

  it.each([true, false])(
    "preserves state mutation while refresh is %s",
    async (refresh) => {
      const ctx = createContext();
      await ctx.updateSelectedKeyframe({ value: 0.5 }, "opacity", "a", {
        history: refresh,
        render: refresh,
        timeline: refresh,
      });
      expect(
        requiredEntry(
          requiredEntry(ctx.getEffectiveTimeline().tracks, 0).keyframes,
          0,
        ).value,
      ).toBe(0.5);
      expect(ctx.beginEditorCommand).toHaveBeenCalledTimes(refresh ? 1 : 0);
      expect(ctx.renderTimelineEditor).toHaveBeenCalledTimes(refresh ? 1 : 0);
      expect(ctx.renderCurrentFrame).toHaveBeenCalledTimes(refresh ? 1 : 0);
    },
  );

  it("updates every selected numeric keyframe with one command", () => {
    const ctx = createContext();

    expect(ctx.updateSelectedKeyframesBatch({ value: 0.75 })).toBe(true);
    expect(ctx.beginEditorCommand).toHaveBeenCalledOnce();
    expect(ctx.beginEditorCommand).toHaveBeenCalledWith(
      expect.objectContaining({ type: "updateKeyframes" }),
    );
    expect(
      ctx
        .getEffectiveTimeline()
        .tracks.flatMap((track) =>
          track.keyframes
            .filter((keyframe) => ["a", "b", "x"].includes(keyframe.id))
            .map((keyframe) => keyframe.value),
        ),
    ).toEqual([0.75, 0.75, 0.75]);
  });
});

function createContext() {
  const ctx = createViewerContextFixture();
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

  const template = { duration: 5, id: "template", timeline };
  const state = Object.assign(ctx.state, { currentTemplate: template });
  ctx.state.selectedKeyframes = [
    { keyframeId: "a", trackId: "opacity" },
    { keyframeId: "b", trackId: "opacity" },
    { keyframeId: "x", trackId: "scale" },
  ];
  const beginEditorCommand = vi
    .spyOn(ctx, "beginEditorCommand")
    .mockImplementation(() => {});
  const renderCurrentFrame = vi
    .spyOn(ctx, "renderCurrentFrame")
    .mockResolvedValue(undefined);
  const renderTimelineEditor = vi
    .spyOn(ctx, "renderTimelineEditor")
    .mockImplementation(() => {});
  return Object.assign(ctx, {
    state,
    beginEditorCommand,
    renderCurrentFrame,
    renderTimelineEditor,
  });
}
