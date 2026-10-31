import { bindViewerAction } from "../app/bind-action.js";
import type { ViewerRenderOutputActions } from "./output-contract.js";
import type { ViewerAppContext } from "../app/context.js";
import { syncPreviewQualityBadge } from "./preview-quality-badge.js";

const CONTRACT_SAMPLE_LONG_EDGE = 160;

export function calculateScaledRenderSize(
  width: unknown,
  height: unknown,
  scale: unknown,
) {
  if (
    typeof width !== "number" ||
    !Number.isFinite(width) ||
    width <= 0 ||
    typeof height !== "number" ||
    !Number.isFinite(height) ||
    height <= 0 ||
    typeof scale !== "number" ||
    !Number.isFinite(scale) ||
    scale <= 0
  ) {
    throw new RangeError(
      "Render dimensions and scale must be positive finite numbers.",
    );
  }
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

function getPreviewRenderPlan(width: number, height: number) {
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

function getContractRenderSize(width: number, height: number) {
  const scale = Math.min(
    1,
    CONTRACT_SAMPLE_LONG_EDGE / Math.max(width, height),
  );
  return calculateScaledRenderSize(width, height, scale);
}

function normalizePreviewBindingReads(ctx: ViewerAppContext, reads: unknown) {
  return ctx.deps.normalizeBindingReads(reads);
}

export function createPreviewQualityActions(
  getContext: () => ViewerAppContext,
): Pick<
  ViewerRenderOutputActions,
  | "getPreviewRenderPlan"
  | "getContractRenderSize"
  | "normalizePreviewBindingReads"
  | "syncPreviewQualityBadge"
  | "refinePreviewAtFullQuality"
  | "settlePreviewAfterInteraction"
> {
  return {
    getPreviewRenderPlan,
    getContractRenderSize,
    normalizePreviewBindingReads: bindViewerAction(
      normalizePreviewBindingReads,
      getContext,
    ),
    syncPreviewQualityBadge: bindViewerAction(
      syncPreviewQualityBadge,
      getContext,
    ),
    refinePreviewAtFullQuality: bindViewerAction(
      refinePreviewAtFullQuality,
      getContext,
    ),
    settlePreviewAfterInteraction: bindViewerAction(
      settlePreviewAfterInteraction,
      getContext,
    ),
  };
}
