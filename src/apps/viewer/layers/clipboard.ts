import { bindViewerAction } from "../app/bind-action.js";
import type { LayerOperationActions } from "./actions-contract.js";
import type { EffectLayer } from "../../../sdk/types.js";
import type { EditorTimeline } from "../editor/model-types.js";
import type { TrackLayerSource } from "./model.js";
import type { ViewerAppContext } from "../app/context.js";
import { getLayerSubtreeIds, isLayerGroup } from "./hierarchy.js";
import {
  createUniqueLayerGroupId,
  removeLayerSubtrees,
} from "./hierarchy-operations.js";
import {
  duplicateLayerMotionPaths,
  removeLayerMotionPaths,
} from "./motion-path-remap.js";

function duplicateSelectedLayers(ctx: ViewerAppContext) {
  const source = ctx.state.currentTemplate;
  if (!source) return;
  const template = ctx.getEffectiveTemplate(source);
  if (!template) {
    return;
  }
  const hierarchy = ctx.getLayerHierarchy(template);
  const rootIds = ctx.getSelectedLayerRootIds(template);
  const leafIds = ctx.getSelectedLayerLeafIds(template);
  if (rootIds.length === 0) {
    ctx.logDiagnostic(
      ctx.deps.t(
        "viewer.layers.selectBeforeDuplicate",
        "Select a layer before duplicating.",
      ),
      "error",
    );
    return;
  }
  const blockedLayer = leafIds
    .map((id) => hierarchy.byId.get(id))
    .find(
      (layer) =>
        layer !== undefined &&
        (layer.locked || !ctx.canPerformLayerOperation(layer, "duplicate")),
    );
  if (blockedLayer) {
    ctx.logDiagnostic(
      ctx.deps
        .t(
          "viewer.layers.duplicateUnsupported",
          "{layer} cannot be duplicated because its renderer owns a fixed layer structure.",
        )
        .replace("{layer}", blockedLayer.name || blockedLayer.id),
      "error",
    );
    return;
  }
  const orderedSubtreeIds = rootIds
    .flatMap((id) => getLayerSubtreeIds(hierarchy, id))
    .filter((id, index, ids) => ids.indexOf(id) === index);
  const sourceNodes = template.layers.filter((layer) =>
    orderedSubtreeIds.includes(layer.id),
  );
  const idMap = new Map<string, string>();
  const usedLayers = [...template.layers];
  const duplicateNodes = sourceNodes.map((sourceLayer) => {
    const newLayerId = isLayerGroup(sourceLayer)
      ? createUniqueLayerGroupId(usedLayers)
      : ctx.createDuplicateLayerId(sourceLayer, usedLayers);
    idMap.set(sourceLayer.id, newLayerId);
    const duplicate = {
      ...ctx.deps.deepClone(sourceLayer),
      id: newLayerId,
      locked: false,
      name: ctx.deps
        .t("viewer.layers.copyName", "{name} Copy")
        .replace("{name}", sourceLayer.name || sourceLayer.id),
      ...(isLayerGroup(sourceLayer)
        ? {}
        : {
            x:
              (typeof sourceLayer.x === "number" &&
              Number.isFinite(sourceLayer.x)
                ? sourceLayer.x
                : 0) + 36,
            y:
              (typeof sourceLayer.y === "number" &&
              Number.isFinite(sourceLayer.y)
                ? sourceLayer.y
                : 0) + 36,
          }),
    };
    usedLayers.push(duplicate);
    return duplicate;
  });
  for (const duplicate of duplicateNodes) {
    const parentId = duplicate.parentId
      ? idMap.get(duplicate.parentId)
      : undefined;
    if (parentId !== undefined) duplicate.parentId = parentId;
  }
  const lastSourceIndex = Math.max(
    ...sourceNodes.map((layer) =>
      template.layers.findIndex((candidate) => candidate.id === layer.id),
    ),
  );
  const layers = ctx.deps.deepClone(template.layers);
  layers.splice(lastSourceIndex + 1, 0, ...duplicateNodes);
  const clips = ctx.deps.deepClone(template.clips);
  for (const clip of template.clips ?? []) {
    const nextLayerId = idMap.get(clip.layerId);
    if (nextLayerId) {
      clips.push({ ...ctx.deps.deepClone(clip), layerId: nextLayerId });
    }
  }
  const timeline = ctx.getEffectiveTimeline(ctx.state.currentTemplate);
  for (const sourceLayerId of leafIds) {
    const nextLayerId = idMap.get(sourceLayerId);
    if (nextLayerId) {
      timeline.tracks.push(
        ...ctx.duplicateLayerTracks(timeline, sourceLayerId, nextLayerId),
      );
    }
  }
  timeline.motionPaths = [
    ...(timeline.motionPaths ?? []),
    ...duplicateLayerMotionPaths(timeline.motionPaths, idMap),
  ];
  ctx.beginEditorCommand({
    payload: { layerIds: rootIds },
    type: "duplicateLayers",
  });
  ctx.setEditorOverride({ clips, layers });
  ctx.state.timelineOverrides.set(
    source.id,
    ctx.deps.normalizeTimeline(timeline, template.duration),
  );
  const duplicatedRootIds = rootIds
    .map((id) => idMap.get(id))
    .filter((id): id is string => Boolean(id));
  ctx.setSelectedLayers(duplicatedRootIds, { layers });
  ctx.logDiagnostic(
    ctx.deps
      .t("viewer.layers.duplicatedCount", "Duplicated {count} items.")
      .replace("{count}", String(rootIds.length)),
    "ok",
  );
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  void ctx.renderCurrentFrame();
}

function duplicateSelectedLayer(ctx: ViewerAppContext) {
  return ctx.duplicateSelectedLayers();
}

