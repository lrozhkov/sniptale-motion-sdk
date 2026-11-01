import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { isCanvasPointInsideLayer } from "../src/apps/viewer/canvas/hit-testing";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("viewer canvas hit testing", () => {
  it("uses renderer hit bounds independently from the intrinsic edit box", () => {
    const ctx = createViewerContextFixture();
    const getLayerCanvasHitBox = vi
      .spyOn(ctx, "getLayerCanvasHitBox")
      .mockReturnValue({ height: 100, rotation: 0, width: 220, x: 20, y: 30 });
    vi.spyOn(ctx, "getLayerCanvasPivot").mockImplementation((box) => ({
      x: box.x + box.width * 0.5,
      y: box.y + box.height * 0.5,
    }));
    const layer = { id: "card", type: "rect" };

    expect(isCanvasPointInsideLayer(ctx, { x: 225, y: 80 }, layer)).toBe(true);
    expect(getLayerCanvasHitBox).toHaveBeenCalledWith("card", layer);
  });

  it("rotates the pointer into the local hit box around the layer pivot", () => {
    const ctx = createViewerContextFixture();
    vi.spyOn(ctx, "getLayerCanvasHitBox").mockReturnValue({
      height: 40,
      rotation: 90,
      width: 100,
      x: 20,
      y: 30,
    });
    vi.spyOn(ctx, "getLayerCanvasPivot").mockReturnValue({ x: 70, y: 50 });

    expect(
      isCanvasPointInsideLayer(
        ctx,
        { x: 70, y: 95 },
        { id: "rotated", type: "rect" },
      ),
    ).toBe(true);
    expect(
      isCanvasPointInsideLayer(
        ctx,
        { x: 120, y: 50 },
        { id: "rotated", type: "rect" },
      ),
    ).toBe(false);
  });
});
