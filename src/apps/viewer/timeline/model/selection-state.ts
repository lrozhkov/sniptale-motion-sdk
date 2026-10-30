import type { ViewerAppContext } from "../../app/context.js";
import {
  createLayerHierarchyIndex,
  normalizeLayerSelectionRoots,
} from "../../layers/hierarchy.js";
import { canonicalizeKeyframeSelection } from "./keyframe-selection.js";

function clearTimelineSelection(ctx: ViewerAppContext) {
  ctx.state.selectedItem = { type: "effect" };
  ctx.state.selectedClips = [];
  ctx.state.selectedLayers = [];
  ctx.state.selectedPhases = [];
  ctx.state.selectedScenes = [];
  ctx.state.selectedKeyframes = [];
  syncCanvasSelection(ctx);
}

function selectLayer(ctx: ViewerAppContext, layerId, event = null) {
  ctx.state.selectedLayers = resolveSelectionValues(
    ctx,
    ctx.state.selectedLayers,
    layerId,
    event,
  );
  const template = ctx.getEffectiveTemplate?.(ctx.state.currentTemplate);
  if (template) {
    ctx.state.selectedLayers = normalizeLayerSelectionRoots(
      createLayerHierarchyIndex(template.layers),
      ctx.state.selectedLayers,
    );
  }
  clearSelectionCollections(ctx, "layer");
  ctx.state.selectedItem = resolvePrimarySelectionItem(
    "layer",
    "layerId",
    ctx.state.selectedLayers,
  );
  ctx.setSidebarGroup("inspect");
  ctx.syncTimelineSelection(ctx.state.currentTemplate);
}

function selectClipBlock(ctx: ViewerAppContext, layerId, event = null) {
  ctx.state.selectedClips = resolveSelectionValues(
    ctx,
    ctx.state.selectedClips,
    layerId,
    event,
  );
  clearSelectionCollections(ctx, "clip");
  ctx.state.selectedItem = resolvePrimarySelectionItem(
    "clip",
    "layerId",
    ctx.state.selectedClips,
  );
  ctx.setSidebarGroup("inspect");
  ctx.syncTimelineSelection(ctx.state.currentTemplate);
}

function selectPhaseBlock(ctx: ViewerAppContext, phaseId, event = null) {
  ctx.state.selectedPhases = resolveSelectionValues(
    ctx,
    ctx.state.selectedPhases,
    phaseId,
    event,
  );
  clearSelectionCollections(ctx, "phase");
  ctx.state.selectedItem = resolvePrimarySelectionItem(
    "phase",
    "phaseId",
    ctx.state.selectedPhases,
  );
  ctx.setSidebarGroup("inspect");
  ctx.syncTimelineSelection(ctx.state.currentTemplate);
}

function selectSceneBlock(ctx: ViewerAppContext, sceneId, event = null) {
  const wasExpanded = ctx.isSceneExpanded(sceneId);
  ctx.state.selectedScenes = resolveSelectionValues(
    ctx,
    ctx.state.selectedScenes,
    sceneId,
    event,
  );
  clearSelectionCollections(ctx, "scene");
  ctx.state.selectedItem = resolvePrimarySelectionItem(
    "scene",
    "sceneId",
    ctx.state.selectedScenes,
  );
  ctx.state.expandedSceneIds.add(sceneId);
  ctx.setSidebarGroup("inspect");
  if (wasExpanded) {
    ctx.syncTimelineSelection(ctx.state.currentTemplate);
  } else {
    ctx.renderTimelineStructure(ctx.state.currentTemplate);
    ctx.syncTimelineSelection(ctx.state.currentTemplate);
  }
}

function selectTrackLane(ctx: ViewerAppContext, trackId) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template?.timeline?.tracks?.some((track) => track.id === trackId)) {
    return;
  }
  clearSelectionCollections(ctx, "track");
  ctx.state.selectedItem = { trackId, type: "track" };
  ctx.setSidebarGroup("inspect");
  ctx.syncTimelineSelection(ctx.state.currentTemplate);
}

function toggleSelectionValue(ctx: ViewerAppContext, values, value) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function resolveSelectionValues(ctx, values, value, event) {
  return event?.shiftKey || event?.metaKey || event?.ctrlKey
    ? ctx.toggleSelectionValue(values, value)
    : [value];
}

export function resolvePrimarySelectionItem(type, idProperty, values) {
  const primary = values[values.length - 1];
  return primary ? { [idProperty]: primary, type } : { type: "effect" };
}

function clearSelectionCollections(ctx, keep = null) {
  if (keep !== "clip") ctx.state.selectedClips = [];
  if (keep !== "layer") ctx.state.selectedLayers = [];
  if (keep !== "phase") ctx.state.selectedPhases = [];
  if (keep !== "scene") ctx.state.selectedScenes = [];
  if (keep !== "keyframe") ctx.state.selectedKeyframes = [];
}

function selectKeyframe(
  ctx: ViewerAppContext,
  trackId,
  keyframeId,
  event = null,
) {
  const ref = { keyframeId, trackId };
  if (event?.shiftKey || event?.metaKey || event?.ctrlKey) {
    toggleKeyframeSelection(ctx, ref, { render: false });
  } else {
    setSelectedKeyframes(ctx, [ref], { render: false });
  }
  ctx.setSidebarGroup("inspect");
  ctx.syncTimelineSelection(ctx.state.currentTemplate);
}

function syncCanvasSelection(ctx: ViewerAppContext) {
  ctx.updateCanvasSelectionBox?.();
}

