import type { ViewerAppContext } from "../app/context.js";
import {
  graphXToTime,
  graphYToValue,
  type GraphEditorViewport,
} from "./model.js";
import {
  clampGraphTimeViewport,
  getGraphPointer,
} from "./interaction-shared.js";

function handleGraphEditorWheel(ctx: ViewerAppContext, event, model): void {
  event.preventDefault();
  event.stopPropagation();
  const point = getGraphPointer(event.currentTarget, event);
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
  ctx.zoomGraphEditor(Math.exp(event.deltaY * 0.0012), {
    timeAnchor,
    valueAnchor,
    zoomTime: !event.altKey,
    zoomValue: !event.ctrlKey && !event.metaKey,
  });
}

function beginGraphEditorPan(ctx: ViewerAppContext, event, model) {
  if (
    event.button !== 0 ||
    event.target.closest(
      ".graph-keyframe-point, .graph-bezier-handle, .graph-selection-range-handle",
    )
  ) {
    return;
  }
  event.preventDefault();
  const start = { x: event.clientX, y: event.clientY };
  const rect = event.currentTarget.getBoundingClientRect();
  const original = { ...model.viewport };
  let frame = 0;
  let pending: GraphEditorViewport | null = null;
  const onMove = (moveEvent) => {
    const dx = moveEvent.clientX - start.x;
    const dy = moveEvent.clientY - start.y;
    if (!ctx.state.dragMoved && Math.abs(dx) + Math.abs(dy) <= 2) {
      return;
    }
    ctx.state.dragMoved = true;
    const timeSpan = original.timeEnd - original.timeStart;
    const valueSpan = original.valueMax - original.valueMin;
    pending = {
      ...original,
      timeEnd: original.timeEnd + (-dx / Math.max(1, rect.width)) * timeSpan,
      timeStart:
        original.timeStart + (-dx / Math.max(1, rect.width)) * timeSpan,
      valueMax: original.valueMax + (dy / Math.max(1, rect.height)) * valueSpan,
      valueMin: original.valueMin + (dy / Math.max(1, rect.height)) * valueSpan,
    };
    clampGraphTimeViewport(pending, ctx.getEffectiveDuration(model.template));
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (pending) {
          ctx.setGraphEditorViewport(pending);
        }
      });
    }
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () => {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (pending) {
      ctx.setGraphEditorViewport(pending);
    }
  });
}

export function installGraphEditorPanZoomOwner(ctx: ViewerAppContext): void {
  ctx.handleGraphEditorWheel = handleGraphEditorWheel.bind(undefined, ctx);
  ctx.beginGraphEditorPan = beginGraphEditorPan.bind(undefined, ctx);
}
