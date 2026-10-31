import type { EditorTemplate } from "../templates/model.js";
import type { ViewerAppContext } from "../app/context.js";
import { createCanvasDragPreview } from "./drag-preview.js";
import { prepareCanvasGesture } from "./gesture.js";
import {
  type CanvasSelectionBounds,
  resolveCanvasSelectionBounds,
} from "./selection-bounds.js";
import type {
  CanvasSelectionTransformEntry,
  CanvasSelectionTransformResult,
} from "./selection-transform-math.js";

export type CanvasSelectionTransformOperation = "move" | "rotation" | "scale";

export type CanvasSelectionGestureSnapshot = {
  bounds: CanvasSelectionBounds;
  entries: CanvasSelectionTransformEntry[];
  layerIds: string[];
  operation: CanvasSelectionTransformOperation;
  template: EditorTemplate;
  time: number;
};

const OPERATION_PROPERTIES: Record<
  CanvasSelectionTransformOperation,
  string[]
> = {
  move: ["x", "y"],
  rotation: ["x", "y", "rotation"],
  scale: ["x", "y", "scaleX", "scaleY"],
};

export function createCanvasSelectionGestureSnapshot(
  ctx: ViewerAppContext,
  operation: CanvasSelectionTransformOperation,
): CanvasSelectionGestureSnapshot | null {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const target = template ? ctx.getCanvasSelectionTarget(template) : null;
  if (!template || target?.kind !== "selection") {
    return null;
  }
  const time = prepareCanvasGesture(ctx);
  const resolution = {
    time,
    timeline: ctx.getEffectiveTimeline(ctx.state.currentTemplate),
  };
  const bounds = resolveCanvasSelectionBounds(
    ctx,
    template,
    target.layerIds,
    resolution,
  );
  if (
    !bounds ||
    bounds.entries.length !== target.layerIds.length ||
    bounds.entries.some(
      ({ layer }) =>
        layer.visible === false ||
        layer.locked ||
        !ctx.isLayerActiveAtTime(template, layer.id, time) ||
        OPERATION_PROPERTIES[operation].some(
          (property) => !ctx.canTransformLayerProperty(layer, property),
        ),
    )
  ) {
    return null;
  }
  return {
    bounds,
    entries: bounds.entries.map(({ box, layer, layerId, pivot }) => ({
      anchor: ctx.getResolvedLayerAnchor(layer, resolution),
      box: { ...box },
      layerId,
      pivot,
      values: {
        rotation: ctx.getResolvedLayerProperty(layer, "rotation", resolution),
        scaleX: ctx.getResolvedLayerProperty(layer, "scaleX", resolution),
        scaleY: ctx.getResolvedLayerProperty(layer, "scaleY", resolution),
        x: ctx.getResolvedLayerProperty(layer, "x", resolution),
        y: ctx.getResolvedLayerProperty(layer, "y", resolution),
      },
    })),
    layerIds: target.layerIds,
    operation,
    template,
    time,
  };
}

export function beginCanvasSelectionPreview(
  ctx: ViewerAppContext,
  snapshot: CanvasSelectionGestureSnapshot,
) {
  ctx.state.canvasTransformPreview = {
    awaitingFullRender: false,
    boxes: Object.fromEntries(
      snapshot.entries.map((entry) => [entry.layerId, { ...entry.box }]),
    ),
    templateId: ctx.state.currentTemplate?.id ?? null,
  };
  return createCanvasDragPreview(ctx);
}

export function beginCanvasSelectionTransformCommand(
  ctx: ViewerAppContext,
  snapshot: CanvasSelectionGestureSnapshot,
): void {
  ctx.beginEditorCommand({
    payload: {
      layerIds: snapshot.layerIds,
      operation: snapshot.operation,
    },
    type: "transformLayerSelection",
  });
}

export function scheduleCanvasSelectionTransform(
  ctx: ViewerAppContext,
  preview: ReturnType<typeof createCanvasDragPreview>,
  snapshot: CanvasSelectionGestureSnapshot,
  result: CanvasSelectionTransformResult,
): void {
  preview.scheduleUpdate(() =>
    applyCanvasSelectionTransform(ctx, snapshot, result, {
      inspector: false,
      timeline: false,
    }),
  );
}

export function finalizeCanvasSelectionTransform(
  ctx: ViewerAppContext,
  preview: ReturnType<typeof createCanvasDragPreview>,
  snapshot: CanvasSelectionGestureSnapshot,
  result: CanvasSelectionTransformResult,
): void {
  if (!preview.isCurrent()) {
    preview.finalize();
    return;
  }
  if (ctx.state.dragMoved) {
    preview.finalize(() =>
      applyCanvasSelectionTransform(ctx, snapshot, result, { render: false }),
    );
    void ctx.settlePreviewAfterInteraction();
  } else {
    preview.finalize();
    ctx.updateCanvasSelectionBox();
  }
}

export function applyCanvasSelectionTransform(
  ctx: ViewerAppContext,
  snapshot: CanvasSelectionGestureSnapshot,
  result: CanvasSelectionTransformResult,
  options: any = {},
): void {
  if (ctx.state.canvasTransformPreview?.boxes) {
    ctx.state.canvasTransformPreview.boxes = result.boxes;
  }
  const properties = new Set(OPERATION_PROPERTIES[snapshot.operation]);
  const updates = Object.fromEntries(
    Object.entries(result.updates).map(([layerId, values]) => [
      layerId,
      Object.fromEntries(
        Object.entries(values).filter(([property]) => properties.has(property)),
      ),
    ]),
  );
  ctx.updateLayerPropertyBatchAtTime(snapshot.time, updates, {
    keyframe: true,
    motionPath: false,
    render: false,
    ...options,
  });
}

export function getCanvasSelectionBoxCenter(box) {
  return { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 };
}

export function getOpposingCanvasSelectionCorner(box, handle) {
  return {
    x: handle.includes("w") ? box.x + box.width : box.x,
    y: handle.includes("n") ? box.y + box.height : box.y,
  };
}
