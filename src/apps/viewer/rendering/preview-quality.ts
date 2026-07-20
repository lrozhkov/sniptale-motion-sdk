import type { ViewerAppContext } from "../app/context.js";
import { syncPreviewQualityBadge } from "./preview-quality-badge.js";

const CONTRACT_SAMPLE_LONG_EDGE = 160;

export function calculateScaledRenderSize(width, height, scale) {
  const scaledWidth = Math.min(
    width,
    Math.max(160, Math.round((width * scale) / 2) * 2),
  );
  const scaledHeight = Math.min(
    height,
    Math.max(90, Math.round((height * scale) / 2) * 2),
  );
  return {
    height: scaledHeight,
    scale: Math.min(scaledWidth / width, scaledHeight / height),
    width: scaledWidth,
  };
}

function getPreviewRenderPlan(_ctx: ViewerAppContext, width, height) {
  return {
    height,
    renderQuality: "full" as const,
    scale: 1,
    width,
  };
}

async function refinePreviewAtFullQuality(ctx: ViewerAppContext) {
  if (ctx.state.playing || ctx.state.appliedPreviewScale >= 0.999) {
    if (ctx.state.canvasTransformPreview?.awaitingFullRender) {
      ctx.state.canvasTransformPreview = null;
      ctx.updateCanvasSelectionBox();
    }
    return false;
  }
  await ctx.renderCurrentFrame({ forceFull: true });
  return true;
}

async function settlePreviewAfterInteraction(ctx: ViewerAppContext) {
  await ctx.renderCurrentFrame({ forceFull: true, interactive: true });
  return true;
}

function getContractRenderSize(ctx: ViewerAppContext, width, height) {
  const scale = Math.min(
    1,
    CONTRACT_SAMPLE_LONG_EDGE / Math.max(width, height),
  );
  return calculateScaledRenderSize(width, height, scale);
}

function normalizePreviewBindingReads(ctx: ViewerAppContext, reads) {
  return ctx.deps.normalizeBindingReads(reads);
}

export function installRenderingPreviewQualityOwner(
  ctx: ViewerAppContext,
): void {
  ctx.getPreviewRenderPlan = (...args: any[]) =>
    (getPreviewRenderPlan as any)(ctx, ...args);
  ctx.getContractRenderSize = (...args: any[]) =>
    (getContractRenderSize as any)(ctx, ...args);
  ctx.normalizePreviewBindingReads = (...args: any[]) =>
    (normalizePreviewBindingReads as any)(ctx, ...args);
  ctx.syncPreviewQualityBadge = (...args: any[]) =>
    (syncPreviewQualityBadge as any)(ctx, ...args);
  ctx.refinePreviewAtFullQuality = (...args: any[]) =>
    (refinePreviewAtFullQuality as any)(ctx, ...args);
  ctx.settlePreviewAfterInteraction = (...args: any[]) =>
    (settlePreviewAfterInteraction as any)(ctx, ...args);
}
