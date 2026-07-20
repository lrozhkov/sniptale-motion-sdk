import { describe, expect, it } from "vitest";

import { createLayerSelectionInspectorModel } from "../src/apps/viewer/inspector/layer-selection-model";

describe("viewer multi-layer inspector", () => {
  it("reports mixed common properties and aggregate capability state", () => {
    const layers = [
      {
        id: "card",
        opacity: 1,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        type: "rect",
      },
      {
        id: "title",
        locked: true,
        opacity: 0.6,
        rotation: 20,
        scaleX: 1,
        scaleY: 1,
        type: "text",
      },
    ];
    const template = { layers, timeline: { phases: [], tracks: [] } };
    const ctx: any = {
      canEditLayerProperty: () => true,
      canTransformLayerProperty: () => true,
      deps: { t: (_key, fallback) => fallback },
      getCanvasSelectionTarget: () => ({
        kind: "selection",
        layerIds: ["card", "title"],
        rootLayerIds: ["card", "title"],
      }),
      getLayerCanvasBox: (id) =>
        id === "card"
          ? { height: 100, rotation: 0, width: 100, x: 0, y: 0 }
          : { height: 40, rotation: 0, width: 120, x: 200, y: 30 },
      getLayerCanvasPivot: (box) => ({
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      }),
      getLayerGroupingState: () => ({ canGroup: true, canUngroup: false }),
      getResolvedLayerProperty: (layer, property) => layer[property] ?? 0,
      isLayerActiveAtTime: () => true,
      isLayerCanvasSelectable: () => true,
      refs: { timeSlider: { value: "1" } },
    };

    const model = createLayerSelectionInspectorModel(ctx, template);

    expect(model.bounds).toEqual({
      height: 100,
      rotation: 0,
      width: 320,
      x: 0,
      y: 0,
    });
    expect(model.frameMoveEditable).toBe(false);
    expect(model.frameScaleEditable).toBe(false);
    expect(model.propertyEditable).toBe(false);
    expect(model.stats).toEqual({
      hidden: 0,
      inactive: 0,
      locked: 1,
      nonSpatial: 0,
    });
    expect(
      model.commonFields.find((field) => field.property === "rotation").values,
    ).toEqual([0, 20]);
    expect(
      model.commonFields.find((field) => field.property === "opacity").values,
    ).toEqual([1, 0.6]);
  });
});