function createDuplicateLayerId(
  ctx: ViewerAppContext,
  layer: EffectLayer,
  layers: readonly EffectLayer[],
) {
  const base =
    layer.type === "text" ||
    layer.type === "rect" ||
    layer.type === "ellipse" ||
    layer.type === "line" ||
    layer.type === "path" ||
    layer.type === "svgAsset" ||
    layer.type === "imageAsset"
      ? layer.type
      : `${ctx.sanitizeIdentifier(layer.id || "layer")}-copy`;
  return ctx.createUniqueLayerId(base, layers);
}

function duplicateLayerTracks(
  ctx: ViewerAppContext,
  timeline: EditorTimeline,
  sourceLayerId: string,
  newLayerId: string,
) {
  return (timeline.tracks ?? [])
    .filter((track) => ctx.isTrackOwnedByLayer(track, sourceLayerId))
    .map((track) => {
      const property =
        track.property || track.id.slice(sourceLayerId.length + 1);
      const nextTrackId = `${newLayerId}.${property || "value"}`;
      return {
        ...ctx.deps.deepClone(track),
        id: nextTrackId,
        label:
          typeof track.label === "string" && track.label.trim()
            ? track.label.replace(sourceLayerId, newLayerId)
            : "",
        keyframes: (track.keyframes ?? []).map((keyframe) => ({
          ...ctx.deps.deepClone(keyframe),
          id: (keyframe.id || "keyframe").replace(sourceLayerId, newLayerId),
          value:
            (property === "x" || property === "y") &&
            typeof keyframe.value === "number"
              ? keyframe.value + 36
              : keyframe.value,
        })),
        layerId: newLayerId,
        target: newLayerId,
      };
    });
}

function deleteSelectedLayers(ctx: ViewerAppContext) {
  const source = ctx.state.currentTemplate;
  if (!source) return;
  const template = ctx.getEffectiveTemplate(source);
  if (!template) {
    return;
  }
  const hierarchy = ctx.getLayerHierarchy(template);
  const rootIds = ctx.getSelectedLayerRootIds(template);
  const leafIds = ctx.getSelectedLayerLeafIds(template);
  if (rootIds.length === 0) {
    ctx.logDiagnostic(
      ctx.deps.t(
        "viewer.layers.selectBeforeDelete",
        "Select a layer before deleting.",
      ),
      "error",
    );
    return;
  }
  const blockedLayer = leafIds
    .map((id) => hierarchy.byId.get(id))
    .find(
      (layer) =>
        layer !== undefined &&
        (layer.locked || !ctx.canPerformLayerOperation(layer, "delete")),
    );
  if (blockedLayer) {
    ctx.logDiagnostic(
      ctx.deps
        .t(
          "viewer.layers.deleteUnsupported",
          "{layer} cannot be deleted from this renderer.",
        )
        .replace("{layer}", blockedLayer.name || blockedLayer.id),
      "error",
    );
    return;
  }
  const removed = removeLayerSubtrees(template.layers, rootIds);
  const removedIds = new Set(removed.removedIds);
  const timeline = ctx.getEffectiveTimeline(ctx.state.currentTemplate);
  const clips = ctx.deps
    .deepClone(template.clips)
    .filter((clip) => !removedIds.has(clip.layerId));
  timeline.tracks = timeline.tracks.filter(
    (track) =>
      ![...removedIds].some((layerId) =>
        ctx.isTrackOwnedByLayer(track, layerId),
      ),
  );
  timeline.motionPaths = removeLayerMotionPaths(
    timeline.motionPaths,
    removedIds,
  );
  ctx.beginEditorCommand({
    payload: { layerIds: rootIds },
    type: "deleteLayers",
  });
  ctx.setEditorOverride({ clips, layers: removed.layers });
  ctx.state.timelineOverrides.set(
    source.id,
    ctx.deps.normalizeTimeline(timeline, template.duration),
  );
  ctx.clearTimelineSelection();
  ctx.logDiagnostic(
    ctx.deps
      .t("viewer.layers.deletedCount", "Deleted {count} items.")
      .replace("{count}", String(rootIds.length)),
    "ok",
  );
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  ctx.renderAssetsPanel(ctx.state.currentTemplate);
  void ctx.renderCurrentFrame();
}

function deleteSelectedLayer(ctx: ViewerAppContext) {
  return ctx.deleteSelectedLayers();
}

function isTrackOwnedByLayer(track: TrackLayerSource, layerId: string) {
  return (
    track?.layerId === layerId ||
    track?.target === layerId ||
    (track?.id || "").startsWith(`${layerId}.`)
  );
}

export function createLayerClipboardActions(
  getContext: () => ViewerAppContext,
): Pick<
  LayerOperationActions,
  | "duplicateSelectedLayers"
  | "duplicateSelectedLayer"
  | "createDuplicateLayerId"
  | "duplicateLayerTracks"
  | "deleteSelectedLayers"
  | "deleteSelectedLayer"
  | "isTrackOwnedByLayer"
> {
  return {
    duplicateSelectedLayers: bindViewerAction(
      duplicateSelectedLayers,
      getContext,
    ),
    duplicateSelectedLayer: bindViewerAction(
      duplicateSelectedLayer,
      getContext,
    ),
    createDuplicateLayerId: bindViewerAction(
      createDuplicateLayerId,
      getContext,
    ),
    duplicateLayerTracks: bindViewerAction(duplicateLayerTracks, getContext),
    deleteSelectedLayers: bindViewerAction(deleteSelectedLayers, getContext),
    deleteSelectedLayer: bindViewerAction(deleteSelectedLayer, getContext),
    isTrackOwnedByLayer,
  };
}
