import { bindViewerAction } from "../app/bind-action.js";
import type { CanvasPathActions } from "./path-contract.js";
import type { ViewerAppContext } from "../app/context.js";
import { createCanvasDragPreview } from "./drag-preview.js";
import { prepareCanvasGesture } from "./gesture.js";

function beginEditablePathPointDrag(
  ctx: ViewerAppContext,
  event: PointerEvent,
  layerId: string,
  pointIndex: number,
) {
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layer = effectiveTemplate?.layers.find((item) => item.id === layerId);
  if (!template || !layer || layer.locked || layer.type !== "path") {
    return;
  }
  prepareCanvasGesture(ctx);
  const points = ctx.getEditablePathPoints(layer);
  const original = points[pointIndex];
  if (!original) {
    return;
  }
  const box = ctx.getLayerCanvasBox(layerId, layer);
  if (!box) return;
  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const preview = createCanvasDragPreview(ctx);
  let latest = original;
  const onMove = (moveEvent: MouseEvent) => {
    if (!preview.isCurrent()) return;
    const pageDx = moveEvent.clientX - startX;
    const pageDy = moveEvent.clientY - startY;
    if (
      !preview.activate(Math.abs(pageDx) + Math.abs(pageDy), () =>
        ctx.beginEditorCommand({
          payload: { layerId, pointIndex },
          type: "updatePathPoint",
        }),
      )
    ) {
      return;
    }
    const dx = (pageDx / Math.max(1, canvasRect.width)) * ctx.refs.canvas.width;
    const dy =
      (pageDy / Math.max(1, canvasRect.height)) * ctx.refs.canvas.height;
    latest = {
      x: ctx.deps.clamp(original.x + dx / Math.max(1, box.width), -1.5, 1.5),
      y: ctx.deps.clamp(original.y + dy / Math.max(1, box.height), -1.5, 1.5),
    };
    preview.scheduleUpdate(() => {
      ctx.updatePathPoint(layerId, pointIndex, latest, {
        motionPath: false,
        render: false,
        timeline: false,
      });
    });
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () => {
    if (!preview.isCurrent()) {
      preview.finalize();
      return;
    }
    if (ctx.state.dragMoved) {
      preview.finalize(() => {
        ctx.updatePathPoint(layerId, pointIndex, latest, { render: false });
      });
      void ctx.settlePreviewAfterInteraction();
    } else {
      preview.finalize();
      ctx.updateCanvasSelectionBox();
    }
  });
}

export function createCanvasEditablePathPointDragActions(
  getContext: () => ViewerAppContext,
): Pick<CanvasPathActions, "beginEditablePathPointDrag"> {
  return {
    beginEditablePathPointDrag: bindViewerAction(
      beginEditablePathPointDrag,
      getContext,
    ),
  };
}
