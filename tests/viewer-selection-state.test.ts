import { resolvePrimarySelectionItem } from "../src/apps/viewer/timeline/model/selection-values.js";
import { createKeyframeSelectionActions } from "../src/apps/viewer/timeline/model/keyframe-selection-state.js";
import { describe, expect, it } from "vitest";

import { createTimelineSelectionStateActions } from "../src/apps/viewer/timeline/model/selection-state";

describe("viewer selection state", () => {
  it("falls back to the composition when a modifier toggle empties a set", () => {
    expect(resolvePrimarySelectionItem("layer", [])).toEqual({
      type: "effect",
    });
    expect(resolvePrimarySelectionItem("clip", ["grid", "card"])).toEqual({
      layerId: "card",
      type: "clip",
    });
  });

  it("keeps layer and interval selection mutually exclusive", () => {
    const canvasSelections: any[] = [];
    const ctx: any = {
      getEffectiveTimeline: () => ({
        duration: 4,
        phases: [],
        tracks: [
          { id: "card.x", keyframes: [{ id: "card-x-a", time: 0, value: 1 }] },
        ],
      }),
      getEffectiveTemplate: () => ({
        layers: [
          { id: "group-1", type: "group" },
          { id: "card", parentId: "group-1", type: "rect" },
          { id: "title", type: "text" },
        ],
      }),
      setSidebarGroup() {},
      state: {
        selectedClips: [],
        selectedItem: { type: "effect" },
        selectedKeyframes: [],
        selectedLayers: [],
        selectedPhases: [],
        selectedScenes: [],
      },
      updateCanvasSelectionBox() {
        canvasSelections.push(ctx.state.selectedItem);
      },
      syncTimelineSelection() {
        ctx.updateCanvasSelectionBox();
      },
    };
    Object.assign(
      ctx,
      createTimelineSelectionStateActions(() => ctx),
      createKeyframeSelectionActions(() => ctx),
    );

    ctx.selectLayer("card");
    expect(ctx.state.selectedItem).toEqual({
      layerId: "card",
      type: "layer",
    });
    expect(ctx.state.selectedLayers).toEqual(["card"]);
    expect(ctx.state.selectedClips).toEqual([]);

    ctx.selectLayer("group-1", { ctrlKey: true });
    expect(ctx.state.selectedLayers).toEqual(["group-1"]);
    expect(ctx.state.selectedItem).toEqual({
      layerId: "group-1",
      type: "layer",
    });

    ctx.selectLayer("title", { ctrlKey: true });
    expect(ctx.state.selectedLayers).toEqual(["group-1", "title"]);

    ctx.selectClipBlock("card");
    expect(ctx.state.selectedItem).toEqual({
      layerId: "card",
      type: "clip",
    });
    expect(ctx.state.selectedLayers).toEqual([]);
    expect(ctx.state.selectedClips).toEqual(["card"]);
    expect(canvasSelections.at(-1)).toEqual({
      layerId: "card",
      type: "clip",
    });

    ctx.selectClipBlock("card", { ctrlKey: true });
    expect(ctx.state.selectedItem).toEqual({ type: "effect" });
    expect(ctx.state.selectedClips).toEqual([]);

    ctx.prepareKeyframeSelectionForPointer({}, "card.x", "card-x-a");
    expect(canvasSelections.at(-1)).toEqual({
      keyframeId: "card-x-a",
      trackId: "card.x",
      type: "keyframe",
    });
  });
});
