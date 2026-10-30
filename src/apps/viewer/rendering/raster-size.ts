import type { ViewerAppContext } from "../app/context.js";
import {
  COMPOSITION_DESIGN_HEIGHT,
  COMPOSITION_DESIGN_WIDTH,
} from "../app/constants.js";

export function parseRasterSize(
  value: unknown,
  fallback: { height: number; width: number },
): { height: number; width: number } {
  const [rawWidth, rawHeight] = String(value ?? "").split("x");
  const width = Number(rawWidth);
  const height = Number(rawHeight);
  return Number.isFinite(width) &&
    width > 0 &&
    Number.isFinite(height) &&
    height > 0
    ? { height: Math.round(height), width: Math.round(width) }
    : fallback;
}

function getCompositionDesignSize(ctx: ViewerAppContext) {
  return {
    height: Math.max(
      1,
      Number(ctx.refs.canvas.height) || COMPOSITION_DESIGN_HEIGHT,
    ),
    width: Math.max(
      1,
      Number(ctx.refs.canvas.width) || COMPOSITION_DESIGN_WIDTH,
    ),
  };
}

function getPreviewRasterSize(ctx: ViewerAppContext) {
  const fallback = getCompositionDesignSize(ctx);
  return {
    height: Math.max(
      1,
      Number(ctx.state.previewRasterHeight) || fallback.height,
    ),
    width: Math.max(1, Number(ctx.state.previewRasterWidth) || fallback.width),
  };
}

function applyPreviewRasterSize(ctx: ViewerAppContext) {
  const rasterSize = parseRasterSize(
    ctx.refs.sizeSelect.value,
    getCompositionDesignSize(ctx),
  );
  ctx.state.previewRasterWidth = rasterSize.width;
  ctx.state.previewRasterHeight = rasterSize.height;
  ctx.state.interactivePreviewScale = 1;
  void ctx.invalidatePlaybackVideoCache?.();
  ctx.setPreviewZoom(ctx.state.previewZoom);
  ctx.updateCanvasSelectionBox();
}

export function installRenderingRasterSizeOwner(ctx: ViewerAppContext): void {
  ctx.getCompositionDesignSize = getCompositionDesignSize.bind(undefined, ctx);
  ctx.getPreviewRasterSize = getPreviewRasterSize.bind(undefined, ctx);
  ctx.applyPreviewRasterSize = applyPreviewRasterSize.bind(undefined, ctx);
}
