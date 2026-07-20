import { describe, expect, it } from "vitest";
import { resolveCanvasResizeEdit } from "../src/apps/viewer/canvas/resize-edit.js";
import type { LayerEditorCapabilities } from "../src/apps/viewer/layers/editor-capabilities.js";

describe("canvas resize edit ownership", () => {
  it("writes intrinsic dimensions for author-sized layers", () => {
    const edit = resolveCanvasResizeEdit(
      withGeometry({
        box: { height: 220, width: 624 },
        capabilities: capabilities(
          ["width", "height", "scaleX", "scaleY", "x", "y"],
          ["scaleX", "scaleY", "x", "y"],
        ),
        handle: "se",
        layer: { height: 220, width: 520 },
        next: { scaleX: 1.3, scaleY: 1.2, x: 18, y: 14 },
        original: { scaleX: 1.2, scaleY: 1, x: 10, y: 10 },
      }),
    );

    expect(edit).toEqual({
      height: 264,
      width: 563,
      x: 18,
      y: 14,
    });
  });

  it("keeps scale ownership for renderer-sized layers", () => {
    expect(
      resolveCanvasResizeEdit(
        withGeometry({
          box: { height: 200, width: 300 },
          capabilities: capabilities(
            ["scaleX", "scaleY", "x", "y"],
            ["scaleX", "scaleY", "x", "y"],
          ),
          handle: "e",
          layer: {},
          next: { scaleX: 1.4, scaleY: 1, x: 24, y: 10 },
          original: { scaleX: 1, scaleY: 1, x: 10, y: 10 },
        }),
      ),
    ).toEqual({ scaleX: 1.4, x: 24 });
  });

  it("keeps declared dimension ownership independent of visible bounds", () => {
    expect(
      resolveCanvasResizeEdit(
        withGeometry({
          box: { height: 192, width: 620 },
          capabilities: capabilities(
            ["width", "scaleX", "x", "y"],
            ["scaleX", "x", "y"],
          ),
          handle: "e",
          layer: { width: 520 },
          next: { scaleX: 1.2, scaleY: 1, x: 62, y: 0 },
          original: { scaleX: 1, scaleY: 1, x: 0, y: 0 },
        }),
      ),
    ).toEqual({ width: 624, x: 62 });
  });

  it("does not resize an edge without positional ownership", () => {
    expect(
      resolveCanvasResizeEdit(
        withGeometry({
          box: { height: 120, width: 240 },
          capabilities: capabilities(["scaleX"], ["scaleX"]),
          handle: "e",
          layer: { width: 120 },
          next: { scaleX: 2.4, scaleY: 1, x: 80, y: 30 },
          original: { scaleX: 2, scaleY: 1, x: 20, y: 10 },
        }),
      ),
    ).toEqual({});
  });

  it("derives a missing authored size from author geometry, not visible bounds", () => {
    expect(
      resolveCanvasResizeEdit(
        withGeometry({
          authorBox: { height: 160, width: 400, x: 110, y: 16 },
          box: { height: 192, width: 620 },
          capabilities: capabilities(["width", "x", "y"], ["x", "y"]),
          handle: "w",
          layer: {},
          next: { scaleX: 2.4, scaleY: 1, x: -40, y: 0 },
          original: { scaleX: 2, scaleY: 1, x: 0, y: 0 },
        }),
      ),
    ).toEqual({ width: 240, x: -40 });
  });

  it("keeps the visible fixed edge stable for asymmetric renderer bounds", () => {
    const edit = resolveCanvasResizeEdit({
      anchor: { x: 0, y: 0 },
      authorBox: { height: 220, width: 640, x: 0, y: 250 },
      box: { height: 132.58, width: 655.8, x: -1.5, y: 272.04 },
      capabilities: capabilities(["height", "x", "y"], ["x", "y"]),
      handle: "s",
      layer: { height: 220 },
      next: { scaleX: 1, scaleY: 1.4, x: 0, y: 26.527 },
      original: { scaleX: 1, scaleY: 1, x: 0, y: 0 },
      rotation: 0,
    });

    expect(edit.height).toBe(308);
    expect(edit.y).toBeCloseTo(35.195, 3);
  });
});

function withGeometry<T extends { box: { height: number; width: number } }>(
  input: T,
) {
  return {
    anchor: { x: 0, y: 0 },
    authorBox: { ...input.box, x: 0, y: 0 },
    ...input,
    box: { ...input.box, x: 0, y: 0 },
    rotation: 0,
  };
}

function capabilities(
  properties: string[],
  transform: LayerEditorCapabilities["transform"],
): LayerEditorCapabilities {
  return {
    canvas: "bounds",
    keyframeProperties: [],
    operations: [],
    properties,
    transform,
  };
}
