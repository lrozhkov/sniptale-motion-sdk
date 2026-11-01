import type { CanvasSurfaceContext } from "../src/apps/sandbox/runtime/canvas-model.js";
import { describe, expect, it, vi } from "vitest";

import {
  createLogicalCanvasFactory,
  getLogicalCanvasScale,
  getLogicalCanvasSize,
} from "../src/apps/sandbox/runtime/logical-canvas";

describe("sandbox logical canvas", () => {
  it("keeps composition coordinates while reducing backing pixels", () => {
    const setTransform =
      vi.fn<NonNullable<CanvasSurfaceContext["setTransform"]>>();
    const context = { setTransform };
    const createCanvas = vi.fn<
      (
        width: number,
        height: number,
      ) => { getContext(): typeof context; height: number; width: number }
    >((width, height) => ({
      getContext: () => context,
      height,
      width,
    }));
    const createLogicalCanvas = createLogicalCanvasFactory({
      createCanvas,
      outputHeight: 720,
      outputWidth: 1280,
      renderHeight: 180,
      renderWidth: 320,
    });

    const canvas = createLogicalCanvas(1280, 720);

    expect(createCanvas).toHaveBeenCalledWith(320, 180);
    expect(setTransform).toHaveBeenCalledWith(0.25, 0, 0, 0.25, 0, 0);
    expect(context).toMatchObject({
      __sniptaleLogicalScaleX: 0.25,
      __sniptaleLogicalScaleY: 0.25,
    });
    expect(getLogicalCanvasSize(canvas)).toEqual({
      height: 720,
      width: 1280,
    });
    expect(getLogicalCanvasScale(context)).toEqual({
      uniform: 0.25,
      x: 0.25,
      y: 0.25,
    });
  });

  it("scales temporary logical canvases by the same pixel ratio", () => {
    const context = {
      setTransform: vi.fn<NonNullable<CanvasSurfaceContext["setTransform"]>>(),
    };
    const createCanvas = vi.fn<
      (
        width: number,
        height: number,
      ) => { getContext(): typeof context; height: number; width: number }
    >((width, height) => ({
      getContext: () => context,
      height,
      width,
    }));
    const createLogicalCanvas = createLogicalCanvasFactory({
      createCanvas,
      outputHeight: 720,
      outputWidth: 1280,
      renderHeight: 90,
      renderWidth: 160,
    });

    createLogicalCanvas(640, 360);

    expect(createCanvas).toHaveBeenCalledWith(80, 45);
  });

  it("falls back to unit style scale outside a logical canvas", () => {
    expect(getLogicalCanvasScale({})).toEqual({ uniform: 1, x: 1, y: 1 });
  });
});
