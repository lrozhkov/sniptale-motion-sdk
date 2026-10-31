import { createTimelineDragPreview } from "../timeline/interaction/drag-preview.js";
import { bindViewerAction } from "../app/bind-action.js";
import type { LayerOperationActions } from "./actions-contract.js";
import type { EffectLayer } from "../../../sdk/types.js";
import type { EditorTemplate } from "../templates/model.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  createLayerHierarchyIndex,
  getLayerLeafIds,
  normalizeLayerSelectionRoots,
} from "./hierarchy.js";
import { reparentLayerSelection } from "./reparent.js";

function beginLayerPanelDrag(
  ctx: ViewerAppContext,
  event: PointerEvent,
  layerId: string,
): void {
  const target = event.currentTarget;
  const source = ctx.state.currentTemplate;
  if (
    !source ||
    event.button !== 0 ||
    !(event.target instanceof Element) ||
    !(target instanceof HTMLElement) ||
    event.target.closest(".layer-icon-button")
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.getEffectiveTemplate(source);
  if (!template || isLayerOrderLocked(ctx, template, [layerId])) return;
  ctx.state.pointerDragCleanup?.();
  const rowHeight =
    target.closest(".layer-row")?.getBoundingClientRect().height || 38;
  const startY = event.clientY;
  const originalLayers = ctx.deps.deepClone(template.layers);
  let scheduledDelta = 0;
  ctx.selectLayer(layerId);
  const preview = createTimelineDragPreview(ctx, source, {
    renderPreview: () => ctx.renderTimelineEditor(source),
  });
  const onMove = (moveEvent: MouseEvent) => {
    const delta = Math.round(
      (moveEvent.clientY - startY) / Math.max(1, rowHeight),
    );
    if (delta === scheduledDelta) return;
    const layers =
      delta === 0
        ? ctx.deps.deepClone(originalLayers)
        : createLayerSiblingMove(originalLayers, [layerId], delta);
    if (
      !layers ||
      !preview.activate(Math.abs(moveEvent.clientY - startY), () =>
        ctx.beginEditorCommand({
          payload: { layerIds: [layerId] },
          type: "reparentLayers",
        }),
      )
    )
      return;
    scheduledDelta = delta;
    preview.scheduleUpdate(() => ctx.setEditorOverride({ layers }));
  };
  ctx.bindPointerDrag(event.pointerId, target, onMove, () =>
    preview.finalize(),
  );
}

function moveSelectedLayerOrder(ctx: ViewerAppContext, direction: number) {
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
  sourceLayers: EffectLayer[],
  selectedLayerIds: string[],
  visualDelta: unknown,
) {
  if (
    typeof visualDelta !== "number" ||
    !Number.isInteger(visualDelta) ||
    !visualDelta
  ) {
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
  const firstIndex = selectedIndexes[0];
  if (
    firstIndex === undefined ||
    selectedIndexes.length !== rootIds.length ||
    selectedIndexes.some((index, offset) => index !== firstIndex + offset)
  ) {
    return null;
  }
  const targetIndex = clamp(
    firstIndex + visualDelta,
    0,
    siblings.length - selectedIndexes.length,
  );
  if (targetIndex === firstIndex) {
    return null;
  }
  const target =
    visualDelta < 0
      ? siblings[targetIndex]
      : siblings[targetIndex + selectedIndexes.length - 1];
  if (!target) return null;
  const result = reparentLayerSelection(
    sourceLayers,
    rootIds,
    target.id,
    visualDelta < 0 ? "before" : "after",
  );
  return result.ok ? result.layers : null;
}

function isLayerOrderLocked(
  ctx: ViewerAppContext,
  template: EditorTemplate,
  rootIds: string[],
): boolean {
  const hierarchy = ctx.getLayerHierarchy(template);
  return getLayerLeafIds(hierarchy, rootIds).some(
    (id) => hierarchy.byId.get(id)?.locked === true,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function createLayerOrderActions(
  getContext: () => ViewerAppContext,
): Pick<
  LayerOperationActions,
  "beginLayerPanelDrag" | "moveSelectedLayerOrder"
> {
  return {
    beginLayerPanelDrag: bindViewerAction(beginLayerPanelDrag, getContext),
    moveSelectedLayerOrder: bindViewerAction(
      moveSelectedLayerOrder,
      getContext,
    ),
  };
}
