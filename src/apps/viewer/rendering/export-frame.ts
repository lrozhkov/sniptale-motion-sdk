import type { ViewerAppContext } from "../app/context.js";
import { resolveViewerRenderFailureMessage } from "./errors.js";
import { resolveViewerRenderTimeoutMs } from "./timeouts.js";

async function renderFrameBitmapForExport(
  ctx: ViewerAppContext,
  template,
  effectiveTemplate,
  { controls, frameIndex, fps, height, time, width },
): Promise<ImageBitmap> {
  return renderFrameForExport(ctx, template, effectiveTemplate, {
    controls,
    frameIndex,
    fps,
    height,
    time,
    width,
  });
}

async function renderFrameForExport(
  ctx: ViewerAppContext,
  template,
  effectiveTemplate,
  { controls, frameIndex, fps, height, time, width },
): Promise<ImageBitmap> {
  if (!ctx.state.loadedModules.has(template.moduleId)) {
    if (!(await ctx.ensureModuleLoaded(template.moduleId))) {
      throw new Error(
        ctx.deps
          .t(
            "viewer.rendering.moduleLoadFailed",
            "Failed to load module {module}.",
          )
          .replace("{module}", template.moduleId),
      );
    }
  }
  const duration = effectiveTemplate.duration;
  const progress = duration > 0 ? time / duration : 0;
  const { height: outputHeight, width: outputWidth } =
    ctx.getCompositionDesignSize();
  const renderInput = await ctx.createRenderInputFrames(
    effectiveTemplate,
    outputWidth,
    outputHeight,
    progress,
  );
  const inputFrames = renderInput.frames;
  const renderAssets = await ctx.createRenderAssets(effectiveTemplate);
  const renderModel = ctx.createRenderModelEnvelope(effectiveTemplate);
  const result = await ctx.requestSandbox(
    {
      ...renderAssets.envelope,
      controls: controls ?? ctx.state.controls,
      effectId: template.effectId,
      fps,
      frameIndex,
      height,
      inputFrames,
      kind: "renderFrame",
      outputHeight,
      outputWidth,
      opaqueBackground: usesOpaqueExportMatte(template),
      ...renderModel,
      progress,
      rendererType: ctx.getRendererType(template),
      renderQuality: "full",
      requestId: ctx.deps.createRequestId("mp4"),
      sequenceId: 0,
      target: { kind: template.target },
      time,
      width,
    },
    resolveViewerRenderTimeoutMs(true),
    [...renderInput.transfer, ...renderAssets.transfer],
  );
  if (!result.ok || !result.bitmap) {
    throw new Error(resolveViewerRenderFailureMessage(ctx.deps.t, result));
  }
  ctx.commitRenderAssetTransfers(renderAssets);
  ctx.commitRenderModelEnvelope(renderModel);
  ctx.mergeRendererContractReads(
    template.id,
    ctx.normalizePreviewBindingReads(result.bindingReads),
  );
  return result.bitmap;
}

function drawExportFrame(
  ctx: ViewerAppContext,
  context,
  template,
  bitmap,
  progress,
) {
  resetExportContext(context);
  context.save();
  try {
    ctx.drawBaseForTemplate(context, template, progress);
  } finally {
    context.restore();
  }
  resetExportDrawingState(context);
  if (usesOpaqueExportMatte(template)) {
    // MP4 codecs do not carry canvas alpha. Flatten transparent effect frames
    // explicitly so hardware encoders cannot reinterpret un-premultiplied RGB.
    context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  }
  context.drawImage(bitmap, 0, 0, context.canvas.width, context.canvas.height);
}

function usesOpaqueExportMatte(template): boolean {
  return (
    template.effectV1?.kind === "targetEffect" ||
    template.kind === "sceneEffect" ||
    template.kind === "transitionEffect" ||
    template.kind === "composition"
  );
}

function resetExportContext(context): void {
  if (typeof context.reset === "function") {
    context.reset();
    return;
  }
  resetExportDrawingState(context);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
}

function resetExportDrawingState(context): void {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.filter = "none";
  context.shadowBlur = 0;
  context.shadowColor = "rgba(0, 0, 0, 0)";
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
}

export function installRenderingExportFrameOwner(ctx: ViewerAppContext): void {
  ctx.renderFrameBitmapForExport = (...args: any[]) =>
    (renderFrameBitmapForExport as any)(ctx, ...args);
  ctx.drawExportFrame = (...args: any[]) =>
    (drawExportFrame as any)(ctx, ...args);
}
