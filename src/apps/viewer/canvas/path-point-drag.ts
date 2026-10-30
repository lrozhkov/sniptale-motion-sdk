import type { ViewerAppContext } from "../app/context.js";
import { activateCanvasDrag, createCanvasDragPreview } from "./drag-preview.js";
import { prepareCanvasGesture } from "./gesture.js";

function beginMotionPathPointDrag(
  ctx: ViewerAppContext,
  event,
  layerId,
  xKeyframeId,
  yKeyframeId,
) {
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layer = effectiveTemplate?.layers.find((item) => item.id === layerId);
  const model = ctx.getCanvasMotionPathModel(template, layerId);
  const point = findPoint(model, xKeyframeId, yKeyframeId);
  if (!template || !effectiveTemplate || !layer || !model.ok || !point) {
    return;
  }
  const selectedBefore = ctx.getFullySelectedCanvasMotionPathPoints(template);
  const clickedWasSelected = selectedBefore.some((selection) =>
    isSamePoint(selection, layerId, xKeyframeId, yKeyframeId),
  );
  const additive = hasSelectionModifier(event);
  setMotionPathPlayhead(ctx, point.time);
  ctx.selectCanvasMotionPathPoint(layerId, xKeyframeId, yKeyframeId, event, {
    preserveSelection:
      !additive && clickedWasSelected && selectedBefore.length > 1,
    sync: false,
  });
  if (additive && clickedWasSelected) {
    ctx.syncTimelineSelection(template);
    return;
  }
  const selections = ctx
    .getFullySelectedCanvasMotionPathPoints(template)
    .filter(({ model: selectedModel, point: selectedPoint }) =>
      Boolean(selectedModel.ok && selectedPoint),
    );
  const gesturePoints = selections.some((selection) =>
    isSamePoint(selection, layerId, xKeyframeId, yKeyframeId),
  )
    ? selections
    : [{ layer, model, point }];
  const blocked = gesturePoints.find(
    (selection) =>
      !ctx.canEditCanvasMotionPathPoint(
        selection.layer,
        selection.point,
        effectiveTemplate,
      ),
  );
  if (blocked) {
    ctx.syncTimelineSelection(template);
    ctx.reportCanvasMotionPathEditFailure(blocked.layer, blocked.point);
    return;
  }
  prepareCanvasGesture(ctx);
  const snapshot = gesturePoints.map(
    ({ layer: selectedLayer, point: item }) => ({
      layerId: selectedLayer.id,
      position: { x: item.x, y: item.y },
      xKeyframeId: item.xKeyframeId,
      yKeyframeId: item.yKeyframeId,
    }),
  );
  const anchor = snapshot.find(
    (item) =>
      item.layerId === layerId &&
      item.xKeyframeId === xKeyframeId &&
      item.yKeyframeId === yKeyframeId,
  )!;
  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const startX = event.clientX;
  const startY = event.clientY;
  ctx.state.canvasSnapStatus = null;
  const snapSession = ctx.createCanvasGuideSnapSessionForBox(
    {
      height: 0,
      width: 0,
      x: anchor.position.x,
      y: anchor.position.y,
    },
    anchor.position,
    [...new Set(snapshot.map((item) => item.layerId))],
  );
  const preview = createCanvasDragPreview(ctx);
  let latest = createOffsetUpdates(snapshot, { x: 0, y: 0 });
  const onMove = (moveEvent) => {
    const pageDx = moveEvent.clientX - startX;
    const pageDy = moveEvent.clientY - startY;
    if (
      !activateCanvasDrag(ctx, Math.abs(pageDx) + Math.abs(pageDy), () =>
        ctx.beginEditorCommand({
          payload: {
            points: snapshot.map(toPointRef),
          },
          type: "updateMotionPathPoints",
        }),
      )
    ) {
      return;
    }
    const dx = (pageDx / Math.max(1, canvasRect.width)) * ctx.refs.canvas.width;
    const dy =
      (pageDy / Math.max(1, canvasRect.height)) * ctx.refs.canvas.height;
    const snapped = ctx.applyCanvasGuideSnap(
      snapSession,
      anchor.position.x + dx,
      anchor.position.y + dy,
    );
    ctx.state.canvasSnapStatus = snapped.snap.length
      ? snapped.snap.join(" · ")
      : null;
    latest = createOffsetUpdates(snapshot, {
      x: snapped.x - anchor.position.x,
      y: snapped.y - anchor.position.y,
    });
    preview.scheduleUpdate(() => {
      ctx.updateCanvasMotionPathPointPositions(latest, {
        inspector: false,
        render: false,
        selection: false,
        timeline: false,
      });
      refreshMotionPathOverlay(ctx, template);
    });
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () => {
    if (ctx.state.dragMoved) {
      preview.finalize(() => {
        ctx.updateCanvasMotionPathPointPositions(latest, { render: false });
      });
      void ctx.settlePreviewAfterInteraction();
    } else {
      preview.finalize();
      ctx.syncTimelineSelection(template);
    }
  });
}

