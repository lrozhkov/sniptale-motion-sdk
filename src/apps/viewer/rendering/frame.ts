import { bindViewerAction } from "../app/bind-action.js";
import type { EditorTemplateSource } from "../templates/model.js";
import type {
  FramePresentationActions,
  FramePresentationMetadata,
  RenderSurfaceTemplate,
  ViewerFrameBuffer,
} from "./presentation-contract.js";
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
  template: EditorTemplateSource,
  bitmap: ImageBitmap | null | undefined,
  progress: number,
  result: FramePresentationMetadata = {},
): void {
  let transferred = false;
  try {
    ctx.hidePlaybackVideoCacheSurface?.();
    if (result.presented === true) {
      recordDirectPreviewPresentation(
        ctx,
        result.presentedAtMs,
        result.presentedAtEpochMs,
      );
      if (
        isPreviewInteractionActive(ctx) &&
        ctx.state.currentTemplate === template
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
    if (!bitmap)
      throw new Error(
        ctx.deps.t(
          "viewer.rendering.bitmapUnavailable",
          "Rendered frame is unavailable.",
        ),
      );
    if (shouldUseFastPreviewSurface(ctx, template, bitmap)) {
      transferred = drawFastPreviewFrame(ctx, bitmap);
      return;
    }
    if (isDirectFrame(template)) {
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
    } else {
      const buffer = ctx.createFrameBuffer(
        ctx.refs.canvas.width,
        ctx.refs.canvas.height,
      );
      const context = buffer.getContext("2d");
      if (!context) throw canvasContextUnavailable(ctx);
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
    }
    syncPreviewSurfaceVisibility(
      ctx.refs.fastPreviewCanvas,
      ctx.refs.directPreviewCanvas,
      "none",
      ctx.refs.canvas,
    );
  } finally {
    if (!transferred) bitmap?.close();
  }
}

function isDirectFrame(template: RenderSurfaceTemplate): boolean {
  const effect = template.effectV1;
  return (
    (effect !== null &&
      typeof effect === "object" &&
      "kind" in effect &&
      effect.kind === "targetEffect") ||
    template.kind === "sceneEffect" ||
    template.kind === "transitionEffect" ||
    template.kind === "composition"
  );
}
function canvasContextUnavailable(ctx: ViewerAppContext): Error {
  return new Error(
    ctx.deps.t(
      "viewer.rendering.canvasContextUnavailable",
      "Canvas 2D context is unavailable.",
    ),
  );
}

export function shouldUseDirectPreviewSurface(
  ctx: ViewerAppContext,
  template: RenderSurfaceTemplate,
  _renderPlan: { scale?: number },
): boolean {
  const directFrame = isDirectFrame(template);
  const directInteraction =
    ctx.state.canvasTransformDragActive ||
    (ctx.state.playing &&
      ctx.state.previewCacheEnabled === false &&
      isDirectLiveRenderPreferred(ctx, template));
  return Boolean(
    directFrame &&
    directInteraction &&
    !ctx.state.previewVideoCache?.recording &&
    ctx.state.directRenderEffectIds.has(template.effectId ?? "") &&
    ctx.state.directRenderResponsePort?.presentationSurfaceAttached,
  );
}

export function shouldUseFastPreviewSurface(
  ctx: ViewerAppContext,
  template: RenderSurfaceTemplate,
  bitmap: { height?: unknown; width?: unknown },
): boolean {
  const directFrame = isDirectFrame(template);
  const interactive = isPreviewInteractionActive(ctx);
  return Boolean(
    directFrame &&
    interactive &&
    typeof bitmap.width === "number" &&
    Number.isFinite(bitmap.width) &&
    bitmap.width > 0 &&
    typeof bitmap.height === "number" &&
    Number.isFinite(bitmap.height) &&
    bitmap.height > 0,
  );
}

function drawFastPreviewFrame(
  ctx: ViewerAppContext,
  bitmap: ImageBitmap,
): boolean {
  const canvas = ctx.refs.fastPreviewCanvas;
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
    return true;
  }
  const context = canvas.getContext("2d");
  if (!context) throw canvasContextUnavailable(ctx);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0);
  return false;
}

function isPreviewInteractionActive(ctx: ViewerAppContext): boolean {
  return ctx.state.playing || ctx.state.canvasTransformDragActive;
}

function showDirectPreviewFrame(
  ctx: ViewerAppContext,
  width: unknown,
  height: unknown,
) {
  const canvas = ctx.refs.directPreviewCanvas;
  syncDirectPreviewSurface(
    canvas,
    ctx.refs.fastPreviewCanvas,
    width,
    height,
    ctx.refs.canvas,
  );
}

function createFrameBuffer(width: number, height: number): ViewerFrameBuffer {
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
  durationMs: number,
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
    Number.isFinite(previewLatencyMs) ? previewLatencyMs : 0,
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

function setRenderStatus(
  ctx: ViewerAppContext,
  status: "rendering" | "applied" | "failed",
) {
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

export function createFramePresentationActions(
  getContext: () => ViewerAppContext,
): FramePresentationActions {
  return {
    drawCompletedFrame: bindViewerAction(drawCompletedFrame, getContext),
    shouldUseDirectPreviewSurface: bindViewerAction(
      shouldUseDirectPreviewSurface,
      getContext,
    ),
    createFrameBuffer,
    updateRenderStats: bindViewerAction(updateRenderStats, getContext),
    setRenderStatus: bindViewerAction(setRenderStatus, getContext),
  };
}
