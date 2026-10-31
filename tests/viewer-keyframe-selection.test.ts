import { createKeyframeBatchActions } from "../src/apps/viewer/timeline/interaction/keyframe-batch";
import { createKeyframeSelectionActions } from "../src/apps/viewer/timeline/model/keyframe-selection-state.js";
import { createViewerSelectionState } from "../src/apps/viewer/timeline/model/selection-model.js";
import { describe, expect, it, vi } from "vitest";

import {
  canonicalizeKeyframeSelection,
  getKeyframeSelectionBounds,
  resolveKeyframeSelection,
} from "../src/apps/viewer/timeline/model/keyframe-selection";
import { createTimelineSelectionStateActions } from "../src/apps/viewer/timeline/model/selection-state";
import { getSelectedKeyframeRefs } from "../src/apps/viewer/timeline/interaction/keyframes";

describe("viewer keyframe selection authority", () => {
  it("does not collapse distinct canonical references when reading the selection", () => {
    const ctx = createSelectionContext();
    const refs = [
      { trackId: "a:b", keyframeId: "c" },
      { trackId: "a", keyframeId: "b:c" },
    ];
    ctx.state.selectedKeyframes = refs;
    expect(getSelectedKeyframeRefs(ctx)).toEqual(refs);
  });

  it("rejects malformed reference values through the selection action", () => {
    const ctx = createSelectionContext();
    Object.assign(
      ctx,
      createTimelineSelectionStateActions(() => ctx),
      createKeyframeSelectionActions(() => ctx),
    );
    ctx.setSelectedKeyframes(
      [null, [], { trackId: { toString: 0 }, keyframeId: "a" }],
      { render: false },
    );
    expect(ctx.state.selectedKeyframes).toEqual([]);
    expect(ctx.state.selectedItem).toEqual({ type: "effect" });
  });

  it("keeps delimiter-containing references distinct through the selection action", () => {
    const ctx = createSelectionContext();
    Object.assign(
      ctx,
      createTimelineSelectionStateActions(() => ctx),
      createKeyframeSelectionActions(() => ctx),
    );
    const refs = [
      { trackId: "a:b", keyframeId: "c" },
      { trackId: "a", keyframeId: "b:c" },
    ];
    ctx.getEffectiveTimeline = () => ({
      duration: 1,
      phases: [],
      tracks: [
        { id: "a:b", keyframes: [{ id: "c", time: 0, value: 1 }] },
        { id: "a", keyframes: [{ id: "b:c", time: 1, value: 1 }] },
      ],
    });
    ctx.setSelectedKeyframes(refs, { render: false });
    expect(ctx.state.selectedKeyframes).toEqual(refs);
  });

  it("creates independent initial selection collections", () => {
    const first = createViewerSelectionState();
    const second = createViewerSelectionState();
    first.selectedLayers.push("card");
    first.selectedKeyframes.push({ trackId: "opacity", keyframeId: "a" });
    expect(second.selectedLayers).toEqual([]);
    expect(second.selectedKeyframes).toEqual([]);
    expect(second.selectedItem).toEqual({ type: "effect" });
  });

  it("rejects malformed reference values without string coercion", () => {
    expect(
      canonicalizeKeyframeSelection(createTimeline(), [
        null,
        [],
        { trackId: { toString: 0 }, keyframeId: "a" },
        { trackId: "opacity", keyframeId: { toString: 0 } },
      ]),
    ).toEqual([]);
  });

  it("keeps distinct reference pairs containing delimiters", () => {
    const timeline = {
      tracks: [
        { id: "a:b", keyframes: [{ id: "c", time: 0, value: 1 }] },
        { id: "a", keyframes: [{ id: "b:c", time: 1, value: 1 }] },
      ],
    };
    const refs = [
      { trackId: "a:b", keyframeId: "c" },
      { trackId: "a", keyframeId: "b:c" },
    ];
    expect(canonicalizeKeyframeSelection(timeline, refs)).toEqual(refs);
  });

  it("canonicalizes refs and resolves stable selection bounds", () => {
    const timeline = createTimeline();
    const refs = canonicalizeKeyframeSelection(timeline, [
      { keyframeId: "b", trackId: "opacity" },
      { keyframeId: "missing", trackId: "opacity" },
      { keyframeId: "b", trackId: "opacity" },
      { keyframeId: "x", trackId: "scale" },
    ]);

    expect(refs).toEqual([
      { keyframeId: "b", trackId: "opacity" },
      { keyframeId: "x", trackId: "scale" },
    ]);
    expect(
      getKeyframeSelectionBounds(resolveKeyframeSelection(timeline, refs)),
    ).toEqual({
      count: 2,
      duration: 1,
      end: 2,
      start: 1,
    });
  });

  it("toggles modifier-click and derives the primary from the last ref", () => {
    const ctx = createSelectionContext();
    Object.assign(
      ctx,
      createTimelineSelectionStateActions(() => ctx),
      createKeyframeSelectionActions(() => ctx),
    );

    ctx.selectKeyframe("opacity", "a");
    ctx.selectKeyframe("scale", "x", { ctrlKey: true });
    expect(ctx.state.selectedKeyframes).toEqual([
      { keyframeId: "a", trackId: "opacity" },
      { keyframeId: "x", trackId: "scale" },
    ]);
    expect(ctx.state.selectedItem).toEqual({
      keyframeId: "x",
      trackId: "scale",
      type: "keyframe",
    });

    ctx.selectKeyframe("scale", "x", { ctrlKey: true });
    expect(ctx.state.selectedKeyframes).toEqual([
      { keyframeId: "a", trackId: "opacity" },
    ]);
    expect(ctx.state.selectedItem).toEqual({
      keyframeId: "a",
      trackId: "opacity",
      type: "keyframe",
    });
  });

  it("moves the whole selection through the batch action and keeps the primary playhead", () => {
    const ctx = createSelectionContext();
    const source = { id: "source" };
    ctx.state.currentTemplate = source;
    ctx.state.timelineOverrides = new Map();
    ctx.state.selectedKeyframes = [
      { trackId: "opacity", keyframeId: "a" },
      { trackId: "scale", keyframeId: "x" },
    ];
    ctx.getSelectedKeyframeRefs = () => getSelectedKeyframeRefs(ctx);
    ctx.getEffectiveDuration = () => 3;
    ctx.snapTime = (time: number) => time;
    ctx.beginEditorCommand = vi.fn();
    ctx.setSelectedKeyframes = vi.fn();
    ctx.renderTimelineEditor = vi.fn();
    ctx.renderCurrentFrame = vi.fn();
    ctx.deps.normalizeTimeline = (timeline: unknown) => timeline;
    ctx.refs = {
      fpsInput: { value: "30" },
      timeSlider: { value: "0" },
      timeOutput: { textContent: "" },
    };
    ctx.formatSeconds = (time: number) => String(time);
    const actions = createKeyframeBatchActions(() => ctx);
    expect(actions.moveSelectedKeyframesBySeconds(0.5)).toBe(true);
    expect(
      ctx.state.timelineOverrides
        .get(source.id)
        .tracks.map((track: { keyframes: { time: number }[] }) =>
          track.keyframes.map((frame) => frame.time),
        ),
    ).toEqual([[0.5, 1], [2.5]]);
    expect(ctx.refs.timeSlider.value).toBe("2.5");
    expect(ctx.refs.timeOutput.textContent).toBe("2.5");
    expect(ctx.beginEditorCommand).toHaveBeenCalledTimes(1);
    expect(ctx.renderCurrentFrame).toHaveBeenCalledTimes(1);
  });

  it("does not resurrect a keyframe from selectedItem fallback state", () => {
    const ctx: any = {
      state: {
        selectedItem: {
          keyframeId: "a",
          trackId: "opacity",
          type: "keyframe",
        },
        selectedKeyframes: [],
      },
    };
    ctx.getSelectedKeyframeRefs = () => getSelectedKeyframeRefs(ctx);

    expect(ctx.getSelectedKeyframeRefs()).toEqual([]);
  });
});

function createTimeline() {
  return {
    tracks: [
      {
        id: "opacity",
        keyframes: [
          { id: "a", time: 0, value: 0 },
          { id: "b", time: 1, value: 1 },
        ],
      },
      {
        id: "scale",
        keyframes: [{ id: "x", time: 2, value: 1 }],
      },
    ],
  };
}

function createSelectionContext(): any {
  return {
    clearSelectionCollections: null,
    deps: { deepClone: (value) => structuredClone(value) },
    getEffectiveTemplate: () => null,
    getEffectiveTimeline: () => ({
      duration: 3,
      phases: [],
      ...createTimeline(),
    }),
    refs: {},
    setSidebarGroup: vi.fn(),
    state: {
      selectedClips: [],
      selectedItem: { type: "effect" },
      selectedKeyframes: [],
      selectedLayers: [],
      selectedPhases: [],
      selectedScenes: [],
    },
    syncTimelineSelection: vi.fn(),
    updateCanvasSelectionBox: vi.fn(),
  };
}
