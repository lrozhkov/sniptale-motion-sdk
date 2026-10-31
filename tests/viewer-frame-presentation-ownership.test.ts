import { describe, expect, it, vi } from "vitest";
import { createFramePresentationActions } from "../src/apps/viewer/rendering/frame";

describe("frame presentation bitmap ownership", () => {
  it.each([
    "direct-draw-error",
    "buffer-null",
    "fast-transfer-error",
    "fast-null",
    "fast-draw-error",
    "direct-success",
    "transfer-success",
  ] as const)("handles %s without losing a bitmap", (mode) => {
    const failure = new Error("drawing failed");
    const bitmap = { width: 160, height: 90, close: vi.fn() };
    const transfer = vi.fn(() => {
      if (mode === "fast-transfer-error") throw failure;
    });
    const drawing = {
      clearRect: vi.fn(),
      drawImage: vi.fn(() => {
        if (mode.endsWith("draw-error")) throw failure;
      }),
    };
    const surface = () => ({
      hidden: true,
      width: 1280,
      height: 720,
      dataset: {},
      style: { opacity: "1" },
    });
    const fast = {
      ...surface(),
      getContext: (kind: string) =>
        kind === "bitmaprenderer"
          ? mode.includes("transfer")
            ? { transferFromImageBitmap: transfer }
            : null
          : mode === "fast-null"
            ? null
            : drawing,
    };
    const ctx = {
      state: {
        playing: mode.startsWith("fast") || mode === "transfer-success",
      },
      refs: {
        canvas: surface(),
        fastPreviewCanvas: fast,
        directPreviewCanvas: surface(),
      },
      deps: { t: (_key: string, fallback: string) => fallback },
      previewContext: drawing,
      drawBaseForTemplate: vi.fn(),
    } as any;
    Object.assign(
      ctx,
      createFramePresentationActions(() => ctx),
    );
    ctx.createFrameBuffer = () => ({ getContext: () => null });
    const draw = () =>
      ctx.drawCompletedFrame(
        {
          id: "effect",
          kind: mode === "buffer-null" ? "layerEffect" : "composition",
        },
        bitmap,
        0,
      );
    if (mode.endsWith("success")) draw();
    else expect(draw).toThrow();
    if (mode === "transfer-success") {
      expect(transfer).toHaveBeenCalledWith(bitmap);
      expect(bitmap.close).not.toHaveBeenCalled();
    } else expect(bitmap.close).toHaveBeenCalledOnce();
    if (mode === "buffer-null")
      expect(ctx.drawBaseForTemplate).not.toHaveBeenCalled();
  });
});
