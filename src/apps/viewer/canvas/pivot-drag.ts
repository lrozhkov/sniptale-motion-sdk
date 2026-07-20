import type { ViewerAppContext } from "../app/context.js";
import { activateCanvasDrag, createCanvasDragPreview } from "./drag-preview.js";
import { prepareCanvasGesture } from "./gesture.js";
import {
  calculateCanvasAnchorMove,
  normalizeCanvasAngleDelta,
} from "./transform-math.js";

function beginCanvasRotationDrag(ctx: ViewerAppContext, event) {
  if (ctx.refs.canvasSelectionBox.dataset.selectionKind === "multi") {
    return ctx.beginCanvasSelectionRotationDrag(event);
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layerId = ctx.refs.canvasSelectionBox.dataset.layerId;
  const layer = effectiveTemplate?.layers.find((item) => item.id === layerId);
  if (
    !template ||
    !layer ||
    layer.locked ||
    !ctx.isLayerCanvasSelectable(layer) ||
    !ctx.canTransformLayerProperty(layer, "rotation")
  ) {
    return;
  }
  const time = prepareCanvasGesture(ctx);
  const resolution = {
    time,
    timeline: ctx.getEffectiveTimeline(template),
  };
  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const box = ctx.getLayerCanvasBox(layerId, layer, resolution);
  if (!box) {
    return;
  }
  const canvasPivot = ctx.getLayerCanvasPivot(box, layer);
  const pivot = {
    x:
      canvasRect.left +
      canvasPivot.x * (canvasRect.width / ctx.refs.canvas.width),
    y:
      canvasRect.top +
      canvasPivot.y * (canvasRect.height / ctx.refs.canvas.height),
  };
  const startAngle = Math.atan2(
    event.clientY - pivot.y,
    event.clientX - pivot.x,
  );
  const originalRotation = ctx.getResolvedLayerProperty(
    layer,
    "rotation",
    resolution,
  );
  const preview = createCanvasDragPreview(ctx, { box, layer, layerId });
  let latestRotation = originalRotation;
  const onMove = (moveEvent) => {
    const angle = Math.atan2(
      moveEvent.clientY - pivot.y,
      moveEvent.clientX - pivot.x,
    );
    const delta = normalizeCanvasAngleDelta(
      ((angle - startAngle) * 180) / Math.PI,
    );
    if (
      !activateCanvasDrag(
        ctx,
        Math.abs(delta),
        () =>
          ctx.beginEditorCommand({
            payload: { layerId, properties: ["rotation"] },
            type: "updateLayerProperty",
          }),
        0.5,
      )
    ) {
      return;
    }
    const rawRotation = originalRotation + delta;
    const nextRotation = ctx.deps.clamp(
      moveEvent.shiftKey ? Math.round(rawRotation / 15) * 15 : rawRotation,
      -360,
      360,
    );
    latestRotation = nextRotation;
    preview.scheduleUpdate(() => {
      preview.updateTransform({ rotation: latestRotation });
      ctx.updateLayerPropertyAtTime(layerId, "rotation", time, latestRotation, {
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
        ctx.updateLayerPropertyAtTime(
          layerId,
          "rotation",
          time,
          latestRotation,
          {
            keyframe: true,
            render: false,
          },
        );
      });
      void ctx.settlePreviewAfterInteraction();
    } else {
      preview.finalize();
      ctx.updateCanvasSelectionBox();
    }
  });
}

function beginCanvasAnchorDrag(ctx: ViewerAppContext, event) {
  if (ctx.refs.canvasSelectionBox.dataset.selectionKind === "multi") {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layerId = ctx.refs.canvasSelectionBox.dataset.layerId;
  const layer = effectiveTemplate?.layers.find((item) => item.id === layerId);
  if (
    !template ||
    !layer ||
    layer.locked ||
    !ctx.isLayerCanvasSelectable(layer) ||
    !ctx.canTransformLayerProperty(layer, "anchorX") ||
    !ctx.canTransformLayerProperty(layer, "anchorY")
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
  const anchor = ctx.getResolvedLayerAnchor(layer, resolution);
  const box = ctx.getLayerCanvasBox(layerId, layer, resolution);
  if (!box) {
    return;
  }
  const original = {
    scaleX: Math.max(
      0.05,
      ctx.getResolvedLayerProperty(layer, "scaleX", resolution),
    ),
    scaleY: Math.max(
      0.05,
      ctx.getResolvedLayerProperty(layer, "scaleY", resolution),
    ),
    x: ctx.getResolvedLayerProperty(layer, "x", resolution),
    y: ctx.getResolvedLayerProperty(layer, "y", resolution),
  };
  const preview = createCanvasDragPreview(ctx, { box, layer, layerId });
  let latest = {
    anchorX: anchor.x,
    anchorY: anchor.y,
    x: original.x,
    y: original.y,
  };
  const onMove = (moveEvent) => {
    const pageDx = moveEvent.clientX - startX;
    const pageDy = moveEvent.clientY - startY;
    if (
      !activateCanvasDrag(ctx, Math.abs(pageDx) + Math.abs(pageDy), () =>
        ctx.beginEditorCommand({
          payload: {
            layerId,
            properties: ["x", "y", "anchorX", "anchorY"],
          },
          type: "updateLayerProperty",
        }),
      )
    ) {
      return;
    }
    const delta = {
      x: (pageDx / Math.max(1, canvasRect.width)) * ctx.refs.canvas.width,
      y: (pageDy / Math.max(1, canvasRect.height)) * ctx.refs.canvas.height,
    };
    latest = calculateCanvasAnchorMove({
      anchor,
      box,
      delta,
      original,
      rotation: Number(box.rotation) || 0,
    });
    preview.scheduleUpdate(() => {
      preview.updateTransform(latest);
      ctx.updateLayerPropertiesAtTime(layerId, time, latest, {
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
        ctx.updateLayerPropertiesAtTime(layerId, time, latest, {
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

export function installCanvasPivotDragOwner(ctx: ViewerAppContext): void {
  ctx.beginCanvasRotationDrag = (...args: any[]) =>
    (beginCanvasRotationDrag as any)(ctx, ...args);
  ctx.beginCanvasAnchorDrag = (...args: any[]) =>
    (beginCanvasAnchorDrag as any)(ctx, ...args);
}
