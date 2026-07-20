import type { ViewerAppContext } from "../app/context.js";

function beginMotionPathPointHitDrag(ctx: ViewerAppContext, event) {
  if (event.button !== 0 || event.defaultPrevented) {
    return;
  }
  if (ctx.isCanvasTransformHandleEvent(event)) {
    return;
  }
  const editablePathPoint = findEditablePathPointNearEvent(ctx, event);
  if (
    editablePathPoint?.layerId &&
    Number.isFinite(editablePathPoint.pointIndex)
  ) {
    ctx.beginEditablePathPointDrag(
      event,
      editablePathPoint.layerId,
      editablePathPoint.pointIndex,
    );
    return;
  }
  const pathPoint = findMotionPathPointNearEvent(ctx, event);
  if (pathPoint?.layerId && pathPoint.xKeyframeId && pathPoint.yKeyframeId) {
    ctx.beginMotionPathPointDrag(
      event,
      pathPoint.layerId,
      pathPoint.xKeyframeId,
      pathPoint.yKeyframeId,
    );
    return;
  }
  beginOverlappingTransformHandleDrag(ctx, event);
}

function beginOverlappingTransformHandleDrag(
  ctx: ViewerAppContext,
  event,
): boolean {
  const handle = document
    .elementsFromPoint(event.clientX, event.clientY)
    .find(
      (element) =>
        element instanceof HTMLElement &&
        element.classList.contains("canvas-transform-handle"),
    );
  if (!(handle instanceof HTMLElement)) {
    return false;
  }
  ctx.setInspectorTab("transform");
  if (handle.dataset.scaleHandle) {
    ctx.beginCanvasScaleDrag(event, handle.dataset.scaleHandle);
    return true;
  }
  if (handle.dataset.rotateHandle === "true") {
    ctx.beginCanvasRotationDrag(event);
    return true;
  }
  if (handle.dataset.anchorHandle === "true") {
    ctx.beginCanvasAnchorDrag(event);
    return true;
  }
  return false;
}

function findNearestOverlayPoint(
  ctx: ViewerAppContext,
  event,
  selector: string,
  read: (point: SVGElement) => Record<string, unknown>,
) {
  let nearest: any = null;
  const points = Array.from(
    ctx.refs.motionPathOverlay.querySelectorAll(selector),
  ) as SVGElement[];
  for (const point of points) {
    const rect = point.getBoundingClientRect();
    const distance = Math.hypot(
      event.clientX - (rect.left + rect.width / 2),
      event.clientY - (rect.top + rect.height / 2),
    );
    if (distance <= 14 && (!nearest || distance < nearest.distance)) {
      nearest = { distance, ...read(point) };
    }
  }
  return nearest;
}

function findEditablePathPointNearEvent(ctx: ViewerAppContext, event) {
  return findNearestOverlayPoint(
    ctx,
    event,
    ".editable-path-point",
    (point) => ({
      layerId: point.dataset.layerId,
      pointIndex: Number(point.dataset.pointIndex),
    }),
  );
}

function findMotionPathPointNearEvent(ctx: ViewerAppContext, event) {
  return findNearestOverlayPoint(
    ctx,
    event,
    '.motion-path-point[data-interactive="true"]',
    (point) => ({
      layerId: point.dataset.layerId,
      xKeyframeId: point.dataset.xKeyframeId,
      yKeyframeId: point.dataset.yKeyframeId,
    }),
  );
}

export function installCanvasPathPointHitTestingOwner(
  ctx: ViewerAppContext,
): void {
  ctx.beginMotionPathPointHitDrag = (...args: any[]) =>
    (beginMotionPathPointHitDrag as any)(ctx, ...args);
  ctx.beginOverlappingTransformHandleDrag = (...args: any[]) =>
    (beginOverlappingTransformHandleDrag as any)(ctx, ...args);
  ctx.findEditablePathPointNearEvent = (...args: any[]) =>
    (findEditablePathPointNearEvent as any)(ctx, ...args);
  ctx.findMotionPathPointNearEvent = (...args: any[]) =>
    (findMotionPathPointNearEvent as any)(ctx, ...args);
}
