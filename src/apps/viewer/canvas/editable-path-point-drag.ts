import type { ViewerAppContext } from "../app/context.js";
import { activateCanvasDrag, createCanvasDragPreview } from "./drag-preview.js";
import { prepareCanvasGesture } from "./gesture.js";

function beginEditablePathPointDrag(
  ctx: ViewerAppContext,
  event,
  layerId,
  pointIndex,
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
  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const preview = createCanvasDragPreview(ctx);
  let latest = original;
  const onMove = (moveEvent) => {
    const pageDx = moveEvent.clientX - startX;
    const pageDy = moveEvent.clientY - startY;
    if (
      !activateCanvasDrag(ctx, Math.abs(pageDx) + Math.abs(pageDy), () =>
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

export function installCanvasEditablePathPointDragOwner(
  ctx: ViewerAppContext,
): void {
  ctx.beginEditablePathPointDrag = (...args: any[]) =>
    (beginEditablePathPointDrag as any)(ctx, ...args);
}
