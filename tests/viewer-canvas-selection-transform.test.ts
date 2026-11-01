import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { requiredEntry } from "./helpers/required-entry.js";
import type { CanvasSelectionGestureSnapshot } from "../src/apps/viewer/canvas/selection-transform-state.js";
import type { CanvasSelectionTransformEntry } from "../src/apps/viewer/canvas/selection-transform-math.js";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
import { resolveCanvasHitSelectionLayerId } from "../src/apps/viewer/canvas/selection-level";
import {
  getAxisAlignedCanvasBox,
  resolveCanvasSelectionBounds,
} from "../src/apps/viewer/canvas/selection-bounds";
import {
  resolveCanvasSelectionScaleFactor,
  transformCanvasSelection,
} from "../src/apps/viewer/canvas/selection-transform-math";
import { applyCanvasSelectionTransform } from "../src/apps/viewer/canvas/selection-transform-state";
import {
  createLayerAlignmentUpdates,
  createLayerDistributionUpdates,
} from "../src/apps/viewer/layers/selection-layout";

describe("viewer canvas multi-selection geometry", () => {
  it("transforms every layer from one immutable snapshot without drift", () => {
    const entries = [
      entry("card", {
        box: { height: 50, rotation: 0, width: 100, x: 0, y: 0 },
        pivot: { x: 50, y: 25 },
        values: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      }),
      entry("title", {
        box: { height: 40, rotation: 30, width: 80, x: 160, y: 80 },
        pivot: { x: 200, y: 100 },
        values: { rotation: 30, scaleX: 2, scaleY: 0.5, x: 160, y: 80 },
      }),
    ];
    const options = {
      pivot: { x: 100, y: 50 },
      rotation: 15,
      scale: 1.5,
      translation: { x: 20, y: -10 },
    };

    const first = transformCanvasSelection(entries, options);
    const second = transformCanvasSelection(entries, options);

    expect(second).toEqual(first);
    expect(requiredEntry(entries, 0).values).toEqual({
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
    });
    const card = first.updates.card;
    const title = first.updates.title;
    if (!card || !title)
      throw new Error("Missing transformed selection fixture updates");
    expect(card.rotation).toBeCloseTo(15);
    expect(card.scaleX).toBeCloseTo(1.5);
    expect(title.scaleX).toBeCloseTo(3);
    expect(title.scaleY).toBeCloseTo(0.75);
    expect(first.box.rotation).toBe(0);
  });

  it("keeps the requested uniform scale inside every layer capability limit", () => {
    const entries = [
      entry("small", {
        values: {
          rotation: 0,
          scaleX: 0.1,
          scaleY: 0.2,
          x: 0,
          y: 0,
        },
      }),
      entry("large", {
        values: {
          rotation: 0,
          scaleX: 4,
          scaleY: 2,
          x: 0,
          y: 0,
        },
      }),
    ];

    expect(resolveCanvasSelectionScaleFactor(entries, 0.1)).toBeCloseTo(0.5);
    expect(resolveCanvasSelectionScaleFactor(entries, 10)).toBeCloseTo(2);
  });

  it("uses axis-aligned bounds for mixed rotations", () => {
    const rotated = getAxisAlignedCanvasBox(
      { height: 20, rotation: 90, width: 100, x: 10, y: 20 },
      { x: 60, y: 30 },
    );

    expect(rotated).toMatchObject({
      height: 100,
      width: 20,
      x: 50,
      y: -20,
    });

    const layers = [
      { id: "a", type: "rect" },
      { id: "b", type: "rect" },
    ];
    const ctx = createViewerContextFixture();
    vi.spyOn(ctx, "getLayerCanvasBox").mockImplementation((id) =>
      id === "a"
        ? { height: 20, rotation: 90, width: 100, x: 10, y: 20 }
        : { height: 30, rotation: 0, width: 30, x: 100, y: 100 },
    );
    vi.spyOn(ctx, "getLayerCanvasPivot").mockImplementation((box) => ({
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    }));
    vi.spyOn(ctx, "isLayerCanvasSelectable").mockReturnValue(true);
    const bounds = resolveCanvasSelectionBounds(ctx, { layers }, ["a", "b"]);

    expect(bounds?.box).toEqual({
      height: 150,
      rotation: 0,
      width: 80,
      x: 50,
      y: -20,
    });
  });

  it("writes only properties represented by the current operation", () => {
    const ctx = createViewerContextFixture();
    ctx.state.currentTemplate = {
      id: "fixture",
      duration: 1,
      layers: [{ id: "card", type: "rect", width: 20, height: 20 }],
    };
    const template = ctx.getEffectiveTemplate();
    if (!template) throw new Error("Missing selection fixture template");
    const update = vi
      .spyOn(ctx, "updateLayerPropertyBatchAtTime")
      .mockImplementation(() => {});
    const source = entry("card");
    const snapshot: CanvasSelectionGestureSnapshot = {
      bounds: {
        box: source.box,
        entries: [
          {
            box: source.box,
            layer: requiredEntry(template.layers, 0),
            layerId: "card",
            pivot: source.pivot,
          },
        ],
      },
      entries: [source],
      layerIds: ["card"],
      operation: "move",
      template,
      time: 1,
    };
    const box = { x: 10, y: 20, width: 40, height: 40, rotation: 30 };
    applyCanvasSelectionTransform(ctx, snapshot, {
      box,
      boxes: { card: box },
      updates: { card: { rotation: 30, scaleX: 2, scaleY: 2, x: 10, y: 20 } },
    });

    expect(update).toHaveBeenCalledWith(
      1,
      { card: { x: 10, y: 20 } },
      expect.objectContaining({ keyframe: true, render: false }),
    );
  });

  it("aligns rotated layers by their visible bounds", () => {
    const entries = [
      entry("rotated", {
        box: { height: 20, rotation: 90, width: 100, x: 10, y: 20 },
        pivot: { x: 60, y: 30 },
        values: { rotation: 90, scaleX: 1, scaleY: 1, x: 10, y: 20 },
      }),
      entry("plain", {
        box: { height: 20, rotation: 0, width: 20, x: 100, y: 20 },
        pivot: { x: 110, y: 30 },
        values: { rotation: 0, scaleX: 1, scaleY: 1, x: 100, y: 20 },
      }),
    ];

    expect(
      createLayerAlignmentUpdates(
        entries,
        { height: 100, width: 70, x: 50, y: -20 },
        "left",
      ),
    ).toEqual({
      plain: { x: 50, y: 20 },
      rotated: { x: 10, y: 20 },
    });
  });

  it("distributes three layers with equal visible gaps", () => {
    const entries = [
      entry("left", {
        box: { height: 20, rotation: 0, width: 20, x: 0, y: 0 },
        values: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      }),
      entry("middle", {
        box: { height: 20, rotation: 0, width: 20, x: 40, y: 0 },
        pivot: { x: 50, y: 10 },
        values: { rotation: 0, scaleX: 1, scaleY: 1, x: 40, y: 0 },
      }),
      entry("right", {
        box: { height: 20, rotation: 0, width: 20, x: 100, y: 0 },
        pivot: { x: 110, y: 10 },
        values: { rotation: 0, scaleX: 1, scaleY: 1, x: 100, y: 0 },
      }),
    ];

    expect(createLayerDistributionUpdates(entries, "horizontal")).toEqual({
      left: { x: 0, y: 0 },
      middle: { x: 50, y: 0 },
      right: { x: 100, y: 0 },
    });
  });
});

