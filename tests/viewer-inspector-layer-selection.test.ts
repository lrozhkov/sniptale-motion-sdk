import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLayerSelectionInspectorModel } from "../src/apps/viewer/inspector/layer-selection-model";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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
    const template = {
      id: "template",
      duration: 5,
      layers,
      clips: [],
      scenes: [],
      timeline: { duration: 5, phases: [], tracks: [] },
    };
    const ctx = createViewerContextFixture();
    ctx.state.currentTemplate = template;
    const effective = ctx.getEffectiveTemplate();
    if (!effective) throw new Error("Missing inspector template fixture");
    vi.spyOn(ctx, "canEditLayerProperty").mockReturnValue(true);
    vi.spyOn(ctx, "canTransformLayerProperty").mockReturnValue(true);
    vi.spyOn(ctx, "getCanvasSelectionTarget").mockReturnValue({
      kind: "selection",
      primaryLayerId: null,
      related: false,
      layerIds: ["card", "title"],
      rootLayerIds: ["card", "title"],
    });
    vi.spyOn(ctx, "getLayerCanvasBox").mockImplementation((id) =>
      id === "card"
        ? { height: 100, rotation: 0, width: 100, x: 0, y: 0 }
        : { height: 40, rotation: 0, width: 120, x: 200, y: 30 },
    );
    vi.spyOn(ctx, "getLayerCanvasPivot").mockImplementation((box) => ({
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    }));
    vi.spyOn(ctx, "getLayerGroupingState").mockReturnValue({
      canGroup: true,
      canUngroup: false,
      groupReason: null,
    });
    vi.spyOn(ctx, "isLayerActiveAtTime").mockReturnValue(true);
    vi.spyOn(ctx, "isLayerCanvasSelectable").mockReturnValue(true);
    ctx.refs.timeSlider.value = "1";

    const model = createLayerSelectionInspectorModel(ctx, effective);

    if (!model) throw new Error("Missing layer selection model fixture");
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
      requiredEntry(
        model.commonFields.filter((field) => field.property === "rotation"),
        0,
      ).values,
    ).toEqual([0, 20]);
    expect(
      requiredEntry(
        model.commonFields.filter((field) => field.property === "opacity"),
        0,
      ).values,
    ).toEqual([1, 0.6]);
    for (const ids of [[], ["missing"], ["card", "missing"]]) {
      ctx.getCanvasSelectionTarget = () => ({
        kind: "selection",
        primaryLayerId: null,
        related: false,
        layerIds: ids,
        rootLayerIds: ids,
      });
      expect(createLayerSelectionInspectorModel(ctx, effective)).toBeNull();
    }
  });
});
