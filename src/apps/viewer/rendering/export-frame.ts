import { bindViewerAction } from "../app/bind-action.js";
import type {
  EditorTemplate,
  EditorTemplateSource,
} from "../templates/model.js";
import type {
  ViewerDrawingContext,
  ViewerRenderOutputActions,
  ExportFrameOptions,
} from "./output-contract.js";
import type { ViewerAppContext } from "../app/context.js";
import { resolveViewerRenderFailureMessage } from "./errors.js";
import { resolveViewerRenderTimeoutMs } from "./timeouts.js";

async function renderFrameBitmapForExport(
  ctx: ViewerAppContext,
  template: EditorTemplateSource,
  effectiveTemplate: EditorTemplate,
  { controls, frameIndex, fps, height, time, width }: ExportFrameOptions,
): Promise<ImageBitmap> {
  const moduleId = template.moduleId ?? "";
  if (!ctx.state.loadedModules.has(moduleId)) {
    if (!(await ctx.ensureModuleLoaded(moduleId))) {
      throw new Error(
        ctx.deps
          .t(
            "viewer.rendering.moduleLoadFailed",
            "Failed to load module {module}.",
          )
          .replace("{module}", moduleId),
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
    result.bitmap?.close();
    throw new Error(resolveViewerRenderFailureMessage(ctx.deps.t, result));
  }
  try {
    ctx.commitRenderAssetTransfers(renderAssets);
    ctx.commitRenderModelEnvelope(renderModel);
    ctx.mergeRendererContractReads(
      template.id,
      ctx.normalizePreviewBindingReads(result.bindingReads),
    );
    return result.bitmap;
  } catch (error) {
    result.bitmap.close();
    throw error;
  }
}

function drawExportFrame(
  ctx: ViewerAppContext,
  context: ViewerDrawingContext,
  template: EditorTemplateSource,
  bitmap: ImageBitmap,
  progress: number,
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

function usesOpaqueExportMatte(template: EditorTemplateSource): boolean {
  return (
    (template.effectV1 !== null &&
      typeof template.effectV1 === "object" &&
      "kind" in template.effectV1 &&
      template.effectV1.kind === "targetEffect") ||
    template.kind === "sceneEffect" ||
    template.kind === "transitionEffect" ||
    template.kind === "composition"
  );
}

function resetExportContext(context: ViewerDrawingContext): void {
  if (typeof context.reset === "function") {
    context.reset();
    return;
  }
  resetExportDrawingState(context);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
}

function resetExportDrawingState(context: ViewerDrawingContext): void {
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

export function createExportFrameActions(
  getContext: () => ViewerAppContext,
): Pick<
  ViewerRenderOutputActions,
  "renderFrameBitmapForExport" | "drawExportFrame"
> {
  return {
    renderFrameBitmapForExport: bindViewerAction(
      renderFrameBitmapForExport,
      getContext,
    ),
    drawExportFrame: bindViewerAction(drawExportFrame, getContext),
  };
}
