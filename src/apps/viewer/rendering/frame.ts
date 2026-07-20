import type { ViewerAppContext } from "../app/context.js";
import { recordDirectPreviewPresentation } from "./presentation-cadence.js";
import {
  syncDirectPreviewSurface,
  syncPreviewSurfaceVisibility,
} from "./preview-surfaces.js";
import {
  estimateFullResolutionRenderMs,
  updateFullResolutionRenderAverage,
} from "./render-metrics.js";
import { isDirectLiveRenderPreferred } from "./direct-live-policy.js";

function drawCompletedFrame(
  ctx: ViewerAppContext,
  template,
  bitmap,
  progress,
  result: any = {},
) {
  ctx.hidePlaybackVideoCacheSurface?.();
  if (result.presented === true) {
    recordDirectPreviewPresentation(
      ctx,
      result.presentedAtMs,
      result.presentedAtEpochMs,
    );
    if (
      isPreviewInteractionActive(ctx) &&
      ctx.state.currentTemplate?.id === template.id
    ) {
      showDirectPreviewFrame(ctx, result.previewWidth, result.previewHeight);
    } else {
      syncPreviewSurfaceVisibility(
        ctx.refs.fastPreviewCanvas,
        ctx.refs.directPreviewCanvas,
        "none",
        ctx.refs.canvas,
      );
    }
    return;
  }
  if (shouldUseFastPreviewSurface(ctx, template, bitmap)) {
    drawFastPreviewFrame(ctx, bitmap);
    return;
  }
  if (
    template.kind === "sceneEffect" ||
    template.kind === "transitionEffect" ||
    template.kind === "composition"
  ) {
    ctx.previewContext.clearRect(
      0,
      0,
      ctx.refs.canvas.width,
      ctx.refs.canvas.height,
    );
    ctx.previewContext.drawImage(
      bitmap,
      0,
      0,
      ctx.refs.canvas.width,
      ctx.refs.canvas.height,
    );
    bitmap.close?.();
    syncPreviewSurfaceVisibility(
      ctx.refs.fastPreviewCanvas,
      ctx.refs.directPreviewCanvas,
      "none",
      ctx.refs.canvas,
    );
    return;
  }
  const buffer = ctx.createFrameBuffer(
    ctx.refs.canvas.width,
    ctx.refs.canvas.height,
  );
  const context = buffer.getContext("2d");
  ctx.drawBaseForTemplate(context, template, progress);
  context.drawImage(
    bitmap,
    0,
    0,
    ctx.refs.canvas.width,
    ctx.refs.canvas.height,
  );
  ctx.previewContext.clearRect(
    0,
    0,
    ctx.refs.canvas.width,
    ctx.refs.canvas.height,
  );
  ctx.previewContext.drawImage(
    buffer,
    0,
    0,
    ctx.refs.canvas.width,
    ctx.refs.canvas.height,
  );
  bitmap.close?.();
  syncPreviewSurfaceVisibility(
    ctx.refs.fastPreviewCanvas,
    ctx.refs.directPreviewCanvas,
    "none",
    ctx.refs.canvas,
  );
}

export function shouldUseDirectPreviewSurface(
  ctx: ViewerAppContext,
  template: any,
  _renderPlan: { scale?: number },
): boolean {
  const directFrame =
    template.kind === "sceneEffect" ||
    template.kind === "transitionEffect" ||
    template.kind === "composition";
  const directInteraction =
    ctx.state.canvasTransformDragActive ||
    (ctx.state.playing &&
      ctx.state.previewCacheEnabled === false &&
      isDirectLiveRenderPreferred(ctx, template));
  return Boolean(
    directFrame &&
    directInteraction &&
    !ctx.state.previewVideoCache?.recording &&
    ctx.state.directRenderEffectIds.has(template.effectId) &&
    ctx.state.directRenderResponsePort?.presentationSurfaceAttached,
  );
}

export function shouldUseFastPreviewSurface(
  ctx: ViewerAppContext,
  template: any,
  bitmap: { height?: number; width?: number },
): boolean {
  const directFrame =
    template.kind === "sceneEffect" ||
    template.kind === "transitionEffect" ||
    template.kind === "composition";
  const interactive = isPreviewInteractionActive(ctx);
  return Boolean(
    directFrame &&
    interactive &&
    Number(bitmap.width) > 0 &&
    Number(bitmap.height) > 0,
  );
}

