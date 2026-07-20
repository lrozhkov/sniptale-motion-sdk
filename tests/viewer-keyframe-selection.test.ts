import { describe, expect, it, vi } from "vitest";

import {
  canonicalizeKeyframeSelection,
  getKeyframeSelectionBounds,
  resolveKeyframeSelection,
} from "../src/apps/viewer/timeline/model/keyframe-selection";
import { installModelSelectionStateOwner } from "../src/apps/viewer/timeline/model/selection-state";
import { installInteractionKeyframesOwner } from "../src/apps/viewer/timeline/interaction/keyframes";

describe("viewer keyframe selection authority", () => {
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
    installModelSelectionStateOwner(ctx);

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
