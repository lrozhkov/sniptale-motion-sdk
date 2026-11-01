import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import {
  createNativeBitmapFixture,
  createNativeCanvasFixture,
} from "./helpers/native-render-fixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("frame presentation bitmap ownership", () => {
  it.each([
    { mode: "direct-draw-error", error: "drawing failed" },
    { mode: "buffer-null", error: "Canvas 2D context is unavailable." },
    { mode: "fast-transfer-error", error: "drawing failed" },
    { mode: "fast-null", error: "Canvas 2D context is unavailable." },
    { mode: "fast-draw-error", error: "drawing failed" },
  ] as const)("releases the bitmap on $mode", ({ mode, error }) => {
    const { draw, close, drawBase } = fixture(mode);
    expect(draw).toThrow(error);
    expect(close).toHaveBeenCalledOnce();
    expect(drawBase).not.toHaveBeenCalled();
  });

  it.each([
    { mode: "direct-success", closes: 1, transfers: 0 },
    { mode: "transfer-success", closes: 0, transfers: 1 },
  ] as const)(
    "handles $mode without losing ownership",
    ({ mode, closes, transfers }) => {
      const { draw, close, transfer, bitmap } = fixture(mode);
      draw();
      expect(close).toHaveBeenCalledTimes(closes);
      expect(transfer.mock.calls).toEqual(transfers === 1 ? [[bitmap]] : []);
    },
  );
});

type Mode =
  | "direct-draw-error"
  | "buffer-null"
  | "fast-transfer-error"
  | "fast-null"
  | "fast-draw-error"
  | "direct-success"
  | "transfer-success";

function fixture(mode: Mode) {
  const ctx = createViewerContextFixture();
  const bitmap = createNativeBitmapFixture({ width: 160, height: 90 });
  const close = vi.spyOn(bitmap, "close");
  const failure = new Error("drawing failed");
  const drawing = Object.assign(ctx.previewContext, {
    clearRect(): void {},
    drawImage(): void {
      if (mode.endsWith("draw-error")) throw failure;
    },
  });
  class FixtureBitmapContext {
    transferFromImageBitmap(): void {
      if (mode === "fast-transfer-error") throw failure;
    }
  }
  vi.stubGlobal("ImageBitmapRenderingContext", FixtureBitmapContext);
  const bitmapContext = new ImageBitmapRenderingContext();
  const transfer = vi.spyOn(bitmapContext, "transferFromImageBitmap");
  for (const surface of [
    ctx.refs.canvas,
    ctx.refs.fastPreviewCanvas,
    ctx.refs.directPreviewCanvas,
  ]) {
    Object.assign(surface, {
      hidden: true,
      width: 1280,
      height: 720,
      style: { opacity: "1" },
    });
  }
  vi.spyOn(ctx.refs.fastPreviewCanvas, "getContext").mockImplementation(
    (kind) =>
      kind === "bitmaprenderer"
        ? mode.includes("transfer")
          ? bitmapContext
          : null
        : mode === "fast-null"
          ? null
          : drawing,
  );
  ctx.state.playing = mode.startsWith("fast") || mode === "transfer-success";
  ctx.deps.t = (key, fallback) => fallback ?? key;
  vi.spyOn(ctx, "hidePlaybackVideoCacheSurface").mockImplementation(() => {});
  const drawBase = vi
    .spyOn(ctx, "drawBaseForTemplate")
    .mockImplementation(() => {});
  vi.spyOn(ctx, "createFrameBuffer").mockReturnValue(
    createNativeCanvasFixture({}),
  );
  const draw = () =>
    ctx.drawCompletedFrame(
      {
        id: "effect",
        duration: 2,
        kind: mode === "buffer-null" ? "layerEffect" : "composition",
      },
      bitmap,
      0,
    );
  return { draw, close, transfer, bitmap, drawBase };
}
