import type { ViewerAppContext } from "../app/context.js";
import type { EditorTemplateSource } from "../templates/model.js";
import type { FrameObservation } from "../../../shared/proof/frame-observation.js";
import { publishFrameObservation } from "./frame-observation.js";

export function clearCompletedTransformPreview(
  ctx: ViewerAppContext,
  forceFull: boolean,
): void {
  if (forceFull && ctx.state.canvasTransformPreview?.awaitingFullRender)
    ctx.state.canvasTransformPreview = null;
}

export function completeFramePresentation(
  ctx: ViewerAppContext,
  template: EditorTemplateSource,
  frame: Omit<
    FrameObservation,
    "version" | "bindings" | "assetBitmapTransfers" | "assetEnvelopeTransfers"
  >,
  forceFull: boolean,
  capturePlaybackBindings: boolean,
): void {
  ctx.syncPreviewQualityBadge(frame.scale);
  if (forceFull) ctx.state.interactivePreviewScale = 1;
  ctx.setRenderStatus("applied");
  publishFrameObservation(ctx, frame);
  if (
    ctx.state.activeSidebarGroup === "health" &&
    ctx.state.activeHealthTab === "renderer"
  )
    ctx.renderRendererBindingsPanel(template);
  if (ctx.state.playing && capturePlaybackBindings)
    ctx.scheduleCanvasSelectionPlaybackUpdate();
  else if (!ctx.state.playing) ctx.updateCanvasSelectionBox();
}
