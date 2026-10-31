import { createGraphViewportPreview } from "./viewport-preview.js";
import { bindViewerAction } from "../app/bind-action.js";
import type { GraphRuntimeActions } from "./contract.js";
import type { GraphEditorModel } from "./model-types.js";
import {
  readGraphPointerTarget,
  getGraphPointer,
} from "./pointer-coordinates.js";
import type { ViewerAppContext } from "../app/context.js";
import { graphXToTime, graphYToValue } from "./viewport.js";
import { clampGraphTimeViewport } from "./interaction-shared.js";

function handleGraphEditorWheel(
  ctx: ViewerAppContext,
  event: WheelEvent,
  model: GraphEditorModel,
): void {
  if (ctx.state.currentTemplate !== model.template) return;
  const surface = readGraphPointerTarget(event);
  if (!surface) return;
  event.preventDefault();
  event.stopPropagation();
  const point = getGraphPointer(surface.svg, event);
  if (!point) return;
  const timeAnchor = graphXToTime(point.x, model.viewport);
  const valueAnchor = graphYToValue(point.y, model.viewport);
  if (event.shiftKey) {
    const span = model.viewport.timeEnd - model.viewport.timeStart;
    const delta = (event.deltaY / 800) * span;
    const viewport = {
      ...model.viewport,
      timeEnd: model.viewport.timeEnd + delta,
      timeStart: model.viewport.timeStart + delta,
    };
    clampGraphTimeViewport(viewport, ctx.getEffectiveDuration(model.template));
    ctx.setGraphEditorViewport(viewport);
    return;
  }
  void ctx.zoomGraphEditor(Math.exp(event.deltaY * 0.0012), {
    timeAnchor,
    valueAnchor,
    zoomTime: !event.altKey,
    zoomValue: !event.ctrlKey && !event.metaKey,
  });
}

function beginGraphEditorPan(
  ctx: ViewerAppContext,
  event: PointerEvent,
  model: GraphEditorModel,
) {
  if (ctx.state.currentTemplate !== model.template) return;
  if (
    event.button !== 0 ||
    !(event.target instanceof Element) ||
    event.target.closest(
      ".graph-keyframe-point, .graph-bezier-handle, .graph-selection-range-handle",
    )
  ) {
    return;
  }
  const surface = readGraphPointerTarget(event);
  if (!surface) return;
  event.preventDefault();
  const start = { x: event.clientX, y: event.clientY };
  const rect = surface.svg.getBoundingClientRect();
  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return;
  const original = { ...model.viewport };
  const preview = createGraphViewportPreview(ctx, model.template);
  const onMove = (moveEvent: PointerEvent) => {
    const dx = moveEvent.clientX - start.x;
    const dy = moveEvent.clientY - start.y;
    if (!ctx.state.dragMoved && Math.abs(dx) + Math.abs(dy) <= 2) {
      return;
    }
    ctx.state.dragMoved = true;
    const timeSpan = original.timeEnd - original.timeStart;
    const valueSpan = original.valueMax - original.valueMin;
    const pending = {
      ...original,
      timeEnd: original.timeEnd + (-dx / Math.max(1, rect.width)) * timeSpan,
      timeStart:
        original.timeStart + (-dx / Math.max(1, rect.width)) * timeSpan,
      valueMax: original.valueMax + (dy / Math.max(1, rect.height)) * valueSpan,
      valueMin: original.valueMin + (dy / Math.max(1, rect.height)) * valueSpan,
    };
    clampGraphTimeViewport(pending, ctx.getEffectiveDuration(model.template));
    preview.schedule(pending);
  };
  ctx.bindPointerDrag(event.pointerId, surface.target, onMove, () =>
    preview.finalize(),
  );
}

export function createGraphPanZoomActions(
  getContext: () => ViewerAppContext,
): Pick<GraphRuntimeActions, "handleGraphEditorWheel" | "beginGraphEditorPan"> {
  return {
    handleGraphEditorWheel: bindViewerAction(
      handleGraphEditorWheel,
      getContext,
    ),
    beginGraphEditorPan: bindViewerAction(beginGraphEditorPan, getContext),
  };
}
