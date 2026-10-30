import type { ViewerAppContext } from "../app/context.js";
import { activateCanvasDrag } from "./drag-preview.js";
import {
  resolveCanvasSelectionScaleFactor,
  transformCanvasSelection,
} from "./selection-transform-math.js";
import {
  beginCanvasSelectionPreview,
  beginCanvasSelectionTransformCommand,
  createCanvasSelectionGestureSnapshot,
  finalizeCanvasSelectionTransform,
  getCanvasSelectionBoxCenter,
  getOpposingCanvasSelectionCorner,
  scheduleCanvasSelectionTransform,
} from "./selection-transform-state.js";
import { normalizeCanvasAngleDelta } from "./transform-math.js";

function beginCanvasSelectionDrag(ctx: ViewerAppContext, event) {
  const snapshot = createCanvasSelectionGestureSnapshot(ctx, "move");
  if (!snapshot) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startY = event.clientY;
  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const center = getCanvasSelectionBoxCenter(snapshot.bounds.box);
  const snapSession = ctx.createCanvasGuideSnapSessionForBox(
    snapshot.bounds.box,
    center,
    snapshot.layerIds,
  );
  const preview = beginCanvasSelectionPreview(ctx, snapshot);
  let latest = transformCanvasSelection(snapshot.entries, {
    pivot: center,
    translation: { x: 0, y: 0 },
  });
  const onMove = (moveEvent) => {
    const pageDx = moveEvent.clientX - startX;
    const pageDy = moveEvent.clientY - startY;
    if (
      !activateCanvasDrag(ctx, Math.abs(pageDx) + Math.abs(pageDy), () =>
        beginCanvasSelectionTransformCommand(ctx, snapshot),
      )
    ) {
      return;
    }
    const rawCenter = {
      x:
        center.x +
        (pageDx / Math.max(1, canvasRect.width)) * ctx.refs.canvas.width,
      y:
        center.y +
        (pageDy / Math.max(1, canvasRect.height)) * ctx.refs.canvas.height,
    };
    const snapped = ctx.applyCanvasGuideSnap(
      snapSession,
      rawCenter.x,
      rawCenter.y,
    );
    ctx.state.canvasSnapStatus = snapped.snap.length
      ? snapped.snap.join(" · ")
      : null;
    latest = transformCanvasSelection(snapshot.entries, {
      pivot: center,
      translation: { x: snapped.x - center.x, y: snapped.y - center.y },
    });
    scheduleCanvasSelectionTransform(ctx, preview, snapshot, latest);
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () =>
    finalizeCanvasSelectionTransform(ctx, preview, snapshot, latest),
  );
  return true;
}

function beginCanvasSelectionScaleDrag(ctx: ViewerAppContext, event, handle) {
  const snapshot = createCanvasSelectionGestureSnapshot(ctx, "scale");
  if (!snapshot || !["nw", "ne", "se", "sw"].includes(handle)) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  const fixed = getOpposingCanvasSelectionCorner(snapshot.bounds.box, handle);
  const start = ctx.getCanvasPointFromEvent(event);
  const startVector = { x: start.x - fixed.x, y: start.y - fixed.y };
  const startLengthSquared = Math.max(
    0.0001,
    startVector.x * startVector.x + startVector.y * startVector.y,
  );
  const preview = beginCanvasSelectionPreview(ctx, snapshot);
  let latest = transformCanvasSelection(snapshot.entries, {
    pivot: fixed,
    scale: 1,
  });
  const onMove = (moveEvent) => {
    const point = ctx.getCanvasPointFromEvent(moveEvent);
    const current = { x: point.x - fixed.x, y: point.y - fixed.y };
    const rawFactor =
      (current.x * startVector.x + current.y * startVector.y) /
      startLengthSquared;
    if (
      !activateCanvasDrag(ctx, Math.abs(rawFactor - 1) * 100, () =>
        beginCanvasSelectionTransformCommand(ctx, snapshot),
      )
    ) {
      return;
    }
    const factor = resolveCanvasSelectionScaleFactor(
      snapshot.entries,
      rawFactor,
    );
    latest = transformCanvasSelection(snapshot.entries, {
      pivot: fixed,
      scale: factor,
    });
    scheduleCanvasSelectionTransform(ctx, preview, snapshot, latest);
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () =>
    finalizeCanvasSelectionTransform(ctx, preview, snapshot, latest),
  );
  return true;
}

function beginCanvasSelectionRotationDrag(ctx: ViewerAppContext, event) {
  const snapshot = createCanvasSelectionGestureSnapshot(ctx, "rotation");
  if (!snapshot) {
    return false;
  }
  event.preventDefault();
  event.stopPropagation();
  const canvasRect = ctx.refs.canvas.getBoundingClientRect();
  const pivot = getCanvasSelectionBoxCenter(snapshot.bounds.box);
  const pagePivot = {
    x: canvasRect.left + pivot.x * (canvasRect.width / ctx.refs.canvas.width),
    y: canvasRect.top + pivot.y * (canvasRect.height / ctx.refs.canvas.height),
  };
  const startAngle = Math.atan2(
    event.clientY - pagePivot.y,
    event.clientX - pagePivot.x,
  );
  const minRotation = Math.max(
    ...snapshot.entries.map((entry) => -360 - entry.values.rotation),
  );
  const maxRotation = Math.min(
    ...snapshot.entries.map((entry) => 360 - entry.values.rotation),
  );
  const preview = beginCanvasSelectionPreview(ctx, snapshot);
  let latest = transformCanvasSelection(snapshot.entries, { pivot });
  const onMove = (moveEvent) => {
    const angle = Math.atan2(
      moveEvent.clientY - pagePivot.y,
      moveEvent.clientX - pagePivot.x,
    );
    let rotation = normalizeCanvasAngleDelta(
      ((angle - startAngle) * 180) / Math.PI,
    );
    if (moveEvent.shiftKey) {
      rotation = Math.round(rotation / 15) * 15;
    }
    rotation = ctx.deps.clamp(rotation, minRotation, maxRotation);
    if (
      !activateCanvasDrag(
        ctx,
        Math.abs(rotation),
        () => beginCanvasSelectionTransformCommand(ctx, snapshot),
        0.5,
      )
    ) {
      return;
    }
    latest = transformCanvasSelection(snapshot.entries, { pivot, rotation });
    scheduleCanvasSelectionTransform(ctx, preview, snapshot, latest);
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () =>
    finalizeCanvasSelectionTransform(ctx, preview, snapshot, latest),
  );
  return true;
}

export function installCanvasSelectionTransformOwner(
  ctx: ViewerAppContext,
): void {
  ctx.beginCanvasSelectionDrag = beginCanvasSelectionDrag.bind(undefined, ctx);
  ctx.beginCanvasSelectionScaleDrag = beginCanvasSelectionScaleDrag.bind(
    undefined,
    ctx,
  );
  ctx.beginCanvasSelectionRotationDrag = beginCanvasSelectionRotationDrag.bind(
    undefined,
    ctx,
  );
}
