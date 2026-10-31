import {
  readEditablePathPointDataset,
  readMotionPathPointDataset,
} from "./path-point-dataset.js";
import { bindViewerAction } from "../app/bind-action.js";
import type { CanvasPathActions } from "./path-contract.js";
import type { ViewerAppContext } from "../app/context.js";

function beginMotionPathPointHitDrag(
  ctx: ViewerAppContext,
  event: PointerEvent,
) {
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
  event: PointerEvent,
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

function findNearestOverlayPoint<T extends object>(
  ctx: ViewerAppContext,
  event: MouseEvent,
  selector: string,
  read: (point: SVGElement) => T | null,
) {
  let nearest: (T & { distance: number }) | null = null;
  const points = Array.from(
    ctx.refs.motionPathOverlay.querySelectorAll(selector),
  );
  for (const point of points) {
    if (!(point instanceof SVGElement)) continue;
    const value = read(point);
    if (!value) continue;
    const rect = point.getBoundingClientRect();
    const distance = Math.hypot(
      event.clientX - (rect.left + rect.width / 2),
      event.clientY - (rect.top + rect.height / 2),
    );
    if (distance <= 14 && (!nearest || distance < nearest.distance)) {
      nearest = { distance, ...value };
    }
  }
  return nearest;
}

function findEditablePathPointNearEvent(
  ctx: ViewerAppContext,
  event: MouseEvent,
) {
  return findNearestOverlayPoint(ctx, event, ".editable-path-point", (point) =>
    readEditablePathPointDataset(point.dataset),
  );
}

function findMotionPathPointNearEvent(
  ctx: ViewerAppContext,
  event: MouseEvent,
) {
  return findNearestOverlayPoint(
    ctx,
    event,
    '.motion-path-point[data-interactive="true"]',
    (point) => readMotionPathPointDataset(point.dataset),
  );
}

export function createCanvasPathPointHitTestingActions(
  getContext: () => ViewerAppContext,
): Pick<
  CanvasPathActions,
  | "beginMotionPathPointHitDrag"
  | "beginOverlappingTransformHandleDrag"
  | "findEditablePathPointNearEvent"
  | "findMotionPathPointNearEvent"
> {
  return {
    beginMotionPathPointHitDrag: bindViewerAction(
      beginMotionPathPointHitDrag,
      getContext,
    ),
    beginOverlappingTransformHandleDrag: bindViewerAction(
      beginOverlappingTransformHandleDrag,
      getContext,
    ),
    findEditablePathPointNearEvent: bindViewerAction(
      findEditablePathPointNearEvent,
      getContext,
    ),
    findMotionPathPointNearEvent: bindViewerAction(
      findMotionPathPointNearEvent,
      getContext,
    ),
  };
}
