import { createKeyframeSelectionActions } from "../src/apps/viewer/timeline/model/keyframe-selection-state.js";
import { createViewerSelectionState } from "../src/apps/viewer/timeline/model/selection-model.js";
import { describe, expect, it, vi } from "vitest";

import {
  canonicalizeKeyframeSelection,
  getKeyframeSelectionBounds,
  resolveKeyframeSelection,
} from "../src/apps/viewer/timeline/model/keyframe-selection";
import { createTimelineSelectionStateActions } from "../src/apps/viewer/timeline/model/selection-state";
import { installInteractionKeyframesOwner } from "../src/apps/viewer/timeline/interaction/keyframes";

describe("viewer keyframe selection authority", () => {
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
    installInteractionKeyframesOwner(ctx);

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