function isSelectedKeyframe(ctx: ViewerAppContext, trackId, keyframeId) {
  return ctx.state.selectedKeyframes.some(
    (item) => item.trackId === trackId && item.keyframeId === keyframeId,
  );
}

function isSelectedClip(ctx: ViewerAppContext, layerId) {
  return ctx.state.selectedClips.includes(layerId);
}

function isSelectedLayer(ctx: ViewerAppContext, layerId) {
  return ctx.state.selectedLayers.includes(layerId);
}

function isSelectedPhase(ctx: ViewerAppContext, phaseId) {
  return ctx.state.selectedPhases.includes(phaseId);
}

function isSelectedScene(ctx: ViewerAppContext, sceneId) {
  return ctx.state.selectedScenes.includes(sceneId);
}

function setSelectedKeyframes(
  ctx: ViewerAppContext,
  refs,
  options: { preserveMotionPathContext?: boolean; render?: boolean } = {},
) {
  const timeline = ctx.getEffectiveTimeline?.(ctx.state.currentTemplate);
  ctx.state.selectedKeyframes = timeline
    ? canonicalizeKeyframeSelection(timeline, refs)
    : dedupeKeyframeRefs(refs);
  if (options.preserveMotionPathContext !== true) {
    ctx.state.canvasMotionPathContextLayerIds = [];
  }
  clearSelectionCollections(ctx, "keyframe");
  const primary = ctx.state.selectedKeyframes.at(-1) ?? null;
  ctx.state.selectedItem = primary
    ? { ...primary, type: "keyframe" }
    : { type: "effect" };
  if (options.render !== false) {
    ctx.syncTimelineSelection(ctx.state.currentTemplate);
  }
}

function toggleKeyframeSelection(
  ctx: ViewerAppContext,
  ref,
  options: { render?: boolean } = {},
) {
  const index = ctx.state.selectedKeyframes.findIndex(
    (item) =>
      item.trackId === ref.trackId && item.keyframeId === ref.keyframeId,
  );
  if (index >= 0) {
    ctx.state.selectedKeyframes.splice(index, 1);
  } else {
    ctx.state.selectedKeyframes.push(ref);
  }
  setSelectedKeyframes(ctx, ctx.state.selectedKeyframes, options);
}

function prepareKeyframeSelectionForPointer(
  ctx: ViewerAppContext,
  event,
  trackId,
  keyframeId,
) {
  const ref = { keyframeId, trackId };
  clearSelectionCollections(ctx, "keyframe");
  ctx.setSidebarGroup("inspect");
  if (event.shiftKey || event.metaKey || event.ctrlKey) {
    ctx.toggleKeyframeSelection(ref, { render: false });
  } else {
    if (!ctx.isSelectedKeyframe(trackId, keyframeId)) {
      setSelectedKeyframes(ctx, [ref], { render: false });
    } else {
      const selected = ctx.state.selectedKeyframes.filter(
        (item) => item.trackId !== trackId || item.keyframeId !== keyframeId,
      );
      setSelectedKeyframes(ctx, [...selected, ref], { render: false });
    }
  }
  syncCanvasSelection(ctx);
}

function dedupeKeyframeRefs(refs) {
  const unique = new Map();
  for (const ref of Array.isArray(refs) ? refs : []) {
    if (ref?.trackId && ref?.keyframeId) {
      unique.set(`${ref.trackId}:${ref.keyframeId}`, {
        keyframeId: String(ref.keyframeId),
        trackId: String(ref.trackId),
      });
    }
  }
  return [...unique.values()];
}

function clearSelection(ctx: ViewerAppContext) {
  ctx.clearTimelineSelection();
  ctx.syncTimelineSelection(ctx.state.currentTemplate);
}

export function installModelSelectionStateOwner(ctx: ViewerAppContext): void {
  ctx.clearTimelineSelection = clearTimelineSelection.bind(undefined, ctx);
  ctx.selectClipBlock = selectClipBlock.bind(undefined, ctx);
  ctx.selectLayer = selectLayer.bind(undefined, ctx);
  ctx.selectPhaseBlock = selectPhaseBlock.bind(undefined, ctx);
  ctx.selectSceneBlock = selectSceneBlock.bind(undefined, ctx);
  ctx.selectTrackLane = selectTrackLane.bind(undefined, ctx);
  ctx.toggleSelectionValue = toggleSelectionValue.bind(undefined, ctx);
  ctx.selectKeyframe = selectKeyframe.bind(undefined, ctx);
  ctx.isSelectedKeyframe = isSelectedKeyframe.bind(undefined, ctx);
  ctx.isSelectedClip = isSelectedClip.bind(undefined, ctx);
  ctx.isSelectedLayer = isSelectedLayer.bind(undefined, ctx);
  ctx.isSelectedPhase = isSelectedPhase.bind(undefined, ctx);
  ctx.isSelectedScene = isSelectedScene.bind(undefined, ctx);
  ctx.toggleKeyframeSelection = toggleKeyframeSelection.bind(undefined, ctx);
  ctx.setSelectedKeyframes = setSelectedKeyframes.bind(undefined, ctx);
  ctx.prepareKeyframeSelectionForPointer =
    prepareKeyframeSelectionForPointer.bind(undefined, ctx);
  ctx.clearSelection = clearSelection.bind(undefined, ctx);
  ctx.clearSelectionCollections = clearSelectionCollections.bind(
    undefined,
    ctx,
  );
}
