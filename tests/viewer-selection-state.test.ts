import { resolvePrimarySelectionItem } from "../src/apps/viewer/timeline/model/selection-values.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import type { ViewerAppContext } from "../src/apps/viewer/app/context.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
    const ctx = createViewerContextFixture();
    const canvasSelections: ViewerAppContext["state"]["selectedItem"][] = [];
    ctx.state.currentTemplate = {
      id: "composition",
      duration: 4,
      layers: [
        { id: "group-1", type: "group" },
        { id: "card", parentId: "group-1", type: "rect" },
        { id: "title", type: "text" },
      ],
      timeline: {
        phases: [],
        tracks: [
          {
            id: "card.x",
            property: "x",
            layerId: "card",
            keyframes: [{ id: "card-x-a", time: 0, value: 1 }],
          },
        ],
      },
    };
    vi.spyOn(ctx, "setSidebarGroup").mockImplementation(() => {});
    vi.spyOn(ctx, "updateCanvasSelectionBox").mockImplementation(() => {
      canvasSelections.push(ctx.state.selectedItem);
    });
    vi.spyOn(ctx, "syncTimelineSelection").mockImplementation(() => {
      ctx.updateCanvasSelectionBox();
    });

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
