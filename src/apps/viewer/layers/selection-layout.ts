import type { ViewerAppContext } from "../app/context.js";
import { getAxisAlignedCanvasBox } from "../canvas/selection-bounds.js";
import { createCanvasSelectionGestureSnapshot } from "../canvas/selection-transform-state.js";

export type LayerAlignment =
  | "bottom"
  | "horizontal-center"
  | "left"
  | "right"
  | "top"
  | "vertical-center";

function alignLayerSelection(ctx: ViewerAppContext, alignment: LayerAlignment) {
  const snapshot = createCanvasSelectionGestureSnapshot(ctx, "move");
  if (!snapshot) {
    return reportUnavailableSelectionLayout(ctx);
  }
  const updates = createLayerAlignmentUpdates(
    snapshot.entries,
    snapshot.bounds.box,
    alignment,
  );
  applyLayerLayoutUpdates(ctx, snapshot, updates, "alignLayers", {
    alignment,
  });
  return true;
}

function distributeLayerSelection(
  ctx: ViewerAppContext,
  axis: "horizontal" | "vertical",
) {
  const snapshot = createCanvasSelectionGestureSnapshot(ctx, "move");
  if (!snapshot || snapshot.entries.length < 3) {
    return reportUnavailableSelectionLayout(ctx);
  }
  const updates = createLayerDistributionUpdates(snapshot.entries, axis);
  applyLayerLayoutUpdates(ctx, snapshot, updates, "distributeLayers", {
    axis,
  });
  return true;
}

export function createLayerAlignmentUpdates(
  entries,
  selectionBox,
  alignment: LayerAlignment,
) {
  return Object.fromEntries(
    entries.map((entry) => {
      const box = getAxisAlignedCanvasBox(entry.box, entry.pivot);
      const dx =
        alignment === "left"
          ? selectionBox.x - box.x
          : alignment === "horizontal-center"
            ? selectionBox.x +
              selectionBox.width * 0.5 -
              (box.x + box.width * 0.5)
            : alignment === "right"
              ? selectionBox.x + selectionBox.width - (box.x + box.width)
              : 0;
      const dy =
        alignment === "top"
          ? selectionBox.y - box.y
          : alignment === "vertical-center"
            ? selectionBox.y +
              selectionBox.height * 0.5 -
              (box.y + box.height * 0.5)
            : alignment === "bottom"
              ? selectionBox.y + selectionBox.height - (box.y + box.height)
              : 0;
      return [
        entry.layerId,
        { x: entry.values.x + dx, y: entry.values.y + dy },
      ];
    }),
  );
}

export function createLayerDistributionUpdates(
  entries,
  axis: "horizontal" | "vertical",
) {
  const startProperty = axis === "horizontal" ? "x" : "y";
  const sizeProperty = axis === "horizontal" ? "width" : "height";
  const ordered = entries
    .map((entry) => ({
      bounds: getAxisAlignedCanvasBox(entry.box, entry.pivot),
      entry,
    }))
    .sort(
      (left, right) => left.bounds[startProperty] - right.bounds[startProperty],
    );
  const first = ordered[0].bounds[startProperty];
  const lastEnd =
    ordered.at(-1).bounds[startProperty] + ordered.at(-1).bounds[sizeProperty];
  const totalSize = ordered.reduce(
    (sum, item) => sum + item.bounds[sizeProperty],
    0,
  );
  const gap = (lastEnd - first - totalSize) / (ordered.length - 1);
  let cursor = first;
  return Object.fromEntries(
    ordered.map(({ bounds, entry }) => {
      const delta = cursor - bounds[startProperty];
      cursor += bounds[sizeProperty] + gap;
      return [
        entry.layerId,
        axis === "horizontal"
          ? { x: entry.values.x + delta, y: entry.values.y }
          : { x: entry.values.x, y: entry.values.y + delta },
      ];
    }),
  );
}

function applyLayerLayoutUpdates(ctx, snapshot, updates, type, payload): void {
  ctx.beginEditorCommand({
    payload: { layerIds: snapshot.layerIds, ...payload },
    type,
  });
  ctx.updateLayerPropertyBatchAtTime(snapshot.time, updates, {
    keyframe: true,
    motionPath: false,
  });
}

function reportUnavailableSelectionLayout(ctx): false {
  ctx.logDiagnostic(
    ctx.deps.t(
      "viewer.inspector.selection.operationUnavailable",
      "This operation requires every selected layer to be active, unlocked, and spatial.",
    ),
    "error",
  );
  return false;
}

export function installLayersSelectionLayoutOwner(ctx: ViewerAppContext): void {
  ctx.alignLayerSelection = (...args: any[]) =>
    (alignLayerSelection as any)(ctx, ...args);
  ctx.distributeLayerSelection = (...args: any[]) =>
    (distributeLayerSelection as any)(ctx, ...args);
}
