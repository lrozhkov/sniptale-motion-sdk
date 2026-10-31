import { describe, expect, it, vi } from "vitest";

import {
  createPreviewRasterActions,
  parseRasterSize,
} from "../src/apps/viewer/rendering/raster-size";
import { MAX_RENDER_PIXELS } from "../src/sdk/protocol";

describe("viewer preview raster size", () => {
  it("does not coerce external size values", () => {
    const calls: string[] = [];
    const value = {
      toString() {
        calls.push("size");
        return "1920x1080";
      },
    };
    const fallback = { height: 720, width: 1280 };
    expect(parseRasterSize(value, fallback)).toBe(fallback);
    expect(calls).toEqual([]);
  });

  it("allows every resolution exposed by the preview selector", () => {
    expect(MAX_RENDER_PIXELS).toBeGreaterThanOrEqual(3840 * 2160);
  });

  it.each([
    ["1920x1080", { height: 1080, width: 1920 }],
    ["2560x1440", { height: 1440, width: 2560 }],
    ["3840x2160", { height: 2160, width: 3840 }],
  ])("parses the %s high-resolution preset", (value, expected) => {
    expect(parseRasterSize(value, { height: 720, width: 1280 })).toEqual(
      expected,
    );
  });

  it("changes raster density without changing composition coordinates", () => {
    const ctx = {
      invalidatePlaybackVideoCache: vi.fn(async () => undefined),
      refs: {
        canvas: { height: 720, width: 1280 },
        sizeSelect: { value: "640x360" },
      },
      setPreviewZoom: vi.fn(),
      state: {
        interactivePreviewScale: 0.5,
        previewRasterHeight: 720,
        previewRasterWidth: 1280,
        previewZoom: "fit",
      },
      updateCanvasSelectionBox: vi.fn(),
    } as any;
    Object.assign(
      ctx,
      createPreviewRasterActions(() => ctx),
    );

    ctx.applyPreviewRasterSize();

    expect(ctx.getCompositionDesignSize()).toEqual({
      height: 720,
      width: 1280,
    });
    expect(ctx.getPreviewRasterSize()).toEqual({ height: 360, width: 640 });
    expect(ctx.refs.canvas).toMatchObject({ height: 720, width: 1280 });
    expect(ctx.state.interactivePreviewScale).toBe(1);
    expect(ctx.invalidatePlaybackVideoCache).toHaveBeenCalledOnce();
    expect(ctx.setPreviewZoom).toHaveBeenCalledWith("fit");
    expect(ctx.updateCanvasSelectionBox).toHaveBeenCalledOnce();
  });

  it("falls back when a raster preset is malformed", () => {
    expect(parseRasterSize("not-a-size", { height: 720, width: 1280 })).toEqual(
      { height: 720, width: 1280 },
    );
  });
});
