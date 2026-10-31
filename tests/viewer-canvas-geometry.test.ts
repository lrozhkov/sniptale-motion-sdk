import type { EffectLayer } from "../src/sdk/types.js";
import { describe, expect, it } from "vitest";

import {
  getLayerCanvasBox,
  getLayerPrimitiveCanvasBox,
  getLayerStaticCanvasBox,
  layerHasAuthorGeometryHints,
} from "../src/apps/viewer/canvas/layer-geometry";
import { getLayerCanvasHitBox } from "../src/apps/viewer/canvas/layer-hit-geometry";
import { resolveLayerEditorCapabilities } from "../src/apps/viewer/layers/editor-capabilities";
import { normalizeLayers } from "../src/apps/sandbox/runtime/render-normalization";

describe("viewer canvas geometry", () => {
  it.each(
    [null, true, "12", [], [12], { toString: null }].map((value: unknown) => ({
      value,
    })),
  )("does not coerce authored geometry: %j", ({ value }) => {
    const ctx = createGeometryContext();
    const dimensions = getLayerStaticCanvasBox(ctx, "card", 0, 0, {
      id: "card",
      type: "rect",
      width: value,
      height: 100,
      baseX: 0.5,
      baseY: 0.5,
    });
    expect(dimensions.width).toBe(256);
    const position = getLayerStaticCanvasBox(ctx, "card", 0, 0, {
      id: "card",
      type: "rect",
      width: 100,
      height: 100,
      baseX: value,
      baseY: value,
    });
    expect(position.x).toBe(590);
    expect(position.y).toBe(310);
    const offsets = getLayerStaticCanvasBox(ctx, "card", 0, 0, {
      id: "card",
      type: "rect",
      width: 100,
      height: 100,
      left: value,
      top: value,
    });
    expect(offsets.x).toBe(590);
    expect(offsets.y).toBe(310);
  });

  it("uses layer base coordinates instead of always centering generic layers", () => {
    const ctx = createGeometryContext();

    const box = getLayerStaticCanvasBox(ctx, "box", -120, 30, {
      id: "box",
      type: "rect",
      baseX: 0.5,
      baseY: 0.48,
      height: 140,
      width: 140,
    });
    expect(box).toMatchObject({ height: 140, width: 140, x: 450 });
    expect(box.y).toBeCloseTo(305.6);
  });

  it("scales layer boxes around the resolved anchor", () => {
    const ctx = createGeometryContext({
      getResolvedLayerProperty(layer: any, property: string) {
        if (property === "scaleX") return 2;
        if (property === "scaleY") return 0.5;
        return Number(layer[property]) || 0;
      },
    });

    expect(
      getLayerCanvasBox(ctx, "box", {
        id: "box",
        baseX: 0.5,
        baseY: 0.5,
        height: 100,
        type: "rect",
        width: 200,
      }),
    ).toMatchObject({
      height: 50,
      width: 400,
      x: 440,
      y: 335,
    });
  });

  it("uses rendered primitive bounds for layers without author geometry hints", () => {
    const ctx = createGeometryContext({
      state: {
        currentTemplate: { layers: [{ id: "title", type: "text" }] },
        lastBindingReads: {
          primitiveBounds: [
            { height: 42, layerId: "title", width: 520, x: 380, y: 438 },
          ],
        },
      },
    });

    expect(
      getLayerCanvasBox(ctx, "title", { id: "title", type: "text" }),
    ).toMatchObject({
      height: 42,
      rotation: 0,
      width: 520,
      x: 380,
      y: 438,
    });
  });

  it("does not switch geometry sources merely because another canvas gesture is active", () => {
    const layer: EffectLayer = {
      baseX: 0.5,
      baseY: 0.5,
      height: 100,
      id: "box",
      editor: {
        properties: ["x", "y", "scaleX", "scaleY"],
        transform: ["x", "y", "scaleX", "scaleY"],
      },
      scaleX: 2,
      scaleY: 1,
      type: "rect",
      width: 200,
    };
    const ctx = createGeometryContext({
      state: {
        canvasTransformDragActive: true,
        currentTemplate: { layers: [layer] },
        lastBindingReads: {
          primitiveBounds: [
            { height: 100, layerId: "box", width: 200, x: 540, y: 310 },
          ],
        },
      },
    });

    expect(getLayerCanvasBox(ctx, "box", layer)).toMatchObject({
      height: 100,
      width: 200,
      x: 540,
      y: 310,
    });
  });

  it("keeps the gesture preview box authoritative over reduced renderer bounds", () => {
    const previewBox = {
      height: 224,
      rotation: 0,
      width: 224,
      x: 608,
      y: 295,
    };
    const layer = { id: "orbit", type: "customDraw" };
    const ctx = createGeometryContext({
      getLayerEditorCapabilities() {
        return { canvas: "bounds" };
      },
      state: {
        canvasTransformPreview: {
          box: previewBox,
          layerId: "orbit",
          templateId: "animation",
        },
        currentTemplate: { id: "animation", layers: [layer] },
        lastBindingReads: {
          primitiveBounds: [
            { height: 296, layerId: "orbit", width: 296, x: 492, y: 224 },
          ],
        },
      },
    });

    expect(getLayerCanvasBox(ctx, "orbit", layer)).toEqual(previewBox);
    expect(getLayerCanvasHitBox(ctx, "orbit", layer)).toEqual(previewBox);
  });

  it("uses renderer bounds when intrinsic dimensions are not editable", () => {
    const ctx = createGeometryContext({
      state: {
        currentTemplate: {
          layers: [
            { baseX: 0.5, baseY: 0.48, height: 140, id: "box", width: 140 },
          ],
        },
        lastBindingReads: {
          primitiveBounds: [
            { height: 44, layerId: "box", width: 44, x: 10, y: 10 },
          ],
        },
      },
    });

    const box = getLayerCanvasBox(ctx, "box", {
      baseX: 0.5,
      baseY: 0.48,
      editor: {
        properties: ["x", "y"],
        transform: ["x", "y"],
      },
      height: 140,
      id: "box",
      type: "rect",
      width: 140,
    });
    expect(box).toEqual({
      height: 44,
      rotation: 0,
      width: 44,
      x: 10,
      y: 10,
    });
  });

  it("uses the author box for intrinsic resize while retaining renderer hit bounds", () => {
    const layer: EffectLayer = {
      baseX: 0.5,
      baseY: 0.5,
      height: 210,
      id: "card",
      type: "rect",
      width: 470,
    };
    const ctx = createGeometryContext({
      state: {
        currentTemplate: { layers: [layer] },
        lastBindingReads: {
          primitiveBounds: [
            { height: 251, layerId: "card", width: 522, x: 345, y: 274 },
          ],
        },
      },
    });

    expect(getLayerCanvasBox(ctx, "card", layer)).toMatchObject({
      height: 210,
      width: 470,
      x: 405,
      y: 255,
    });
    expect(getLayerCanvasHitBox(ctx, "card", layer)).toMatchObject({
      height: 251,
      width: 522,
      x: 345,
      y: 274,
    });
  });

  it("provides a selection boundary for runtime-drawn visual layers", () => {
    const ctx = createGeometryContext();

    expect(
      getLayerCanvasBox(ctx, "grid", {
        id: "grid",
        opacity: 1,
        type: "customDraw",
      }),
    ).toEqual({
      height: 720,
      rotation: 0,
      width: 1280,
      x: 0,
      y: 0,
    });
  });

  it("resolves explicitly declared full-frame editor geometry", () => {
    const ctx = createGeometryContext();

    expect(
      getLayerCanvasBox(ctx, "background", {
        editor: { canvas: "fullFrame" },
        id: "background",
        type: "customDraw",
      }),
    ).toEqual({
      height: 720,
      rotation: 0,
      width: 1280,
      x: 0,
      y: 0,
    });
  });

  it("recovers an oriented author box from renderer bounds", () => {
    const layer = {
      anchorX: 0.25,
      anchorY: -0.2,
      baseX: 0.5,
      baseY: 0.5,
      height: 80,
      id: "box",
      rotation: 30,
      type: "rect",
      width: 200,
    };
    const expected = {
      height: 80,
      rotation: 30,
      width: 200,
      x: 540,
      y: 320,
    };
    const primitiveBounds = rotatedBounds(expected, layer);
    const ctx = createGeometryContext({
      state: {
        currentTemplate: { layers: [layer] },
        lastBindingReads: {
          primitiveBounds: [{ ...primitiveBounds, layerId: "box" }],
        },
      },
    });

    const box = getLayerCanvasBox(ctx, "box", layer);
    if (!box) throw new Error("Expected canvas geometry");
    expect(box.rotation).toBe(30);
    expect(box.width).toBeCloseTo(expected.width);
    expect(box.height).toBeCloseTo(expected.height);
    expect(box.x).toBeCloseTo(expected.x);
    expect(box.y).toBeCloseTo(expected.y);
  });

  it("uses author aspect near a 45 degree bounds singularity", () => {
    const layer: EffectLayer = {
      baseX: 0.5,
      baseY: 0.5,
      height: 80,
      id: "box",
      rotation: 45,
      type: "rect",
      width: 200,
    };
    const expected = {
      height: 80,
      rotation: 45,
      width: 200,
      x: 540,
      y: 320,
    };
    const primitiveBounds = rotatedBounds(expected, layer);
    const ctx = createGeometryContext({
      state: {
        currentTemplate: { layers: [layer] },
        lastBindingReads: {
          primitiveBounds: [{ ...primitiveBounds, layerId: "box" }],
        },
      },
    });

    const box = getLayerCanvasBox(ctx, "box", layer);
    if (!box) throw new Error("Expected canvas geometry");
    expect(box.rotation).toBe(45);
    expect(box.width).toBeCloseTo(expected.width);
    expect(box.height).toBeCloseTo(expected.height);
    expect(box.x).toBeCloseTo(expected.x);
    expect(box.y).toBeCloseTo(expected.y);
  });

  it("keeps geometry hints in normalized sandbox layer state", () => {
    expect(
      normalizeLayers([{ baseX: 0.5, baseY: 0.48, id: "box", type: "rect" }]),
    ).toEqual([
      expect.objectContaining({
        baseX: 0.5,
        baseY: 0.48,
        id: "box",
      }),
    ]);
  });
});