function drawFastPreviewFrame(ctx: ViewerAppContext, bitmap) {
  const canvas = ctx.refs.fastPreviewCanvas as HTMLCanvasElement;
  if (canvas.width !== bitmap.width) {
    canvas.width = bitmap.width;
  }
  if (canvas.height !== bitmap.height) {
    canvas.height = bitmap.height;
  }
  syncPreviewSurfaceVisibility(
    canvas,
    ctx.refs.directPreviewCanvas,
    "fast",
    ctx.refs.canvas,
  );
  const bitmapContext = canvas.getContext("bitmaprenderer");
  if (bitmapContext) {
    bitmapContext.transferFromImageBitmap(bitmap);
    return;
  }
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
  context?.drawImage(bitmap, 0, 0);
  bitmap.close?.();
}

function isPreviewInteractionActive(ctx: ViewerAppContext): boolean {
  return ctx.state.playing || ctx.state.canvasTransformDragActive;
}

function showDirectPreviewFrame(ctx: ViewerAppContext, width, height) {
  const canvas = ctx.refs.directPreviewCanvas as HTMLCanvasElement;
  syncDirectPreviewSurface(
    canvas,
    ctx.refs.fastPreviewCanvas as HTMLCanvasElement,
    width,
    height,
    ctx.refs.canvas as HTMLCanvasElement,
  );
}

function createFrameBuffer(ctx: ViewerAppContext, width, height): any {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function updateRenderStats(
  ctx: ViewerAppContext,
  durationMs,
  renderScale = 1,
  previewLatencyMs = durationMs,
  measureCost = true,
) {
  ctx.state.renderCount += 1;
  if (!measureCost) {
    return;
  }
  ctx.state.lastRenderMs = durationMs;
  ctx.state.lastPreviewLatencyMs = Math.max(
    durationMs,
    Number(previewLatencyMs) || 0,
  );
  ctx.state.averageRenderMs =
    ctx.state.renderCount === 1
      ? durationMs
      : ctx.state.averageRenderMs * 0.85 + durationMs * 0.15;
  ctx.state.averagePreviewLatencyMs =
    ctx.state.renderCount === 1
      ? ctx.state.lastPreviewLatencyMs
      : ctx.state.averagePreviewLatencyMs * 0.85 +
        ctx.state.lastPreviewLatencyMs * 0.15;
  const estimatedFullRenderMs = estimateFullResolutionRenderMs(
    durationMs,
    renderScale,
  );
  ctx.state.lastEstimatedFullRenderMs = estimatedFullRenderMs;
  ctx.state.averageFullRenderMs = updateFullResolutionRenderAverage(
    ctx.state.averageFullRenderMs,
    estimatedFullRenderMs,
    renderScale,
    ctx.state.renderCount,
  );
  if (!shouldUpdateRenderStatsUi(ctx)) {
    return;
  }
  const rendererType = ctx.getRendererType(ctx.state.currentTemplate);
  const rendererLabel = ctx.deps.t(
    `viewer.templates.rendererTypes.${rendererType}`,
    rendererType,
  );
  ctx.refs.renderStats.textContent = ctx.deps
    .t(
      "viewer.rendering.frameStats",
      "{type} · {duration} ms frame · {average} ms average · {stale} stale",
    )
    .replace("{type}", rendererLabel)
    .replace("{duration}", durationMs.toFixed(1))
    .replace("{average}", ctx.state.averageRenderMs.toFixed(1))
    .replace("{stale}", String(ctx.state.staleResponses));
  ctx.refs.renderStats.title = ctx.deps.formatBindingReadsTitle(
    ctx.state.lastBindingReads,
  );
}

function setRenderStatus(ctx: ViewerAppContext, status) {
  if (ctx.state.playing && status === "rendering") {
    return;
  }
  if (ctx.refs.renderStats.dataset.status !== status) {
    ctx.refs.renderStats.dataset.status = status;
  }
  if (status === "rendering" && shouldUpdateRenderStatsUi(ctx)) {
    ctx.refs.renderStats.textContent = ctx.deps.t(
      "viewer.rendering.rendering",
      "rendering...",
    );
  }
}

function shouldUpdateRenderStatsUi(ctx: ViewerAppContext): boolean {
  return (
    !ctx.state.playing ||
    (ctx.state.activeSidebarGroup === "health" &&
      ctx.state.activeHealthTab === "diagnostics")
  );
}

export function installRenderingFrameOwner(ctx: ViewerAppContext): void {
  ctx.drawCompletedFrame = (...args: any[]) =>
    (drawCompletedFrame as any)(ctx, ...args);
  ctx.shouldUseDirectPreviewSurface = (...args: any[]) =>
    (shouldUseDirectPreviewSurface as any)(ctx, ...args);
  ctx.createFrameBuffer = (...args: any[]) =>
    (createFrameBuffer as any)(ctx, ...args);
  ctx.updateRenderStats = (...args: any[]) =>
    (updateRenderStats as any)(ctx, ...args);
  ctx.setRenderStatus = (...args: any[]) =>
    (setRenderStatus as any)(ctx, ...args);
}
