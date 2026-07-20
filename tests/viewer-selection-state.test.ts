import { describe, expect, it } from "vitest";

import {
  installModelSelectionStateOwner,
  resolvePrimarySelectionItem,
} from "../src/apps/viewer/timeline/model/selection-state";

describe("viewer selection state", () => {
  it("falls back to the composition when a modifier toggle empties a set", () => {
    expect(resolvePrimarySelectionItem("layer", "layerId", [])).toEqual({
      type: "effect",
    });
    expect(
      resolvePrimarySelectionItem("clip", "layerId", ["grid", "card"]),
    ).toEqual({ layerId: "card", type: "clip" });
  });

  it("keeps layer and interval selection mutually exclusive", () => {
    const canvasSelections: any[] = [];
    const ctx: any = {
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
    installModelSelectionStateOwner(ctx);

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