function handleMotionPathPointKeydown(
  ctx: ViewerAppContext,
  event,
  layerId,
  xKeyframeId,
  yKeyframeId,
) {
  if (event.key === "Enter") {
    event.preventDefault();
    ctx.selectCanvasMotionPathPoint(layerId, xKeyframeId, yKeyframeId, event);
    return;
  }
  const delta = getMotionPathKeyboardDelta(event);
  if (!delta) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const model = ctx.getCanvasMotionPathModel(template, layerId);
  const point = findPoint(model, xKeyframeId, yKeyframeId);
  if (!template || !effectiveTemplate || !model.ok || !point) {
    return;
  }
  const selectedBefore = ctx.getFullySelectedCanvasMotionPathPoints(template);
  const preserveSelection =
    selectedBefore.length > 1 &&
    selectedBefore.some((selection) =>
      isSamePoint(selection, layerId, xKeyframeId, yKeyframeId),
    );
  setMotionPathPlayhead(ctx, point.time);
  ctx.selectCanvasMotionPathPoint(layerId, xKeyframeId, yKeyframeId, null, {
    preserveSelection,
  });
  const selections = ctx.getFullySelectedCanvasMotionPathPoints(template);
  const blocked = selections.find(
    (selection) =>
      !ctx.canEditCanvasMotionPathPoint(
        selection.layer,
        selection.point,
        effectiveTemplate,
      ),
  );
  if (blocked) {
    ctx.reportCanvasMotionPathEditFailure(blocked.layer, blocked.point);
    return;
  }
  const snapshot = selections.map(({ layer, point: item }) => ({
    layerId: layer.id,
    position: { x: item.x, y: item.y },
    xKeyframeId: item.xKeyframeId,
    yKeyframeId: item.yKeyframeId,
  }));
  const selectionKey = snapshot
    .map((item) => `${item.layerId}:${item.xKeyframeId}:${item.yKeyframeId}`)
    .sort()
    .join("|");
  ctx.beginEditorCommand(
    {
      payload: { points: snapshot.map(toPointRef) },
      type: "updateMotionPathPoints",
    },
    {
      coalesceKey: `keyboard-motion-path:${selectionKey}`,
    },
  );
  ctx.updateCanvasMotionPathPointPositions(
    createOffsetUpdates(snapshot, delta),
    { render: false, selection: false },
  );
  void ctx.renderCurrentFrame().finally(() => {
    ctx.updateCanvasSelectionBox();
    focusMotionPathPoint(ctx, layerId, xKeyframeId, yKeyframeId);
  });
}

function createOffsetUpdates(snapshot, delta) {
  return snapshot.map((item) => ({
    layerId: item.layerId,
    position: {
      x: item.position.x + delta.x,
      y: item.position.y + delta.y,
    },
    xKeyframeId: item.xKeyframeId,
    yKeyframeId: item.yKeyframeId,
  }));
}

function refreshMotionPathOverlay(ctx: ViewerAppContext, template): void {
  const renderTemplate = ctx.getRenderTemplateSnapshot(template);
  const target = renderTemplate
    ? ctx.getCanvasSelectionTarget(renderTemplate)
    : null;
  if (renderTemplate && target) {
    ctx.renderSelectedMotionPathOverlay(renderTemplate, target);
  }
}

function findPoint(model, xKeyframeId, yKeyframeId) {
  return model.ok
    ? model.points.find(
        (candidate) =>
          candidate.xKeyframeId === xKeyframeId &&
          candidate.yKeyframeId === yKeyframeId,
      )
    : null;
}

function isSamePoint(selection, layerId, xKeyframeId, yKeyframeId): boolean {
  return (
    selection.layer.id === layerId &&
    selection.point.xKeyframeId === xKeyframeId &&
    selection.point.yKeyframeId === yKeyframeId
  );
}

function toPointRef(item) {
  return {
    layerId: item.layerId,
    xKeyframeId: item.xKeyframeId,
    yKeyframeId: item.yKeyframeId,
  };
}

function hasSelectionModifier(event): boolean {
  return Boolean(event.shiftKey || event.metaKey || event.ctrlKey);
}

function getMotionPathKeyboardDelta(event) {
  const step = event.shiftKey ? 10 : 1;
  if (event.key === "ArrowLeft") return { x: -step, y: 0 };
  if (event.key === "ArrowRight") return { x: step, y: 0 };
  if (event.key === "ArrowUp") return { x: 0, y: -step };
  if (event.key === "ArrowDown") return { x: 0, y: step };
  return null;
}

function setMotionPathPlayhead(ctx: ViewerAppContext, time: number): void {
  ctx.refs.timeSlider.value = String(time);
  ctx.refs.timeOutput.textContent = ctx.formatSeconds(time);
  ctx.updateTimelinePlayhead();
}

function focusMotionPathPoint(
  ctx: ViewerAppContext,
  layerId: string,
  xKeyframeId: string,
  yKeyframeId: string,
): void {
  const point = ctx.refs.motionPathOverlay.querySelector(
    `.motion-path-point[data-layer-id="${ctx.cssEscape(layerId)}"][data-x-keyframe-id="${ctx.cssEscape(xKeyframeId)}"][data-y-keyframe-id="${ctx.cssEscape(yKeyframeId)}"]`,
  );
  if (point instanceof SVGElement) point.focus();
}

export function installCanvasPathPointDragOwner(ctx: ViewerAppContext): void {
  ctx.beginMotionPathPointDrag = beginMotionPathPointDrag.bind(undefined, ctx);
  ctx.handleMotionPathPointKeydown = handleMotionPathPointKeydown.bind(
    undefined,
    ctx,
  );
}