function rotatedBounds(box, layer) {
  const angle = (box.rotation * Math.PI) / 180;
  const pivot = {
    x: box.x + box.width * (0.5 + Number(layer.anchorX || 0)),
    y: box.y + box.height * (0.5 + Number(layer.anchorY || 0)),
  };
  const corners = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ].map(([x, y]) => ({
    x:
      pivot.x +
      (x - pivot.x) * Math.cos(angle) -
      (y - pivot.y) * Math.sin(angle),
    y:
      pivot.y +
      (x - pivot.x) * Math.sin(angle) +
      (y - pivot.y) * Math.cos(angle),
  }));
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    height: Math.max(...ys) - y,
    width: Math.max(...xs) - x,
    x,
    y,
  };
}

function createGeometryContext(overrides: Record<string, unknown> = {}): any {
  return {
    deps: {
      clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, value));
      },
    },
    getLayerBaseCanvasBox(layerId: string, layer: any) {
      return getLayerStaticCanvasBox(
        this,
        layerId,
        this.getResolvedLayerProperty(layer, "x"),
        this.getResolvedLayerProperty(layer, "y"),
        layer,
      );
    },
    getLayerEditorCapabilities(layer: any) {
      return resolveLayerEditorCapabilities(layer);
    },
    getLayerCanvasBox(layerId: string, layer: any, resolution: any = {}) {
      return getLayerCanvasBox(this, layerId, layer, resolution);
    },
    getLayerPrimitiveCanvasBox(layerId: string, layer: any) {
      return getLayerPrimitiveCanvasBox(this, layerId, layer);
    },
    layerHasAuthorGeometryHints(layerId: string, layer: any) {
      return layerHasAuthorGeometryHints(this, layerId, layer);
    },
    getResolvedLayerAnchor(layer: any) {
      return {
        x: this.deps.clamp(
          this.getResolvedLayerProperty(layer, "anchorX"),
          -0.5,
          0.5,
        ),
        y: this.deps.clamp(
          this.getResolvedLayerProperty(layer, "anchorY"),
          -0.5,
          0.5,
        ),
      };
    },
    getResolvedLayerProperty(layer: any, property: string) {
      if (property === "scaleX" || property === "scaleY") {
        return Number.isFinite(Number(layer[property]))
          ? Number(layer[property])
          : 1;
      }
      return Number(layer[property]) || 0;
    },
    refs: {
      canvas: {
        height: 720,
        width: 1280,
      },
    },
    state: {
      currentTemplate: { layers: [] },
      lastBindingReads: { primitiveBounds: [] },
    },
    ...overrides,
  };
}
