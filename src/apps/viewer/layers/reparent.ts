import { orderSiblingLayerRoots } from "./hierarchy.js";
import type { LayerHierarchyIndex } from "./hierarchy.js";
import type { EffectLayer } from "../../../sdk/types.js";
import {
  MAX_LAYER_GROUP_DEPTH,
  createLayerHierarchyIndex,
  getLayerDepth,
  getLayerSubtreeIds,
  isLayerGroup,
  isLayerSubtreeContiguous,
  normalizeLayerSelectionRoots,
} from "./hierarchy.js";

export type LayerReparentPosition = "after" | "before" | "inside";

export type LayerReparentResult =
  | {
      layers: EffectLayer[];
      ok: true;
      parentId: string | null;
      rootIds: string[];
    }
  | {
      ok: false;
      reason:
        | "cycle"
        | "different-parents"
        | "invalid-hierarchy"
        | "invalid-target"
        | "non-contiguous"
        | "too-deep";
    };

export function reparentLayerSelection(
  sourceLayers: EffectLayer[],
  selectedLayerIds: string[],
  targetLayerId: string,
  position: LayerReparentPosition,
): LayerReparentResult {
  const hierarchy = createLayerHierarchyIndex(sourceLayers);
  const rootIds = normalizeLayerSelectionRoots(hierarchy, selectedLayerIds);
  const target = hierarchy.byId.get(targetLayerId);
  if (
    rootIds.length === 0 ||
    !target ||
    rootIds.some((id) => !isLayerSubtreeContiguous(hierarchy, id))
  ) {
    return { ok: false, reason: "invalid-hierarchy" };
  }
  const siblings = orderSiblingLayerRoots(hierarchy, rootIds);
  if (!siblings) return { ok: false, reason: "different-parents" };
  const { orderedRootIds } = siblings;
  if (!areLayerRootsContiguous(hierarchy, orderedRootIds)) {
    return { ok: false, reason: "non-contiguous" };
  }
  const movingIds = new Set(
    orderedRootIds.flatMap((id) => getLayerSubtreeIds(hierarchy, id)),
  );
  if (movingIds.has(targetLayerId)) {
    return { ok: false, reason: "cycle" };
  }
  const parentId =
    position === "inside"
      ? isLayerGroup(target)
        ? target.id
        : null
      : (hierarchy.parentById.get(target.id)?.id ?? null);
  if (position === "inside" && !parentId) {
    return { ok: false, reason: "invalid-target" };
  }
  if (!canMoveToLayerDepth(hierarchy, orderedRootIds, parentId)) {
    return { ok: false, reason: "too-deep" };
  }
  const movingLayers = sourceLayers
    .filter((layer) => movingIds.has(layer.id))
    .map((layer) =>
      orderedRootIds.includes(layer.id) ? { ...layer, parentId } : { ...layer },
    );
  const remaining = sourceLayers
    .filter((layer) => !movingIds.has(layer.id))
    .map((layer) => ({ ...layer }));
  const remainingHierarchy = createLayerHierarchyIndex(remaining);
  const targetIndex = remaining.findIndex((layer) => layer.id === target.id);
  if (targetIndex < 0) {
    return { ok: false, reason: "invalid-target" };
  }
  const insertionIndex =
    position === "after"
      ? targetIndex
      : targetIndex + getLayerSubtreeIds(remainingHierarchy, target.id).length;
  remaining.splice(insertionIndex, 0, ...movingLayers);
  if (
    remaining.every(
      (layer, index) =>
        layer.id === sourceLayers[index]?.id &&
        (layer.parentId ?? null) === (sourceLayers[index]?.parentId ?? null),
    )
  ) {
    return { ok: false, reason: "invalid-target" };
  }
  return { layers: remaining, ok: true, parentId, rootIds: orderedRootIds };
}

function areLayerRootsContiguous(
  hierarchy: LayerHierarchyIndex,
  rootIds: readonly string[],
): boolean {
  let previousEnd: number | null = null;
  for (const rootId of rootIds) {
    const indexes = getLayerSubtreeIds(hierarchy, rootId)
      .map((id) => hierarchy.indexById.get(id) ?? -1)
      .sort((left, right) => left - right);
    const start = indexes[0] ?? -1;
    if (previousEnd !== null && start !== previousEnd + 1) {
      return false;
    }
    previousEnd = indexes.at(-1) ?? null;
  }
  return true;
}

function canMoveToLayerDepth(
  hierarchy: LayerHierarchyIndex,
  rootIds: readonly string[],
  parentId: string | null,
): boolean {
  const nextRootDepth = parentId ? getLayerDepth(hierarchy, parentId) + 1 : 0;
  return rootIds.every((rootId) => {
    const rootDepth = getLayerDepth(hierarchy, rootId);
    const relativeDepth = Math.max(
      ...getLayerSubtreeIds(hierarchy, rootId).map(
        (id) => getLayerDepth(hierarchy, id) - rootDepth,
      ),
    );
    return nextRootDepth + relativeDepth <= MAX_LAYER_GROUP_DEPTH;
  });
}
