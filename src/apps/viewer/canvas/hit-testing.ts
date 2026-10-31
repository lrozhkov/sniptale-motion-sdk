import type { EffectLayer } from "../../../sdk/types.js";
import type { CanvasPoint } from "./geometry-contract.js";
import type { CanvasLayerHit } from "./selection-contract.js";
import { bindViewerAction } from "../app/bind-action.js";
import type { CanvasSelectionActions } from "./selection-contract.js";
import type { ViewerAppContext } from "../app/context.js";

function getCanvasPointFromEvent(
  ctx: ViewerAppContext,
  event: Pick<MouseEvent, "clientX" | "clientY">,
) {
  const rect = ctx.refs.canvas.getBoundingClientRect();
  return {
    x:
      ((event.clientX - rect.left) / Math.max(1, rect.width)) *
      ctx.refs.canvas.width,
    y:
      ((event.clientY - rect.top) / Math.max(1, rect.height)) *
      ctx.refs.canvas.height,
  };
}

function beginCanvasHitTestPointerDown(
  ctx: ViewerAppContext,
  event: PointerEvent,
) {
  if (event.button !== 0 || event.defaultPrevented) {
    return;
  }
  const editablePathPoint = ctx.findEditablePathPointNearEvent(event);
  if (editablePathPoint) {
    ctx.beginEditablePathPointDrag(
      event,
      editablePathPoint.layerId,
      editablePathPoint.pointIndex,
    );
    return;
  }
  const pathPoint = ctx.findMotionPathPointNearEvent(event);
  if (pathPoint) {
    ctx.beginMotionPathPointDrag(
      event,
      pathPoint.layerId,
      pathPoint.xKeyframeId,
      pathPoint.yKeyframeId,
    );
    return;
  }
  const hit = ctx.findTopCanvasLayerAtEvent(event);
  if (!hit) {
    ctx.beginCanvasMarqueeSelection(event);
    return;
  }
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const selectionId = ctx.resolveCanvasHitSelectionLayerId(
    hit.layer.id,
    template,
  );
  if (!selectionId) {
    ctx.beginCanvasMarqueeSelection(event);
    return;
  }
  const hasModifier = event.shiftKey || event.metaKey || event.ctrlKey;
  const alreadySelected = ctx.state.selectedLayers.includes(selectionId);
  if (!hasModifier && alreadySelected && ctx.state.selectedLayers.length > 1) {
    ctx.selectCanvasLayers(ctx.state.selectedLayers, selectionId);
  } else {
    ctx.selectLayer(selectionId, event);
  }
  ctx.setInspectorTab("transform");
  if (!ctx.state.selectedLayers.includes(selectionId)) {
    return;
  }
  const target = ctx.getCanvasSelectionTarget(template);
  if (target?.kind === "selection") {
    ctx.beginCanvasSelectionDrag(event);
  } else {
    ctx.beginCanvasLayerDrag(event, hit.layer.id);
  }
}

function handleCanvasDoubleClick(ctx: ViewerAppContext, event: MouseEvent) {
  const hit = ctx.findTopCanvasLayerAtEvent(event);
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const selectionId =
    hit && template
      ? ctx.resolveCanvasHitSelectionLayerId(hit.layer.id, template)
      : null;
  const hierarchy = template ? ctx.getLayerHierarchy(template) : null;
  const selected = selectionId ? hierarchy?.byId.get(selectionId) : null;
  if (!hit || selected?.type !== "group") {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  ctx.enterCanvasGroup(selected.id, hit.layer.id);
}

function findTopCanvasLayerAtEvent(ctx: ViewerAppContext, event: MouseEvent) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return null;
  }
  const point = ctx.getCanvasPointFromEvent(event);
  const time = Number(ctx.refs.timeSlider.value) || 0;
  let fullFrameHit: CanvasLayerHit | null = null;
  for (const layer of [...(template.layers ?? [])].reverse()) {
    if (
      layer.visible === false ||
      !ctx.isLayerCanvasSelectable(layer) ||
      !ctx.isLayerActiveAtTime(template, layer.id, time)
    ) {
      continue;
    }
    if (ctx.isCanvasPointInsideLayer(point, layer)) {
      if (isFullCanvasLayer(ctx, layer)) {
        fullFrameHit ??= { layer, point };
        continue;
      }
      return { layer, point };
    }
  }
  return fullFrameHit;
}

