import { orderSiblingLayerRoots } from "./hierarchy.js";
import type { EffectLayer } from "../../../sdk/types.js";
import {
  LAYER_GROUP_TYPE,
  MAX_LAYER_GROUP_DEPTH,
  createLayerHierarchyIndex,
  getLayerDepth,
  getLayerSubtreeIds,
  isLayerGroup,
  isLayerSubtreeContiguous,
  normalizeLayerSelectionRoots,
} from "./hierarchy.js";

export type LayerGroupingCheck =
  | {
      ok: true;
      orderedRootIds: string[];
      parentId: string | null;
      startIndex: number;
    }
  | {
      ok: false;
      reason:
        | "different-parents"
        | "invalid-hierarchy"
        | "non-contiguous"
        | "selection-too-small"
        | "too-deep";
    };

export function canGroupLayerSelection(
  sourceLayers: EffectLayer[],
  selectedLayerIds: string[],
): LayerGroupingCheck {
  const hierarchy = createLayerHierarchyIndex(sourceLayers);
  const rootIds = normalizeLayerSelectionRoots(hierarchy, selectedLayerIds);
  if (rootIds.length < 2) {
    return { ok: false, reason: "selection-too-small" };
  }
  if (rootIds.some((id) => !isLayerSubtreeContiguous(hierarchy, id))) {
    return { ok: false, reason: "invalid-hierarchy" };
  }
  const siblings = orderSiblingLayerRoots(hierarchy, rootIds);
  if (!siblings) return { ok: false, reason: "different-parents" };
  const { parentIds, orderedRootIds } = siblings;
  let previousEnd = -1;
  for (const id of orderedRootIds) {
    const indexes = getLayerSubtreeIds(hierarchy, id)
      .map((subtreeId) => hierarchy.indexById.get(subtreeId) ?? -1)
      .sort((a, b) => a - b);
    const start = indexes[0] ?? -1;
    const end = indexes[indexes.length - 1] ?? -1;
    if (previousEnd >= 0 && start !== previousEnd + 1) {
      return { ok: false, reason: "non-contiguous" };
    }
    previousEnd = end;
  }
  const parentId = [...parentIds][0] ?? null;
  const parentDepth = parentId ? getLayerDepth(hierarchy, parentId) + 1 : 0;
  const deepestSelectedDepth = Math.max(
    ...orderedRootIds.flatMap((id) =>
      getLayerSubtreeIds(hierarchy, id).map(
        (subtreeId) => getLayerDepth(hierarchy, subtreeId) - parentDepth,
      ),
    ),
  );
  if (parentDepth + 1 + deepestSelectedDepth > MAX_LAYER_GROUP_DEPTH) {
    return { ok: false, reason: "too-deep" };
  }
  return {
    ok: true,
    orderedRootIds,
    parentId,
    startIndex: hierarchy.indexById.get(orderedRootIds[0] ?? "") ?? 0,
  };
}

export function groupLayerSelection(
  sourceLayers: EffectLayer[],
  selectedLayerIds: string[],
  groupLayer: EffectLayer,
): EffectLayer[] {
  const check = canGroupLayerSelection(sourceLayers, selectedLayerIds);
  if (!check.ok || !isLayerGroup(groupLayer)) {
    return sourceLayers;
  }
  const selectedRoots = new Set(check.orderedRootIds);
  const layers = sourceLayers.map((layer) =>
    selectedRoots.has(layer.id)
      ? { ...layer, parentId: groupLayer.id }
      : { ...layer },
  );
  layers.splice(check.startIndex, 0, {
    ...groupLayer,
    parentId: check.parentId,
    type: LAYER_GROUP_TYPE,
  });
  return layers;
}

export function ungroupLayerSelection(
  sourceLayers: EffectLayer[],
  selectedLayerIds: string[],
): EffectLayer[] {
  const hierarchy = createLayerHierarchyIndex(sourceLayers);
  const groupIds = new Set(
    normalizeLayerSelectionRoots(hierarchy, selectedLayerIds).filter((id) =>
      isLayerGroup(hierarchy.byId.get(id)),
    ),
  );
  if (groupIds.size === 0) {
    return sourceLayers;
  }
  const parentByGroupId = new Map(
    [...groupIds].map((groupId) => [
      groupId,
      hierarchy.parentById.get(groupId)?.id ?? null,
    ]),
  );
  return sourceLayers
    .filter((layer) => !groupIds.has(layer.id))
    .map((layer) =>
      layer.parentId && groupIds.has(layer.parentId)
        ? { ...layer, parentId: parentByGroupId.get(layer.parentId) ?? null }
        : { ...layer },
    );
}

export function removeLayerSubtrees(
  sourceLayers: EffectLayer[],
  selectedLayerIds: string[],
): { layers: EffectLayer[]; removedIds: string[] } {
  const hierarchy = createLayerHierarchyIndex(sourceLayers);
  const removedIds = normalizeLayerSelectionRoots(
    hierarchy,
    selectedLayerIds,
  ).flatMap((id) => getLayerSubtreeIds(hierarchy, id));
  const removed = new Set(removedIds);
  return {
    layers: sourceLayers
      .filter((layer) => !removed.has(layer.id))
      .map((layer) =>
        layer.parentId && removed.has(layer.parentId)
          ? { ...layer, parentId: null }
          : { ...layer },
      ),
    removedIds,
  };
}

export function createUniqueLayerGroupId(
  sourceLayers: EffectLayer[],
  baseId = "group",
): string {
  const ids = new Set(sourceLayers.map((layer) => layer.id));
  let suffix = 1;
  let id = `${baseId}-${suffix}`;
  while (ids.has(id)) {
    suffix += 1;
    id = `${baseId}-${suffix}`;
  }
  return id;
}
