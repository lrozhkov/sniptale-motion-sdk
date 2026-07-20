import type { ViewerAppContext } from "../../app/context.js";
import {
  createLayerHierarchyIndex,
  normalizeLayerSelectionRoots,
} from "../../layers/hierarchy.js";
import { canonicalizeKeyframeSelection } from "./keyframe-selection.js";

export function reconcileTimelineSelection(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
): void {
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!effectiveTemplate) {
    resetTimelineSelection(ctx.state);
    return;
  }
  const layerIds = new Set(
    (effectiveTemplate.layers ?? []).map((layer) => String(layer.id)),
  );
  const clipLayerIds = new Set(
    (effectiveTemplate.clips ?? []).map((clip) => String(clip.layerId)),
  );
  const phaseIds = new Set(
    (effectiveTemplate.timeline?.phases ?? []).map((phase) => String(phase.id)),
  );
  const scenes = ctx.normalizeScenes(
    effectiveTemplate.scenes ?? [],
    effectiveTemplate.duration,
  );
  const sceneIds = new Set(scenes.map((scene) => String(scene.id)));
  const trackById = new Map(
    (effectiveTemplate.timeline?.tracks ?? []).map((track) => [
      String(track.id),
      track,
    ]),
  );

  ctx.state.selectedLayers = filterIds(ctx.state.selectedLayers, layerIds);
  ctx.state.selectedLayers = normalizeLayerSelectionRoots(
    createLayerHierarchyIndex(effectiveTemplate.layers ?? []),
    ctx.state.selectedLayers,
  );
  ctx.state.selectedClips = filterIds(ctx.state.selectedClips, clipLayerIds);
  ctx.state.selectedPhases = filterIds(ctx.state.selectedPhases, phaseIds);
  ctx.state.selectedScenes = filterIds(ctx.state.selectedScenes, sceneIds);
  ctx.state.selectedKeyframes = canonicalizeKeyframeSelection(
    effectiveTemplate.timeline,
    ctx.state.selectedKeyframes,
  );

  let item = normalizePrimaryItem(ctx.state.selectedItem, ctx.state.assets, {
    clipLayerIds,
    layerIds,
    phaseIds,
    sceneIds,
    trackById,
  });
  if (
    item?.type === "layer" &&
    ctx.state.selectedLayers.length > 0 &&
    !ctx.state.selectedLayers.includes(item.layerId)
  ) {
    item = {
      layerId: ctx.state.selectedLayers.at(-1),
      type: "layer",
    };
  }
  if (!item || (item.type === "effect" && hasAnySelection(ctx.state))) {
    item = derivePrimaryItem(ctx.state);
  }
  ctx.state.selectedItem = item;
  synchronizePrimaryCollections(ctx.state, item);
}

export function getPrimaryKeyframeSelection(state) {
  const primary = state.selectedKeyframes?.at?.(-1);
  return primary?.trackId && primary?.keyframeId
    ? {
        keyframeId: String(primary.keyframeId),
        trackId: String(primary.trackId),
      }
    : null;
}

function normalizePrimaryItem(item, assets, indexes) {
  if (!item || typeof item !== "object") {
    return null;
  }
  if (item.type === "effect") {
    return { type: "effect" };
  }
  if (item.type === "layer" && indexes.layerIds.has(String(item.layerId))) {
    return { layerId: String(item.layerId), type: "layer" };
  }
  if (item.type === "clip" && indexes.clipLayerIds.has(String(item.layerId))) {
    return { layerId: String(item.layerId), type: "clip" };
  }
  if (item.type === "phase" && indexes.phaseIds.has(String(item.phaseId))) {
    return { phaseId: String(item.phaseId), type: "phase" };
  }
  if (item.type === "scene" && indexes.sceneIds.has(String(item.sceneId))) {
    return { sceneId: String(item.sceneId), type: "scene" };
  }
  if (item.type === "track" && indexes.trackById.has(String(item.trackId))) {
    return { trackId: String(item.trackId), type: "track" };
  }
  if (
    item.type === "keyframe" &&
    hasKeyframe(indexes.trackById, item.trackId, item.keyframeId)
  ) {
    return {
      keyframeId: String(item.keyframeId),
      trackId: String(item.trackId),
      type: "keyframe",
    };
  }
  if (item.type === "asset" && assets?.has?.(item.assetId)) {
    return { assetId: item.assetId, type: "asset" };
  }
  return null;
}

