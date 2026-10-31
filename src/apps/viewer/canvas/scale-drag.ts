import { bindViewerAction } from "../app/bind-action.js";
import type { CanvasTransformActions } from "./transform-contract.js";
import type { CanvasPoint } from "./geometry-contract.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  resolveLayerCanvasResizeProperty,
  type LayerEditorCapabilities,
} from "../layers/editor-capabilities.js";
import { createCanvasDragPreview } from "./drag-preview.js";
import { prepareCanvasGesture } from "./gesture.js";
import { resolveCanvasResizeEdit } from "./resize-edit.js";
import { calculateCanvasResize } from "./transform-math.js";

function beginCanvasScaleDrag(
  ctx: ViewerAppContext,
  event: PointerEvent,
  handle: string,
) {
  if (ctx.refs.canvasSelectionBox.dataset.selectionKind === "multi") {
    return ctx.beginCanvasSelectionScaleDrag(event, handle);
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layerId = ctx.refs.canvasSelectionBox.dataset.layerId;
  if (!layerId) return;
  const layer = effectiveTemplate?.layers.find((item) => item.id === layerId);
  const capabilities = layer ? ctx.getLayerEditorCapabilities(layer) : null;
  if (
    !template ||
    !layer ||
    layer.locked ||
    !ctx.isLayerCanvasSelectable(layer) ||
    !canResizeHandle(capabilities, handle)
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
  const authorBox = ctx.getLayerAuthorCanvasBox(layerId, layer, resolution);
  if (!box || !authorBox) {
    return;
  }
  const anchor = ctx.getResolvedLayerAnchor(layer, resolution);
  const rotation = Number(box.rotation) || 0;
  const startX = event.clientX;
  const startY = event.clientY;
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
  let latestTransform = { ...original };
  let latestEdit: Record<string, number> = {};
  const onMove = (moveEvent: MouseEvent) => {
    const pageDx = moveEvent.clientX - startX;
    const pageDy = moveEvent.clientY - startY;
    const delta = {
      x: (pageDx / Math.max(1, canvasRect.width)) * ctx.refs.canvas.width,
      y: (pageDy / Math.max(1, canvasRect.height)) * ctx.refs.canvas.height,
    };
    latestTransform = calculateCanvasResize({
      anchor,
      box,
      delta,
      handle,
      lockAspect: moveEvent.shiftKey,
      original,
      rotation,
    });
    latestEdit = resolveCanvasResizeEdit({
      anchor,
      authorBox,
      box,
      capabilities,
      handle,
      layer,
      next: latestTransform,
      original,
      rotation,
    });
    if (
      !preview.activate(Math.abs(pageDx) + Math.abs(pageDy), () =>
        ctx.beginEditorCommand({
          payload: {
            handle,
            layerId,
            properties: Object.keys(latestEdit),
          },
          type: "updateLayerProperty",
        }),
      )
    ) {
      return;
    }
    preview.scheduleUpdate(() => {
      preview.updateTransform(latestTransform);
      ctx.updateLayerPropertiesAtTime(layerId, time, latestEdit, {
        keyframe: true,
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
        ctx.updateLayerPropertiesAtTime(layerId, time, latestEdit, {
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

function resizeSelectedCanvasLayer(
  ctx: ViewerAppContext,
  handle: string,
  delta: CanvasPoint,
  lockAspect = false,
) {
  if (ctx.refs.canvasSelectionBox.dataset.selectionKind === "multi") {
    return false;
  }
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layerId = ctx.refs.canvasSelectionBox.dataset.layerId;
  if (!layerId) return false;
  const layer = effectiveTemplate?.layers.find((item) => item.id === layerId);
  const capabilities = layer ? ctx.getLayerEditorCapabilities(layer) : null;
  if (
    !template ||
    !layer ||
    layer.locked ||
    !ctx.isLayerCanvasSelectable(layer) ||
    !canResizeHandle(capabilities, handle)
  ) {
    return false;
  }
  const time = prepareCanvasGesture(ctx);
  const resolution = {
    time,
    timeline: ctx.getEffectiveTimeline(template),
  };
  const box = ctx.getLayerCanvasBox(layerId, layer, resolution);
  const authorBox = ctx.getLayerAuthorCanvasBox(layerId, layer, resolution);
  if (!box || !authorBox) {
    return false;
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
  const anchor = ctx.getResolvedLayerAnchor(layer, resolution);
  const rotation = Number(box.rotation) || 0;
  const next = calculateCanvasResize({
    anchor,
    box,
    delta,
    handle,
    lockAspect,
    original,
    rotation,
  });
  const edit = resolveCanvasResizeEdit({
    anchor,
    authorBox,
    box,
    capabilities,
    handle,
    layer,
    next,
    original,
    rotation,
  });
  ctx.beginEditorCommand(
    {
      payload: {
        handle,
        layerId,
        properties: Object.keys(edit),
      },
      type: "updateLayerProperty",
    },
    {
      coalesceKey: `keyboard-resize:${layerId}:${handle}`,
    },
  );
  ctx.updateLayerPropertiesAtTime(layerId, time, edit, { keyframe: true });
  return true;
}

function canResizeHandle(
  capabilities: LayerEditorCapabilities | null,
  handle: string,
): capabilities is LayerEditorCapabilities {
  if (!capabilities) {
    return false;
  }
  return (
    (!/e|w/.test(handle) ||
      resolveLayerCanvasResizeProperty(capabilities, "x") !== null) &&
    (!/n|s/.test(handle) ||
      resolveLayerCanvasResizeProperty(capabilities, "y") !== null)
  );
}

export function createCanvasScaleDragActions(
  getContext: () => ViewerAppContext,
): Pick<
  CanvasTransformActions,
  "beginCanvasScaleDrag" | "resizeSelectedCanvasLayer"
> {
  return {
    beginCanvasScaleDrag: bindViewerAction(beginCanvasScaleDrag, getContext),
    resizeSelectedCanvasLayer: bindViewerAction(
      resizeSelectedCanvasLayer,
      getContext,
    ),
  };
}
