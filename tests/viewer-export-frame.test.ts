import type { ViewerAppContext } from "../src/apps/viewer/app/context.js";
import type { EditorTemplateSource } from "../src/apps/viewer/templates/model.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createViewerContextFixture } from "./helpers/viewer-context-fixture.js";
import {
  createNativeBitmapFixture,
  createNativeCanvasFixture,
  createNativeDrawingContextFixture,
} from "./helpers/native-render-fixtures.js";
import { createEmptyBindingReads } from "../src/apps/viewer/app/binding-reads.js";
import { createStarterDocument } from "../src/apps/cli/starter.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function createExportContext() {
  const ctx = createViewerContextFixture();
  const bitmap = createNativeBitmapFixture({ height: 1080, width: 1920 });
  const bindingReads = createEmptyBindingReads();
  const requestSandbox = vi.spyOn(ctx, "requestSandbox").mockResolvedValue({
    kind: "renderFrameResult",
    requestId: "export",
    sequenceId: 0,
    durationMs: 0,
    bindingReads,
    bitmap,
    ok: true,
  });
  const createRenderInputFrames = vi
    .spyOn(ctx, "createRenderInputFrames")
    .mockResolvedValue({ frames: {}, transfer: [] });
  vi.spyOn(ctx, "createRenderAssets").mockResolvedValue({
    cacheKeys: [],
    envelope: { renderAssetsId: "assets" },
    transfer: [],
  });
  vi.spyOn(ctx, "createRenderModelEnvelope").mockReturnValue({});
  vi.spyOn(ctx, "commitRenderAssetTransfers").mockImplementation(() => {});
  vi.spyOn(ctx, "commitRenderModelEnvelope").mockImplementation(() => {});
  const mergeRendererContractReads = vi
    .spyOn(ctx, "mergeRendererContractReads")
    .mockImplementation(() => {});
  vi.spyOn(ctx, "getCompositionDesignSize").mockReturnValue({
    height: 720,
    width: 1280,
  });
  ctx.deps.t = (key, fallback) => fallback ?? key;
  ctx.deps.createRequestId = () => "export";
  ctx.state.loadedModules.add("module");
  return {
    ctx,
    bitmap,
    bindingReads,
    requestSandbox,
    createRenderInputFrames,
    mergeRendererContractReads,
  };
}

