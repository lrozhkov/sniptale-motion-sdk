import {
  createSelectionIndexes,
  normalizePrimarySelectionItem,
  filterSelectionIds,
  parseKeyframeSelectionRef,
} from "./selection-validation.js";
import type {
  KeyframeSelectionRef,
  ViewerSelection,
  ViewerSelectionState,
} from "./selection-model.js";

import type { ViewerAppContext } from "../../app/context.js";
import {
  createLayerHierarchyIndex,
  normalizeLayerSelectionRoots,
} from "../../layers/hierarchy.js";
import { canonicalizeKeyframeSelection } from "./keyframe-selection.js";

export function reconcileTimelineSelection(
  ctx: ViewerAppContext,
  template: unknown = ctx.state.currentTemplate,
): void {
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!effectiveTemplate) {
    resetTimelineSelection(ctx.state);
    return;
  }
  const { layerIds, clipLayerIds, phaseIds, sceneIds, trackById } =
    createSelectionIndexes(effectiveTemplate, ctx.normalizeScenes);

  ctx.state.selectedLayers = filterSelectionIds(
    ctx.state.selectedLayers,
    layerIds,
  );
  const selectedLayers = normalizeLayerSelectionRoots(
    createLayerHierarchyIndex(effectiveTemplate.layers ?? []),
    ctx.state.selectedLayers,
  );
  ctx.state.selectedLayers = selectedLayers;
  ctx.state.selectedClips = filterSelectionIds(
    ctx.state.selectedClips,
    clipLayerIds,
  );
  ctx.state.selectedPhases = filterSelectionIds(
    ctx.state.selectedPhases,
    phaseIds,
  );
  ctx.state.selectedScenes = filterSelectionIds(
    ctx.state.selectedScenes,
    sceneIds,
  );
  ctx.state.selectedKeyframes = canonicalizeKeyframeSelection(
    effectiveTemplate.timeline,
    ctx.state.selectedKeyframes,
  );

  let item = normalizePrimarySelectionItem(
    ctx.state.selectedItem,
    ctx.state.assets,
    {
      clipLayerIds,
      layerIds,
      phaseIds,
      sceneIds,
      trackById,
    },
  );
  if (
    item?.type === "layer" &&
    selectedLayers.length > 0 &&
    !selectedLayers.includes(item.layerId)
  ) {
    const layerId = selectedLayers.at(-1);
    if (layerId) item = { layerId, type: "layer" };
  }
  if (!item || (item.type === "effect" && hasAnySelection(ctx.state))) {
    item = derivePrimaryItem(ctx.state);
  }
  ctx.state.selectedItem = item;
  synchronizePrimaryCollections(ctx.state, item);
}

export function getPrimaryKeyframeSelection<
  State extends { selectedKeyframes?: unknown },
>(state: State): KeyframeSelectionRef | null {
  return parseKeyframeSelectionRef(
    Array.isArray(state.selectedKeyframes)
      ? state.selectedKeyframes.at(-1)
      : null,
  );
}

function derivePrimaryItem(state: ViewerSelectionState): ViewerSelection {
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

function synchronizePrimaryCollections(
  state: ViewerSelectionState,
  item: ViewerSelection,
): void {
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

function appendUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value];
}

function appendUniqueKeyframe(
  values: KeyframeSelectionRef[],
  ref: KeyframeSelectionRef,
): KeyframeSelectionRef[] {
  return values.some(
    (value) =>
      value.trackId === ref.trackId && value.keyframeId === ref.keyframeId,
  )
    ? values
    : [...values, ref];
}

function hasAnySelection(state: ViewerSelectionState): boolean {
  return Boolean(
    state.selectedClips.length ||
    state.selectedLayers.length ||
    state.selectedPhases.length ||
    state.selectedScenes.length ||
    state.selectedKeyframes.length,
  );
}

function clearTimelineCollections(state: ViewerSelectionState): void {
  state.selectedClips = [];
  state.selectedLayers = [];
  state.selectedPhases = [];
  state.selectedScenes = [];
  state.selectedKeyframes = [];
}

function resetTimelineSelection(state: ViewerSelectionState): void {
  clearTimelineCollections(state);
  state.selectedItem = { type: "effect" };
}

export function installTimelineSelectionConsistencyOwner(
  ctx: ViewerAppContext,
): void {
  ctx.reconcileTimelineSelection = reconcileTimelineSelection.bind(null, ctx);
}
