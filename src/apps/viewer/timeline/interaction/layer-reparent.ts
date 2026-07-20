import type { ViewerAppContext } from "../../app/context.js";
import { getLayerLeafIds } from "../../layers/hierarchy.js";
import {
  type LayerReparentPosition,
  reparentLayerSelection,
} from "../../layers/reparent.js";

function appendTimelineLayerDragGrip(
  ctx: ViewerAppContext,
  label,
  layerId,
): void {
  const grip = document.createElement("button");
  grip.type = "button";
  grip.className = "timeline-layer-drag-grip";
  grip.dataset.layerId = layerId;
  grip.setAttribute(
    "aria-label",
    ctx.deps.t("viewer.timeline.reorderLayer", "Reorder layer"),
  );
  grip.addEventListener("pointerdown", (event) =>
    ctx.beginTimelineLayerReparent(event, layerId),
  );
  label.append(grip);
}

function beginTimelineLayerReparent(ctx: ViewerAppContext, event, layerId) {
  if (event.button !== 0) {
    return false;
  }
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return false;
  }
  const hierarchy = ctx.getLayerHierarchy(template);
  const movingRootIds = ctx.state.selectedLayers.includes(layerId)
    ? ctx.getSelectedLayerRootIds(template)
    : [layerId];
  const movingLeafIds = getLayerLeafIds(hierarchy, movingRootIds);
  if (
    movingLeafIds.some((leafId) => hierarchy.byId.get(leafId)?.locked === true)
  ) {
    ctx.logDiagnostic(
      ctx.deps.t(
        "viewer.timeline.reparentLocked",
        "Unlock every selected layer before moving it in the hierarchy.",
      ),
      "error",
    );
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  if (!ctx.state.selectedLayers.includes(layerId)) {
    ctx.selectLayer(layerId);
  }
  const start = { x: event.clientX, y: event.clientY };
  let dropTarget: HTMLElement | null = null;
  let dropPlan: any = null;
  let dropPosition: LayerReparentPosition | null = null;
  const onMove = (moveEvent) => {
    if (
      !ctx.state.dragMoved &&
      Math.abs(moveEvent.clientX - start.x) +
        Math.abs(moveEvent.clientY - start.y) <=
        3
    ) {
      return;
    }
    ctx.state.dragMoved = true;
    clearLayerDropTarget(dropTarget);
    dropTarget =
      document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest<HTMLElement>(".layer-lane[data-layer-id]") ?? null;
    dropPosition = dropTarget
      ? getLayerDropPosition(dropTarget, moveEvent.clientY)
      : null;
    if (!dropTarget || !dropPosition) {
      dropPlan = null;
      return;
    }
    dropPlan = reparentLayerSelection(
      template.layers,
      movingRootIds,
      dropTarget.dataset.layerId,
      dropPosition,
    );
    if (dropPlan.ok) {
      dropTarget.classList.add(`drop-${dropPosition}`);
    } else {
      dropTarget.classList.add("drop-invalid");
    }
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () => {
    clearLayerDropTarget(dropTarget);
    if (!ctx.state.dragMoved || !dropPlan?.ok || !dropPosition || !dropTarget) {
      return;
    }
    ctx.beginEditorCommand({
      payload: {
        layerIds: dropPlan.rootIds,
        position: dropPosition,
        targetLayerId: dropTarget.dataset.layerId,
      },
      type: "reparentLayers",
    });
    ctx.setEditorOverride({ layers: dropPlan.layers });
    ctx.setSelectedLayers(dropPlan.rootIds, {
      ...template,
      layers: dropPlan.layers,
    });
    ctx.renderTimelineEditor(ctx.state.currentTemplate);
    void ctx.renderCurrentFrame();
  });
  return true;
}

function getLayerDropPosition(
  row: HTMLElement,
  clientY: number,
): LayerReparentPosition {
  const rect = row.getBoundingClientRect();
  const ratio = (clientY - rect.top) / Math.max(1, rect.height);
  if (row.dataset.layerGroupId && ratio >= 0.28 && ratio <= 0.72) {
    return "inside";
  }
  return ratio < 0.5 ? "before" : "after";
}

function clearLayerDropTarget(target: HTMLElement | null): void {
  target?.classList.remove(
    "drop-after",
    "drop-before",
    "drop-inside",
    "drop-invalid",
  );
}

export function installTimelineLayerReparentOwner(ctx: ViewerAppContext): void {
  ctx.appendTimelineLayerDragGrip = (...args: any[]) =>
    (appendTimelineLayerDragGrip as any)(ctx, ...args);
  ctx.beginTimelineLayerReparent = (...args: any[]) =>
    (beginTimelineLayerReparent as any)(ctx, ...args);
}