describe("viewer export frame coordinates", () => {
  it("keeps authoring coordinates while rendering a larger raster", async () => {
    const {
      ctx,
      bitmap,
      bindingReads,
      requestSandbox,
      createRenderInputFrames,
      mergeRendererContractReads,
    } = createExportContext();
    const normalizedReads = {
      ...createEmptyBindingReads(),
      primitiveBounds: [
        { layerId: "box", x: 0, y: 0, width: 1280, height: 720 },
      ],
    };
    const normalizePreviewBindingReads = vi
      .spyOn(ctx, "normalizePreviewBindingReads")
      .mockReturnValue(normalizedReads);
    const template = {
      id: "template",
      duration: 2,
      effectId: "effect",
      kind: "composition",
      moduleId: "module",
      target: "scene",
    };
    const effective = requireEffectiveTemplate(ctx, template);
    await expect(
      ctx.renderFrameBitmapForExport(template, effective, {
        controls: {},
        fps: 30,
        frameIndex: 30,
        height: 1080,
        time: 1,
        width: 1920,
      }),
    ).resolves.toBe(bitmap);
    expect(createRenderInputFrames).toHaveBeenCalledWith(
      effective,
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
    expect(normalizePreviewBindingReads).toHaveBeenCalledWith(bindingReads);
    expect(mergeRendererContractReads).toHaveBeenCalledWith(
      "template",
      normalizedReads,
    );
  });

  it.each(["failed-response", "commit-error"] as const)(
    "releases export bitmap on %s",
    async (mode) => {
      const { ctx, bitmap, requestSandbox } = createExportContext();
      const close = vi.spyOn(bitmap, "close");
      requestSandbox.mockResolvedValue({
        kind: "renderFrameResult",
        requestId: "export",
        sequenceId: 0,
        durationMs: 0,
        ok: mode !== "failed-response",
        bitmap,
        error: "render failed",
      });
      vi.spyOn(ctx, "commitRenderAssetTransfers").mockImplementation(() => {
        throw new Error("commit failed");
      });
      const template = { id: "effect", duration: 1, moduleId: "module" };
      await expect(
        ctx.renderFrameBitmapForExport(
          template,
          requireEffectiveTemplate(ctx, template),
          { fps: 30, frameIndex: 0, width: 1280, height: 720, time: 0 },
        ),
      ).rejects.toThrow(
        mode === "failed-response" ? "render failed" : "commit failed",
      );
      expect(close).toHaveBeenCalledOnce();
    },
  );

  it("keeps target-effect frames transparent for source compositing", async () => {
    const { ctx, requestSandbox } = createExportContext();
    const template = {
      id: "target",
      duration: 1,
      effectId: "effect",
      kind: "targetEffect",
      moduleId: "module",
      target: "selection",
    };
    await ctx.renderFrameBitmapForExport(
      template,
      requireEffectiveTemplate(ctx, template),
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

  it.each([
    { id: "composition", duration: 1, kind: "composition" },
    {
      id: "target",
      duration: 1,
      kind: "layerEffect",
      effectV1: createStarterDocument("target", "targetEffect"),
    },
  ])(
    "flattens complete RGBA frames onto a fresh opaque MP4 matte",
    (template) => {
      const calls: string[] = [];
      const context = createNativeDrawingContextFixture({
        canvas: createNativeCanvasFixture({ height: 720, width: 1280 }),
        clearRect: vi.fn<OffscreenCanvasRenderingContext2D["clearRect"]>(() => {
          calls.push("clear");
        }),
        drawImage: () => {
          calls.push("bitmap");
        },
        fillRect: vi.fn<OffscreenCanvasRenderingContext2D["fillRect"]>(() => {
          calls.push("matte");
        }),
        filter: "blur(8px)",
        globalAlpha: 0.4,
        globalCompositeOperation: "lighter",
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
        reset: vi.fn<OffscreenCanvasRenderingContext2D["reset"]>(() => {
          calls.push("reset");
        }),
        restore: vi.fn<OffscreenCanvasRenderingContext2D["restore"]>(() => {
          calls.push("restore");
        }),
        save: vi.fn<OffscreenCanvasRenderingContext2D["save"]>(() => {
          calls.push("save");
        }),
        setTransform: () => {
          calls.push("transform");
        },
        shadowBlur: 12,
        shadowColor: "#fff",
        shadowOffsetX: 4,
        shadowOffsetY: 4,
      });
      const ctx = createViewerContextFixture();
      vi.spyOn(ctx, "drawBaseForTemplate").mockImplementation(() => {
        calls.push("base");
      });
      ctx.drawExportFrame(
        context,
        template,
        createNativeBitmapFixture({ height: 720, width: 1280 }),
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
    },
  );
});

it("does not paint a sample scene behind an imported targetEffect", () => {
  const ctx = createViewerContextFixture();
  const sample = vi
    .spyOn(ctx.deps, "drawSampleScene")
    .mockImplementation(() => {});
  const context = createNativeDrawingContextFixture({
    canvas: createNativeCanvasFixture({ width: 128, height: 72 }),
    clearRect: vi.fn<OffscreenCanvasRenderingContext2D["clearRect"]>(),
  });
  const clearRect = vi.spyOn(context, "clearRect");
  ctx.drawBaseForTemplate(
    context,
    {
      id: "target",
      duration: 1,
      kind: "layerEffect",
      effectV1: createStarterDocument("target", "targetEffect"),
    },
    0.5,
  );
  expect(sample).not.toHaveBeenCalled();
  expect(clearRect).toHaveBeenCalledWith(0, 0, 128, 72);
});

function requireEffectiveTemplate(
  ctx: ViewerAppContext,
  source: EditorTemplateSource,
) {
  const template = ctx.getEffectiveTemplate(source);
  if (!template) throw new Error("Missing effective export template fixture.");
  return template;
}
