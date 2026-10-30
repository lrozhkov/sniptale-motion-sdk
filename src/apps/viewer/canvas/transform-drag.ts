import type { ViewerAppContext } from "../app/context.js";
import { activateCanvasDrag, createCanvasDragPreview } from "./drag-preview.js";
import { prepareCanvasGesture } from "./gesture.js";

function beginCanvasLayerDrag(
  ctx: ViewerAppContext,
  event,
  explicitLayerId = null,
) {
  if (
    explicitLayerId === null &&
    ctx.refs.canvasSelectionBox.dataset.selectionKind === "multi"
  ) {
    return ctx.beginCanvasSelectionDrag(event);
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layerId =
    explicitLayerId ?? ctx.refs.canvasSelectionBox.dataset.layerId;
  const layer = effectiveTemplate?.layers.find((item) => item.id === layerId);
  if (
    !template ||
    !layer ||
    !ctx.isLayerActiveAtTime(
      effectiveTemplate,
      layer.id,
      Number(ctx.refs.timeSlider.value) || 0,
    ) ||
    layer.locked ||
    !ctx.isLayerCanvasSelectable(layer) ||
    !ctx.canTransformLayerProperty(layer, "x") ||
    !ctx.canTransformLayerProperty(layer, "y")
  ) {
    return;
  }
  const time = prepareCanvasGesture(ctx);
  const resolution = {
    time,
    timeline: ctx.getEffectiveTimeline(template),
  };
  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  const original = {
    x: ctx.getResolvedLayerProperty(layer, "x", resolution),
    y: ctx.getResolvedLayerProperty(layer, "y", resolution),
  };
  const box = ctx.getLayerCanvasBox(layerId, layer, resolution);
  if (!box) {
    return;
  }
  ctx.state.canvasSnapStatus = null;
  const snapSession = ctx.createCanvasGuideSnapSession(
    layerId,
    layer,
    original,
  );
  const preview = createCanvasDragPreview(ctx, { box, layer, layerId });
  let latest = { ...original };
  const onMove = (moveEvent) => {
    const pageDx = moveEvent.clientX - startX;
    const pageDy = moveEvent.clientY - startY;
    if (
      !activateCanvasDrag(ctx, Math.abs(pageDx) + Math.abs(pageDy), () =>
        ctx.beginEditorCommand({
          payload: { layerId, properties: ["x", "y"] },
          type: "updateLayerProperty",
        }),
      )
    ) {
      return;
    }
    const dx = (pageDx / Math.max(1, canvasRect.width)) * ctx.refs.canvas.width;
    const dy =
      (pageDy / Math.max(1, canvasRect.height)) * ctx.refs.canvas.height;
    const position = ctx.applyCanvasGuideSnap(
      snapSession,
      original.x + dx,
      original.y + dy,
    );
    ctx.state.canvasSnapStatus = position.snap.length
      ? position.snap.join(" · ")
      : null;
    latest = { x: position.x, y: position.y };
    preview.scheduleUpdate(() => {
      preview.updateTransform(latest);
      ctx.updateLayerPositionAtTime(layerId, time, latest.x, latest.y, {
        keyframe: true,
        motionPath: false,
        render: false,
        timeline: false,
      });
    });
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () => {
    if (ctx.state.dragMoved) {
      preview.finalize(() => {
        ctx.updateLayerPositionAtTime(layerId, time, latest.x, latest.y, {
          keyframe: true,
          render: false,
        });
      });
      void ctx.settlePreviewAfterInteraction();
    } else {
      preview.finalize();
      ctx.updateCanvasSelectionBox();
    }
  });
}

export function installCanvasTransformDragOwner(ctx: ViewerAppContext): void {
  ctx.beginCanvasLayerDrag = beginCanvasLayerDrag.bind(undefined, ctx);
}
