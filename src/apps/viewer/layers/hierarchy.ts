export const LAYER_GROUP_TYPE = "group";
export const MAX_LAYER_GROUP_DEPTH = 8;

export type LayerHierarchyNode = Record<string, unknown> & { id: string };

export type LayerHierarchyIndex<
  T extends LayerHierarchyNode = LayerHierarchyNode,
> = {
  readonly byId: ReadonlyMap<string, T>;
  readonly childrenByParentId: ReadonlyMap<string | null, readonly T[]>;
  readonly indexById: ReadonlyMap<string, number>;
  readonly layers: readonly T[];
  readonly parentById: ReadonlyMap<string, T | null>;
};

export function isLayerGroup(
  layer: unknown,
): layer is LayerHierarchyNode & { type: typeof LAYER_GROUP_TYPE } {
  return isHierarchyNode(layer) && layer.type === LAYER_GROUP_TYPE;
}

export function createLayerHierarchyIndex<T extends LayerHierarchyNode>(
  sourceLayers: readonly T[],
): LayerHierarchyIndex<T>;
export function createLayerHierarchyIndex(
  sourceLayers: unknown,
): LayerHierarchyIndex;
export function createLayerHierarchyIndex(
  sourceLayers: unknown,
): LayerHierarchyIndex {
  const values: unknown[] = Array.isArray(sourceLayers) ? sourceLayers : [];
  const layers = values.filter(isHierarchyNode);
  const byId = new Map<string, LayerHierarchyNode>();
  const indexById = new Map<string, number>();
  for (const [index, layer] of layers.entries()) {
    if (!byId.has(layer.id)) {
      byId.set(layer.id, layer);
      indexById.set(layer.id, index);
    }
  }
  const childrenByParentId = new Map<string | null, LayerHierarchyNode[]>();
  const parentById = new Map<string, LayerHierarchyNode | null>();
  for (const layer of layers) {
    const parentId =
      typeof layer.parentId === "string" && byId.has(layer.parentId)
        ? layer.parentId
        : null;
    const parent = parentId ? (byId.get(parentId) ?? null) : null;
    parentById.set(layer.id, parent);
    const children = childrenByParentId.get(parentId) ?? [];
    children.push(layer);
    childrenByParentId.set(parentId, children);
  }
  return { byId, childrenByParentId, indexById, layers, parentById };
}

function isHierarchyNode(value: unknown): value is LayerHierarchyNode {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "id" in value &&
    typeof value.id === "string"
  );
}

export function getLayerAncestorIds(
  hierarchy: LayerHierarchyIndex,
  layerId: string,
): string[] {
  const result: string[] = [];
  const visited = new Set<string>([layerId]);
  let parent = hierarchy.parentById.get(layerId) ?? null;
  while (parent && !visited.has(parent.id)) {
    visited.add(parent.id);
    result.push(parent.id);
    parent = hierarchy.parentById.get(parent.id) ?? null;
  }
  return result;
}

export function hasLayerHierarchyCycle(
  hierarchy: LayerHierarchyIndex,
  layerId: string,
): boolean {
  const visited = new Set<string>();
  let currentId: string | null = layerId;
  while (currentId) {
    if (visited.has(currentId)) {
      return true;
    }
    visited.add(currentId);
    currentId = hierarchy.parentById.get(currentId)?.id ?? null;
  }
  return false;
}

export function getLayerSubtreeIds(
  hierarchy: LayerHierarchyIndex,
  layerId: string,
): string[] {
  if (!hierarchy.byId.has(layerId)) {
    return [];
  }
  const result: string[] = [];
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id)) {
      return;
    }
    visited.add(id);
    result.push(id);
    for (const child of hierarchy.childrenByParentId.get(id) ?? []) {
      visit(child.id);
    }
  };
  visit(layerId);
  return result;
}

export function getLayerLeafIds(
  hierarchy: LayerHierarchyIndex,
  layerIds: string[],
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const rootId of normalizeLayerSelectionRoots(hierarchy, layerIds)) {
    for (const id of getLayerSubtreeIds(hierarchy, rootId)) {
      const layer = hierarchy.byId.get(id);
      if (layer && !isLayerGroup(layer) && !seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
  }
  return result;
}

export function normalizeLayerSelectionRoots(
  hierarchy: LayerHierarchyIndex,
  layerIds: string[],
): string[] {
  const ids = [
    ...new Set(
      (Array.isArray(layerIds) ? layerIds : []).filter((id) =>
        hierarchy.byId.has(id),
      ),
    ),
  ];
  const selected = new Set(ids);
  return ids.filter(
    (id) =>
      !getLayerAncestorIds(hierarchy, id).some((ancestorId) =>
        selected.has(ancestorId),
      ),
  );
}

export function getLayerDepth(
  hierarchy: LayerHierarchyIndex,
  layerId: string,
): number {
  return getLayerAncestorIds(hierarchy, layerId).length;
}

export function isLayerSubtreeContiguous(
  hierarchy: LayerHierarchyIndex,
  layerId: string,
): boolean {
  const subtreeIds = getLayerSubtreeIds(hierarchy, layerId);
  const indexes = subtreeIds
    .map((id) => hierarchy.indexById.get(id))
    .filter((index): index is number => index !== undefined)
    .sort((a, b) => a - b);
  const rootIndex = hierarchy.indexById.get(layerId);
  if (
    rootIndex === undefined ||
    indexes.length !== subtreeIds.length ||
    indexes[0] !== rootIndex
  ) {
    return false;
  }
  return indexes.every((index, offset) => index === rootIndex + offset);
}
