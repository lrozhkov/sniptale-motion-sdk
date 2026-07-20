import { describe, expect, it, vi } from "vitest";

import { isCanvasPointInsideLayer } from "../src/apps/viewer/canvas/hit-testing";

describe("viewer canvas hit testing", () => {
  it("uses renderer hit bounds independently from the intrinsic edit box", () => {
    const getLayerCanvasHitBox = vi.fn(() => ({
      height: 100,
      rotation: 0,
      width: 220,
      x: 20,
      y: 30,
    }));
    const ctx = {
      getLayerCanvasHitBox,
      getLayerCanvasPivot: (box) => ({
        x: box.x + box.width * 0.5,
        y: box.y + box.height * 0.5,
      }),
    } as any;
    const layer = { id: "card" };

    expect(isCanvasPointInsideLayer(ctx, { x: 225, y: 80 }, layer)).toBe(true);
    expect(getLayerCanvasHitBox).toHaveBeenCalledWith("card", layer);
  });

  it("rotates the pointer into the local hit box around the layer pivot", () => {
    const ctx = {
      getLayerCanvasHitBox: () => ({
        height: 40,
        rotation: 90,
        width: 100,
        x: 20,
        y: 30,
      }),
      getLayerCanvasPivot: () => ({ x: 70, y: 50 }),
    } as any;

    expect(
      isCanvasPointInsideLayer(ctx, { x: 70, y: 95 }, { id: "rotated" }),
    ).toBe(true);
    expect(
      isCanvasPointInsideLayer(ctx, { x: 120, y: 50 }, { id: "rotated" }),
    ).toBe(false);
  });
});
