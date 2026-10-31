import type { CanvasSelectionGestureSnapshot } from "./selection-transform-state.js";
import { bindViewerAction } from "../app/bind-action.js";
import type { CanvasTransformActions } from "./transform-contract.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  resolveCanvasSelectionScaleFactor,
  transformCanvasSelection,
} from "./selection-transform-math.js";
import {
  applyCanvasSelectionTransform,
  createCanvasSelectionGestureSnapshot,
  getCanvasSelectionBoxCenter,
} from "./selection-transform-state.js";

function moveCanvasSelectionBy(ctx: ViewerAppContext, dx: number, dy: number) {
  const snapshot = createCanvasSelectionGestureSnapshot(ctx, "move");
  if (!snapshot) {
    return false;
  }
  const result = transformCanvasSelection(snapshot.entries, {
    pivot: getCanvasSelectionBoxCenter(snapshot.bounds.box),
    translation: { x: Number(dx) || 0, y: Number(dy) || 0 },
  });
  beginKeyboardSelectionCommand(ctx, snapshot, "nudge-layer-selection");
  applyCanvasSelectionTransform(ctx, snapshot, result, { render: true });
  return true;
}

function rotateCanvasSelectionBy(ctx: ViewerAppContext, delta: number) {
  const snapshot = createCanvasSelectionGestureSnapshot(ctx, "rotation");
  if (!snapshot) {
    return false;
  }
  const minDelta = Math.max(
    ...snapshot.entries.map((entry) => -360 - entry.values.rotation),
  );
  const maxDelta = Math.min(
    ...snapshot.entries.map((entry) => 360 - entry.values.rotation),
  );
  const rotation = ctx.deps.clamp(Number(delta) || 0, minDelta, maxDelta);
  const result = transformCanvasSelection(snapshot.entries, {
    pivot: getCanvasSelectionBoxCenter(snapshot.bounds.box),
    rotation,
  });
  beginKeyboardSelectionCommand(ctx, snapshot, "rotate-layer-selection");
  applyCanvasSelectionTransform(ctx, snapshot, result, { render: true });
  return true;
}

function scaleCanvasSelectionBy(
  ctx: ViewerAppContext,
  requestedFactor: number,
) {
  const snapshot = createCanvasSelectionGestureSnapshot(ctx, "scale");
  if (!snapshot) {
    return false;
  }
  const factor = resolveCanvasSelectionScaleFactor(
    snapshot.entries,
    Number(requestedFactor) || 1,
  );
  const result = transformCanvasSelection(snapshot.entries, {
    pivot: getCanvasSelectionBoxCenter(snapshot.bounds.box),
    scale: factor,
  });
  beginKeyboardSelectionCommand(ctx, snapshot, "scale-layer-selection");
  applyCanvasSelectionTransform(ctx, snapshot, result, { render: true });
  return true;
}

function setCanvasSelectionFrameProperty(
  ctx: ViewerAppContext,
  property: "height" | "left" | "top" | "width",
  requestedValue: number,
) {
  const operation =
    property === "left" || property === "top" ? "move" : "scale";
  const snapshot = createCanvasSelectionGestureSnapshot(ctx, operation);
  const value = Number(requestedValue);
  if (!snapshot || !Number.isFinite(value)) {
    return false;
  }
  const box = snapshot.bounds.box;
  const result =
    operation === "move"
      ? transformCanvasSelection(snapshot.entries, {
          pivot: getCanvasSelectionBoxCenter(box),
          translation: {
            x: property === "left" ? value - box.x : 0,
            y: property === "top" ? value - box.y : 0,
          },
        })
      : transformCanvasSelection(snapshot.entries, {
          pivot: { x: box.x, y: box.y },
          scale: resolveCanvasSelectionScaleFactor(
            snapshot.entries,
            value /
              Math.max(0.001, property === "width" ? box.width : box.height),
          ),
        });
  beginKeyboardSelectionCommand(ctx, snapshot, "selection-frame");
  applyCanvasSelectionTransform(ctx, snapshot, result, { render: true });
  return true;
}

function beginKeyboardSelectionCommand(
  ctx: ViewerAppContext,
  snapshot: CanvasSelectionGestureSnapshot,
  coalescePrefix: string,
): void {
  ctx.beginEditorCommand(
    {
      payload: {
        layerIds: snapshot.layerIds,
        operation: snapshot.operation,
      },
      type: "transformLayerSelection",
    },
    { coalesceKey: `${coalescePrefix}:${snapshot.layerIds.join(",")}` },
  );
}

export function createCanvasSelectionTransformKeyboardActions(
  getContext: () => ViewerAppContext,
): Pick<
  CanvasTransformActions,
  | "moveCanvasSelectionBy"
  | "rotateCanvasSelectionBy"
  | "scaleCanvasSelectionBy"
  | "setCanvasSelectionFrameProperty"
> {
  return {
    moveCanvasSelectionBy: bindViewerAction(moveCanvasSelectionBy, getContext),
    rotateCanvasSelectionBy: bindViewerAction(
      rotateCanvasSelectionBy,
      getContext,
    ),
    scaleCanvasSelectionBy: bindViewerAction(
      scaleCanvasSelectionBy,
      getContext,
    ),
    setCanvasSelectionFrameProperty: bindViewerAction(
      setCanvasSelectionFrameProperty,
      getContext,
    ),
  };
}
