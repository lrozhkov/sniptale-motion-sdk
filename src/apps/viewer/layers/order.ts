import type { ViewerAppContext } from "../app/context.js";
import {
  createLayerHierarchyIndex,
  getLayerLeafIds,
  normalizeLayerSelectionRoots,
} from "./hierarchy.js";
import { reparentLayerSelection } from "./reparent.js";

function beginLayerPanelDrag(ctx: ViewerAppContext, event, layerId) {
  if (event.button !== 0 || event.target.closest(".layer-icon-button")) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template || isLayerOrderLocked(ctx, template, [layerId])) {
    return;
  }
  const row = event.currentTarget.closest(".layer-row");
  const rowHeight = row?.getBoundingClientRect().height || 38;
  const startY = event.clientY;
  const originalLayers = ctx.deps.deepClone(template.layers);
  let appliedVisualDelta = 0;
  let commandStarted = false;
  ctx.selectLayer(layerId);
  const onMove = (moveEvent) => {
    const visualDelta = Math.round(
      (moveEvent.clientY - startY) / Math.max(1, rowHeight),
    );
    if (visualDelta === appliedVisualDelta) {
      return;
    }
    if (visualDelta === 0) {
      appliedVisualDelta = 0;
      if (commandStarted) {
        ctx.setEditorOverride({ layers: ctx.deps.deepClone(originalLayers) });
        ctx.renderTimelineEditor(ctx.state.currentTemplate);
        void ctx.renderCurrentFrame();
      }
      return;
    }
    const result = createLayerSiblingMove(
      originalLayers,
      [layerId],
      visualDelta,
    );
    if (!result) {
      return;
    }
    if (!commandStarted) {
      commandStarted = true;
      ctx.beginEditorCommand({
        payload: { layerIds: [layerId] },
        type: "reparentLayers",
      });
    }
    appliedVisualDelta = visualDelta;
    ctx.state.dragMoved = true;
    ctx.setEditorOverride({ layers: result });
    ctx.renderTimelineEditor(ctx.state.currentTemplate);
    void ctx.renderCurrentFrame();
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove);
}

function moveSelectedLayerOrder(ctx: ViewerAppContext, direction) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const rootIds = template ? ctx.getSelectedLayerRootIds(template) : [];
  if (
    !template ||
    rootIds.length === 0 ||
    isLayerOrderLocked(ctx, template, rootIds)
  ) {
    return;
  }
  const layers = createLayerSiblingMove(template.layers, rootIds, -direction);
  if (!layers) {
    return;
  }
  ctx.beginEditorCommand({
    payload: { direction, layerIds: rootIds },
    type: "reparentLayers",
  });
  ctx.setEditorOverride({ layers });
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  void ctx.renderCurrentFrame();
}

export function createLayerSiblingMove(
  sourceLayers,
  selectedLayerIds,
  visualDelta,
) {
  if (!visualDelta) {
    return null;
  }
  const hierarchy = createLayerHierarchyIndex(sourceLayers);
  const rootIds = normalizeLayerSelectionRoots(hierarchy, selectedLayerIds);
  const parentIds = new Set(
    rootIds.map((id) => hierarchy.parentById.get(id)?.id ?? null),
  );
  if (rootIds.length === 0 || parentIds.size !== 1) {
    return null;
  }
  const siblings = [
    ...(hierarchy.childrenByParentId.get([...parentIds][0] ?? null) ?? []),
  ].reverse();
  const selected = new Set(rootIds);
  const selectedIndexes = siblings
    .map((layer, index) => (selected.has(layer.id) ? index : -1))
    .filter((index) => index >= 0);
  if (
    selectedIndexes.length !== rootIds.length ||
    selectedIndexes.some(
      (index, offset) => index !== selectedIndexes[0] + offset,
    )
  ) {
    return null;
  }
  const targetIndex = clamp(
    selectedIndexes[0] + visualDelta,
    0,
    siblings.length - selectedIndexes.length,
  );
  if (targetIndex === selectedIndexes[0]) {
    return null;
  }
  const target =
    visualDelta < 0
      ? siblings[targetIndex]
      : siblings[targetIndex + selectedIndexes.length - 1];
  const result = reparentLayerSelection(
    sourceLayers,
    rootIds,
    target.id,
    visualDelta < 0 ? "before" : "after",
  );
  return result.ok ? result.layers : null;
}

function isLayerOrderLocked(ctx, template, rootIds): boolean {
  const hierarchy = ctx.getLayerHierarchy(template);
  return getLayerLeafIds(hierarchy, rootIds).some(
    (id) => hierarchy.byId.get(id)?.locked === true,
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function installLayersOrderOwner(ctx: ViewerAppContext): void {
  ctx.beginLayerPanelDrag = (...args: any[]) =>
    (beginLayerPanelDrag as any)(ctx, ...args);
  ctx.moveSelectedLayerOrder = (...args: any[]) =>
    (moveSelectedLayerOrder as any)(ctx, ...args);
}