function isFullCanvasLayer(ctx: ViewerAppContext, layer: EffectLayer) {
  if (ctx.getLayerEditorCapabilities(layer).canvas === "fullFrame") {
    return true;
  }
  const box = ctx.getLayerCanvasHitBox(layer.id, layer);
  return Boolean(
    box &&
    box.width >= ctx.refs.canvas.width * 0.9 &&
    box.height >= ctx.refs.canvas.height * 0.9,
  );
}

export function isCanvasPointInsideLayer(
  ctx: ViewerAppContext,
  point: CanvasPoint,
  layer: EffectLayer,
) {
  const box = ctx.getLayerCanvasHitBox(layer.id, layer);
  if (!box) {
    return false;
  }
  const pivot = ctx.getLayerCanvasPivot(box, layer);
  const angle = -((Number(box.rotation) || 0) * Math.PI) / 180;
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  const localX = pivot.x + dx * Math.cos(angle) - dy * Math.sin(angle);
  const localY = pivot.y + dx * Math.sin(angle) + dy * Math.cos(angle);
  return (
    localX >= box.x &&
    localX <= box.x + box.width &&
    localY >= box.y &&
    localY <= box.y + box.height
  );
}

function beginCanvasSelectionPointerDown(
  ctx: ViewerAppContext,
  event: PointerEvent,
) {
  if (ctx.refs.canvasSelectionBox.dataset.inactive === "true") {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (ctx.isCanvasTransformHandleEvent(event)) {
    return;
  }
  if (ctx.refs.canvasSelectionBox.dataset.selectionKind === "multi") {
    ctx.setInspectorTab("transform");
    ctx.beginCanvasSelectionDrag(event);
    return;
  }
  const editablePathPoint = ctx.findEditablePathPointNearEvent(event);
  if (editablePathPoint) {
    ctx.beginEditablePathPointDrag(
      event,
      editablePathPoint.layerId,
      editablePathPoint.pointIndex,
    );
    return;
  }
  const pathPoint = ctx.findMotionPathPointNearEvent(event);
  if (pathPoint) {
    ctx.beginMotionPathPointDrag(
      event,
      pathPoint.layerId,
      pathPoint.xKeyframeId,
      pathPoint.yKeyframeId,
    );
    return;
  }
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const layer = template?.layers.find(
    (item) => item.id === ctx.refs.canvasSelectionBox.dataset.layerId,
  );
  if (
    !layer ||
    !ctx.canTransformLayerProperty(layer, "x") ||
    !ctx.canTransformLayerProperty(layer, "y")
  ) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  ctx.setInspectorTab("transform");
  ctx.beginCanvasLayerDrag(event);
}

function isCanvasTransformHandleEvent(
  _ctx: ViewerAppContext,
  event: Pick<Event, "target">,
) {
  return (
    event.target instanceof Element &&
    Boolean(event.target.closest(".canvas-transform-handle"))
  );
}

export function createCanvasHitTestingActions(
  getContext: () => ViewerAppContext,
): Pick<
  CanvasSelectionActions,
  | "getCanvasPointFromEvent"
  | "beginCanvasHitTestPointerDown"
  | "handleCanvasDoubleClick"
  | "findTopCanvasLayerAtEvent"
  | "isCanvasPointInsideLayer"
  | "beginCanvasSelectionPointerDown"
  | "isCanvasTransformHandleEvent"
> {
  return {
    getCanvasPointFromEvent: bindViewerAction(
      getCanvasPointFromEvent,
      getContext,
    ),
    beginCanvasHitTestPointerDown: bindViewerAction(
      beginCanvasHitTestPointerDown,
      getContext,
    ),
    handleCanvasDoubleClick: bindViewerAction(
      handleCanvasDoubleClick,
      getContext,
    ),
    findTopCanvasLayerAtEvent: bindViewerAction(
      findTopCanvasLayerAtEvent,
      getContext,
    ),
    isCanvasPointInsideLayer: bindViewerAction(
      isCanvasPointInsideLayer,
      getContext,
    ),
    beginCanvasSelectionPointerDown: bindViewerAction(
      beginCanvasSelectionPointerDown,
      getContext,
    ),
    isCanvasTransformHandleEvent: bindViewerAction(
      isCanvasTransformHandleEvent,
      getContext,
    ),
  };
}
