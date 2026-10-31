import { bindViewerAction } from "../app/bind-action.js";
import type {
  LayerOperationActions,
  LayerAlignment,
} from "./actions-contract.js";
import type { CanvasSelectionTransformEntry } from "../canvas/selection-transform-math.js";
import type { CanvasSelectionGestureSnapshot } from "../canvas/selection-transform-state.js";
import type { CanvasRect } from "../canvas/geometry-contract.js";
import type { CanvasPropertyUpdates } from "../canvas/contract.js";
import type { ViewerAppContext } from "../app/context.js";
import { getAxisAlignedCanvasBox } from "../canvas/selection-bounds.js";
import { createCanvasSelectionGestureSnapshot } from "../canvas/selection-transform-state.js";

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
  entries: readonly CanvasSelectionTransformEntry[],
  selectionBox: CanvasRect,
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
  entries: readonly CanvasSelectionTransformEntry[],
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
  const firstEntry = ordered[0];
  const lastEntry = ordered.at(-1);
  if (!firstEntry || !lastEntry || ordered.length < 3) return {};
  const first = firstEntry.bounds[startProperty];
  const lastEnd =
    lastEntry.bounds[startProperty] + lastEntry.bounds[sizeProperty];
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

function applyLayerLayoutUpdates(
  ctx: ViewerAppContext,
  snapshot: CanvasSelectionGestureSnapshot,
  updates: Record<string, CanvasPropertyUpdates>,
  type: "alignLayers" | "distributeLayers",
  payload: Record<string, string>,
): void {
  ctx.beginEditorCommand({
    payload: { layerIds: snapshot.layerIds, ...payload },
    type,
  });
  ctx.updateLayerPropertyBatchAtTime(snapshot.time, updates, {
    keyframe: true,
    motionPath: false,
  });
}

function reportUnavailableSelectionLayout(ctx: ViewerAppContext): false {
  ctx.logDiagnostic(
    ctx.deps.t(
      "viewer.inspector.selection.operationUnavailable",
      "This operation requires every selected layer to be active, unlocked, and spatial.",
    ),
    "error",
  );
  return false;
}

export function createLayerLayoutActions(
  getContext: () => ViewerAppContext,
): Pick<
  LayerOperationActions,
  "alignLayerSelection" | "distributeLayerSelection"
> {
  return {
    alignLayerSelection: bindViewerAction(alignLayerSelection, getContext),
    distributeLayerSelection: bindViewerAction(
      distributeLayerSelection,
      getContext,
    ),
  };
}
