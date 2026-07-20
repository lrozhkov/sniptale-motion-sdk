import { describe, expect, it, vi } from "vitest";

import { installRenderingExportFrameOwner } from "../src/apps/viewer/rendering/export-frame";

describe("viewer export frame coordinates", () => {
  it("keeps authoring coordinates while rendering a larger raster", async () => {
    const bitmap = { height: 1080, width: 1920 };
    const bindingReads = { primitiveBounds: [] };
    const normalizedReads = { primitiveBounds: [{ layerId: "box" }] };
    const requestSandbox = vi.fn(async () => ({
      bindingReads,
      bitmap,
      ok: true,
    }));
    const createRenderInputFrames = vi.fn(async () => ({
      frames: {},
      transfer: [],
    }));
    const ctx = {
      commitRenderAssetTransfers: vi.fn(),
      commitRenderModelEnvelope: vi.fn(),
      createRenderAssets: vi.fn(async () => ({ envelope: {}, transfer: [] })),
      createRenderInputFrames,
      createRenderModelEnvelope: vi.fn(() => ({})),
      deps: {
        createRequestId: () => "mp4:1",
        t: (_key, fallback) => fallback,
      },
      ensureModuleLoaded: vi.fn(async () => true),
      getCompositionDesignSize: () => ({ height: 720, width: 1280 }),
      getRendererType: () => "compiled-js",
      mergeRendererContractReads: vi.fn(),
      normalizePreviewBindingReads: vi.fn(() => normalizedReads),
      requestSandbox,
      state: {
        controls: {},
        loadedModules: new Set(["module"]),
      },
    } as any;
    installRenderingExportFrameOwner(ctx);
    const template = {
      effectId: "effect",
      id: "template",
      kind: "composition",
      moduleId: "module",
      target: "scene",
    };

    await expect(
      ctx.renderFrameBitmapForExport(
        template,
        { duration: 2 },
        {
          controls: {},
          fps: 30,
          frameIndex: 30,
          height: 1080,
          time: 1,
          width: 1920,
        },
      ),
    ).resolves.toBe(bitmap);

    expect(createRenderInputFrames).toHaveBeenCalledWith(
      { duration: 2 },
      1280,
      720,
      0.5,
    );
    expect(requestSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        height: 1080,
        opaqueBackground: true,
        outputHeight: 720,
        outputWidth: 1280,
        width: 1920,
      }),
      expect.any(Number),
      expect.any(Array),
    );
    expect(ctx.normalizePreviewBindingReads).toHaveBeenCalledWith(bindingReads);
    expect(ctx.mergeRendererContractReads).toHaveBeenCalledWith(
      "template",
      normalizedReads,
    );
  });

  it("keeps target-effect frames transparent for source compositing", async () => {
    const requestSandbox = vi.fn(async () => ({
      bitmap: { height: 720, width: 1280 },
      ok: true,
    }));
    const ctx = {
      commitRenderAssetTransfers: vi.fn(),
      commitRenderModelEnvelope: vi.fn(),
      createRenderAssets: vi.fn(async () => ({ envelope: {}, transfer: [] })),
      createRenderInputFrames: vi.fn(async () => ({
        frames: {},
        transfer: [],
      })),
      createRenderModelEnvelope: vi.fn(() => ({})),
      deps: {
        createRequestId: () => "mp4:target",
        t: (_key, fallback) => fallback,
      },
      getCompositionDesignSize: () => ({ height: 720, width: 1280 }),
      getRendererType: () => "graph",
      mergeRendererContractReads: vi.fn(),
      normalizePreviewBindingReads: vi.fn(() => ({})),
      requestSandbox,
      state: { controls: {}, loadedModules: new Set(["module"]) },
    } as any;
    installRenderingExportFrameOwner(ctx);

    await ctx.renderFrameBitmapForExport(
      {
        effectId: "effect",
        id: "target",
        kind: "targetEffect",
        moduleId: "module",
        target: "selection",
      },
      { duration: 1 },
      {
        controls: {},
        fps: 30,
        frameIndex: 0,
        height: 720,
        time: 0,
        width: 1280,
      },
    );

    expect(requestSandbox).toHaveBeenCalledWith(
      expect.objectContaining({ opaqueBackground: false }),
      expect.any(Number),
      expect.any(Array),
    );
  });

  it("flattens transparent composition frames onto a fresh opaque matte", () => {
    const calls: string[] = [];
    const context = {
      canvas: { height: 720, width: 1280 },
      clearRect: vi.fn(() => calls.push("clear")),
      drawImage: vi.fn(() => calls.push("bitmap")),
      fillRect: vi.fn(() => calls.push("matte")),
      filter: "blur(8px)",
      globalAlpha: 0.4,
      globalCompositeOperation: "lighter",
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      reset: vi.fn(() => calls.push("reset")),
      restore: vi.fn(() => calls.push("restore")),
      save: vi.fn(() => calls.push("save")),
      setTransform: vi.fn(() => calls.push("transform")),
      shadowBlur: 12,
      shadowColor: "#fff",
      shadowOffsetX: 4,
      shadowOffsetY: 4,
    } as any;
    const ctx = {
      drawBaseForTemplate: vi.fn(() => calls.push("base")),
    } as any;
    installRenderingExportFrameOwner(ctx);

    ctx.drawExportFrame(
      context,
      { kind: "composition" },
      { height: 720, width: 1280 },
      0.5,
    );

    expect(calls).toEqual([
      "reset",
      "save",
      "base",
      "restore",
      "transform",
      "clear",
      "matte",
      "bitmap",
    ]);
    expect(context.fillStyle).toBe("#000000");
    expect(context.globalAlpha).toBe(1);
    expect(context.globalCompositeOperation).toBe("source-over");
    expect(context.filter).toBe("none");
    expect(context.shadowBlur).toBe(0);
    expect(context.imageSmoothingEnabled).toBe(true);
    expect(context.imageSmoothingQuality).toBe("high");
  });
});
