import { isRangeInvalid } from "./ranges.js";
import {
  MAX_LAYER_GROUP_DEPTH,
  createLayerHierarchyIndex,
  getLayerAncestorIds,
  hasLayerHierarchyCycle,
  isLayerGroup,
  isLayerSubtreeContiguous,
} from "../layers/hierarchy.js";

export function collectLayerIssues(template, knownAssetIds, addIssue) {
  const layerIds = new Set<string>();
  for (const layer of template.layers ?? []) {
    if (!layer?.id) {
      addIssue("Layer is missing id", {
        messageKey: "layerMissingId",
        targetType: "layer",
      });
      continue;
    }
    if (layerIds.has(layer.id)) {
      addIssue(`Duplicate layer id "${layer.id}"`, {
        messageKey: "duplicateLayerId",
        messageParams: { id: layer.id },
        targetId: layer.id,
        targetType: "layer",
      });
    }
    layerIds.add(layer.id);
  }

  for (const layer of template.layers ?? []) {
    if (layer.parentId && !layerIds.has(layer.parentId)) {
      addIssue(
        `Layer "${layer.id}" references missing parent "${layer.parentId}"`,
        {
          messageKey: "layerMissingParent",
          messageParams: { layer: layer.id, parent: layer.parentId },
          targetId: layer.id,
          targetType: "layer",
        },
      );
    }
    if (layer.parentId && layer.parentId === layer.id) {
      addIssue(`Layer "${layer.id}" cannot parent itself`, {
        messageKey: "layerSelfParent",
        messageParams: { layer: layer.id },
        targetId: layer.id,
        targetType: "layer",
      });
    }
    const parent = layer.parentId
      ? (template.layers ?? []).find((item) => item.id === layer.parentId)
      : null;
    if (parent && !isLayerGroup(parent)) {
      addIssue(
        `Layer "${layer.id}" references non-group parent "${parent.id}"`,
        {
          messageKey: "layerParentNotGroup",
          messageParams: { layer: layer.id, parent: parent.id },
          targetId: layer.id,
          targetType: "layer",
        },
      );
    }
    if (
      (layer.type === "svgAsset" || layer.type === "imageAsset") &&
      (!layer.assetId || !knownAssetIds.has(layer.assetId))
    ) {
      addIssue(
        `Layer "${layer.id}" references missing asset "${layer.assetId ?? "(missing)"}"`,
        {
          messageKey: "layerMissingAsset",
          messageParams: {
            asset: layer.assetId ?? "(missing)",
            layer: layer.id,
          },
          targetId: layer.id,
          targetType: "layer",
        },
      );
    }
  }
  collectLayerHierarchyIssues(template, addIssue);
  return layerIds;
}

function collectLayerHierarchyIssues(template, addIssue): void {
  const layers = template.layers ?? [];
  const hierarchy = createLayerHierarchyIndex(layers);
  const groupIds = new Set(
    layers.filter((layer) => isLayerGroup(layer)).map((layer) => layer.id),
  );
  for (const layer of layers) {
    const ancestors = getLayerAncestorIds(hierarchy, layer.id);
    if (layer.parentId && hasLayerHierarchyCycle(hierarchy, layer.id)) {
      addIssue(`Layer hierarchy contains a cycle at "${layer.id}"`, {
        messageKey: "layerHierarchyCycle",
        messageParams: { layer: layer.id },
        targetId: layer.id,
        targetType: "layer",
      });
    }
    if (ancestors.length > MAX_LAYER_GROUP_DEPTH) {
      addIssue(
        `Layer "${layer.id}" exceeds maximum group depth ${MAX_LAYER_GROUP_DEPTH}`,
        {
          messageKey: "layerGroupDepth",
          messageParams: {
            depth: String(MAX_LAYER_GROUP_DEPTH),
            layer: layer.id,
          },
          targetId: layer.id,
          targetType: "layer",
        },
      );
    }
    if (isLayerGroup(layer) && !isLayerSubtreeContiguous(hierarchy, layer.id)) {
      addIssue(`Group "${layer.id}" has a non-contiguous layer subtree`, {
        messageKey: "layerGroupNonContiguous",
        messageParams: { group: layer.id },
        targetId: layer.id,
        targetType: "layer",
      });
    }
  }
  for (const clip of template.clips ?? []) {
    if (groupIds.has(clip.layerId)) {
      addIssue(`Group "${clip.layerId}" cannot own a clip`, {
        messageKey: "layerGroupClip",
        messageParams: { group: clip.layerId },
        targetId: clip.layerId,
        targetType: "clip",
      });
    }
  }
  for (const track of template.timeline?.tracks ?? []) {
    const layerId =
      typeof track.layerId === "string"
        ? track.layerId
        : typeof track.target === "string" && track.target !== "scene"
          ? track.target
          : typeof track.id === "string" && track.id.includes(".")
            ? track.id.split(".")[0]
            : null;
    if (layerId && groupIds.has(layerId)) {
      addIssue(`Group "${layerId}" cannot own animation track "${track.id}"`, {
        messageKey: "layerGroupTrack",
        messageParams: { group: layerId, track: track.id },
        targetId: track.id,
        targetType: "track",
        trackId: track.id,
      });
    }
  }
}

export function collectClipBaseIssues(template, duration, layerIds, addIssue) {
  for (const clip of template.clips ?? []) {
    if (!clip?.layerId || !layerIds.has(clip.layerId)) {
      addIssue(
        `Clip references missing layer "${clip?.layerId ?? "(missing)"}"`,
        {
          messageKey: "clipMissingLayer",
          messageParams: { layer: clip?.layerId ?? "(missing)" },
          targetId: clip?.layerId ?? null,
          targetType: "clip",
        },
      );
    }
    if (
      isRangeInvalid(
        Number(clip.start) || 0,
        Number(clip.duration) || 0,
        duration,
      )
    ) {
      addIssue(
        `Clip "${clip.layerId ?? "(missing)"}" is outside effect duration`,
        {
          messageKey: "clipOutsideEffect",
          messageParams: { clip: clip.layerId ?? "(missing)" },
          targetId: clip.layerId ?? null,
          targetType: "clip",
        },
      );
    }
  }
}