function derivePrimaryItem(state) {
  const keyframe = state.selectedKeyframes.at(-1);
  if (keyframe) {
    return { ...keyframe, type: "keyframe" };
  }
  const layerId = state.selectedLayers.at(-1);
  if (layerId) {
    return { layerId, type: "layer" };
  }
  const clipLayerId = state.selectedClips.at(-1);
  if (clipLayerId) {
    return { layerId: clipLayerId, type: "clip" };
  }
  const phaseId = state.selectedPhases.at(-1);
  if (phaseId) {
    return { phaseId, type: "phase" };
  }
  const sceneId = state.selectedScenes.at(-1);
  return sceneId ? { sceneId, type: "scene" } : { type: "effect" };
}

function synchronizePrimaryCollections(state, item): void {
  if (item.type === "layer") {
    state.selectedLayers = appendUnique(state.selectedLayers, item.layerId);
    state.selectedClips = [];
  } else if (item.type === "clip") {
    state.selectedClips = appendUnique(state.selectedClips, item.layerId);
    state.selectedLayers = [];
  } else if (item.type === "phase") {
    state.selectedPhases = appendUnique(state.selectedPhases, item.phaseId);
  } else if (item.type === "scene") {
    state.selectedScenes = appendUnique(state.selectedScenes, item.sceneId);
  } else if (item.type === "keyframe") {
    const ref = { keyframeId: item.keyframeId, trackId: item.trackId };
    state.selectedKeyframes = appendUniqueKeyframe(
      state.selectedKeyframes,
      ref,
    );
    state.selectedLayers = [];
  } else if (item.type === "track") {
    clearTimelineCollections(state);
  } else if (item.type === "asset") {
    clearTimelineCollections(state);
  } else if (!hasAnySelection(state)) {
    resetTimelineSelection(state);
    return;
  }
  if (item.type !== "keyframe") {
    state.selectedKeyframes = [];
  }
}

function filterIds(values, allowed): string[] {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .filter((value) => typeof value === "string")
        .filter((value) => allowed.has(value)),
    ),
  ];
}

function hasKeyframe(trackById, trackId, keyframeId): boolean {
  const track = trackById.get(String(trackId));
  return Boolean(
    track?.keyframes?.some(
      (keyframe) => String(keyframe.id) === String(keyframeId),
    ),
  );
}

function appendUnique(values, value): string[] {
  return values.includes(value) ? values : [...values, value];
}

function appendUniqueKeyframe(values, ref): any[] {
  return values.some(
    (value) =>
      value.trackId === ref.trackId && value.keyframeId === ref.keyframeId,
  )
    ? values
    : [...values, ref];
}

function hasAnySelection(state): boolean {
  return Boolean(
    state.selectedClips.length ||
    state.selectedLayers.length ||
    state.selectedPhases.length ||
    state.selectedScenes.length ||
    state.selectedKeyframes.length,
  );
}

function clearTimelineCollections(state): void {
  state.selectedClips = [];
  state.selectedLayers = [];
  state.selectedPhases = [];
  state.selectedScenes = [];
  state.selectedKeyframes = [];
}

function resetTimelineSelection(state): void {
  clearTimelineCollections(state);
  state.selectedItem = { type: "effect" };
}

export function installTimelineSelectionConsistencyOwner(
  ctx: ViewerAppContext,
): void {
  ctx.getPrimaryKeyframeSelection = () =>
    getPrimaryKeyframeSelection(ctx.state);
  ctx.reconcileTimelineSelection = (...args: any[]) =>
    (reconcileTimelineSelection as any)(ctx, ...args);
}
