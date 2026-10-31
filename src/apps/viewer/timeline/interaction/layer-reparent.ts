import type { ViewerAppContext } from "../../app/context.js";
import { bindViewerAction } from "../../app/bind-action.js";
import type { TimelineLayerGestureActions } from "./pointer-contract.js";
import {
  createLayerHierarchyIndex,
  normalizeLayerSelectionRoots,
  getLayerLeafIds,
} from "../../layers/hierarchy.js";
import {
  type LayerReparentPosition,
  type LayerReparentResult,
  reparentLayerSelection,
} from "../../layers/reparent.js";

type LayerReparentContext = Pick<
  ViewerAppContext,
  | "bindPointerDrag"
  | "getEffectiveTemplate"
  | "setEditorOverride"
  | "logDiagnostic"
> & {
  state: Pick<
    ViewerAppContext["state"],
    | "currentTemplate"
    | "selectedLayers"
    | "dragMoved"
    | "editorOverrides"
    | "timelineOverrides"
    | "pointerDragCleanup"
  >;
  deps: Pick<ViewerAppContext["deps"], "t">;
  beginTimelineLayerReparent: TimelineLayerGestureActions["beginTimelineLayerReparent"];
  selectLayer(id: string): void;
  beginEditorCommand(command: {
    type: "reparentLayers";
    payload: {
      layerIds: string[];
      position: LayerReparentPosition;
      targetLayerId: string;
    };
  }): void;
  setSelectedLayers(
    ids: string[],
    template: NonNullable<ReturnType<ViewerAppContext["getEffectiveTemplate"]>>,
  ): void;
  renderTimelineEditor(
    source: ViewerAppContext["state"]["currentTemplate"],
  ): void;
  renderCurrentFrame(): Promise<unknown>;
};

function appendTimelineLayerDragGrip(
  ctx: LayerReparentContext,
  label: HTMLElement,
  layerId: string,
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

function beginTimelineLayerReparent(
  ctx: LayerReparentContext,
  event: PointerEvent,
  layerId: string,
) {
  if (event.button !== 0) {
    return false;
  }
  const source = ctx.state.currentTemplate;
  const target = event.currentTarget;
  if (!source || !(target instanceof HTMLElement)) return false;
  ctx.state.pointerDragCleanup?.();
  const template = ctx.getEffectiveTemplate(source);
  if (!template) {
    return false;
  }
  const hierarchy = createLayerHierarchyIndex(template.layers);
  const movingRootIds = ctx.state.selectedLayers.includes(layerId)
    ? normalizeLayerSelectionRoots(hierarchy, ctx.state.selectedLayers)
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
  let dropPlan: LayerReparentResult | null = null;
  const editorRevision = ctx.state.editorOverrides.get(source.id);
  const timelineRevision = ctx.state.timelineOverrides.get(source.id);
  const isCurrent = () =>
    ctx.state.currentTemplate === source &&
    ctx.state.editorOverrides.get(source.id) === editorRevision &&
    ctx.state.timelineOverrides.get(source.id) === timelineRevision;
  let dropPosition: LayerReparentPosition | null = null;
  const onMove = (moveEvent: MouseEvent) => {
    if (!isCurrent()) return;
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
    const candidate =
      document
        .elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        ?.closest<HTMLElement>(".layer-lane[data-layer-id]") ?? null;
    dropTarget = candidate instanceof HTMLElement ? candidate : null;
    dropPosition = dropTarget
      ? getLayerDropPosition(dropTarget, moveEvent.clientY)
      : null;
    if (!dropTarget?.dataset.layerId || !dropPosition) {
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
  ctx.bindPointerDrag(event.pointerId, target, onMove, (endEvent) => {
    clearLayerDropTarget(dropTarget);
    if (
      endEvent.type === "pointercancel" ||
      !isCurrent() ||
      !ctx.state.dragMoved ||
      !dropPlan?.ok ||
      !dropPosition ||
      !dropTarget?.dataset.layerId
    ) {
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

export function createTimelineLayerReparentActions(
  getContext: () => LayerReparentContext,
): TimelineLayerGestureActions {
  return {
    appendTimelineLayerDragGrip: bindViewerAction(
      appendTimelineLayerDragGrip,
      getContext,
    ),
    beginTimelineLayerReparent: bindViewerAction(
      beginTimelineLayerReparent,
      getContext,
    ),
  };
}