describe("viewer canvas group isolation", () => {
  const layers = [
    { id: "outer", type: "group" },
    { id: "inner", parentId: "outer", type: "group" },
    { id: "card", parentId: "inner", type: "rect" },
    { id: "title", parentId: "outer", type: "text" },
    { id: "logo", type: "imageAsset" },
  ];

  it("selects the top structural group outside isolation", () => {
    expect(resolveHit(null, "card")).toBe("outer");
    expect(resolveHit(null, "logo")).toBe("logo");
  });

  it("selects only direct children of the isolated group", () => {
    expect(resolveHit("outer", "card")).toBe("inner");
    expect(resolveHit("outer", "title")).toBe("title");
    expect(resolveHit("outer", "logo")).toBeNull();
    expect(resolveHit("inner", "card")).toBe("card");
  });

  function resolveHit(isolationId: string | null, leafId: string) {
    const ctx = createViewerContextFixture();
    ctx.state.currentTemplate = { id: "fixture", duration: 1, layers };
    ctx.state.canvasIsolationGroupId = isolationId;
    const template = ctx.getEffectiveTemplate();
    if (!template) throw new Error("Missing isolation fixture template");
    return resolveCanvasHitSelectionLayerId(ctx, leafId, template);
  }
});

function entry(
  id: string,
  overrides: Partial<Omit<CanvasSelectionTransformEntry, "layerId">> = {},
): CanvasSelectionTransformEntry {
  return {
    anchor: { x: 0, y: 0 },
    box: { height: 20, rotation: 0, width: 20, x: 0, y: 0 },
    layerId: id,
    pivot: { x: 10, y: 10 },
    values: { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
    ...overrides,
  };
}
