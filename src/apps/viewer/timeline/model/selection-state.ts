import { bindViewerAction } from "../../app/bind-action.js";
import type {
  SelectionCollectionKind,
  SelectionModifiers,
} from "./selection-model.js";
import {
  resolveSelectionValues,
  resolvePrimarySelectionItem,
} from "./selection-values.js";
import type { ViewerAppContext } from "../../app/context.js";
import {
  createLayerHierarchyIndex,
  normalizeLayerSelectionRoots,
} from "../../layers/hierarchy.js";

function clearTimelineSelection(ctx: ViewerAppContext): void {
  ctx.state.selectedItem = { type: "effect" };
  ctx.state.selectedClips = [];
  ctx.state.selectedLayers = [];
  ctx.state.selectedPhases = [];
  ctx.state.selectedScenes = [];
  ctx.state.selectedKeyframes = [];
  syncCanvasSelection(ctx);
}

function selectLayer(
  ctx: ViewerAppContext,
  layerId: string,
  event: SelectionModifiers | null = null,
): void {
  ctx.state.selectedLayers = resolveSelectionValues(
    ctx.state.selectedLayers,
    layerId,
    event,
  );
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (template) {
    ctx.state.selectedLayers = normalizeLayerSelectionRoots(
      createLayerHierarchyIndex(template.layers),
      ctx.state.selectedLayers,
    );
  }
  clearSelectionCollections(ctx, "layer");
  ctx.state.selectedItem = resolvePrimarySelectionItem(
    "layer",
    ctx.state.selectedLayers,
  );
  ctx.setSidebarGroup("inspect");
  ctx.syncTimelineSelection(ctx.state.currentTemplate);
}

function selectClipBlock(
  ctx: ViewerAppContext,
  layerId: string,
  event: SelectionModifiers | null = null,
): void {
  ctx.state.selectedClips = resolveSelectionValues(
    ctx.state.selectedClips,
    layerId,
    event,
  );
  clearSelectionCollections(ctx, "clip");
  ctx.state.selectedItem = resolvePrimarySelectionItem(
    "clip",
    ctx.state.selectedClips,
  );
  ctx.setSidebarGroup("inspect");
  ctx.syncTimelineSelection(ctx.state.currentTemplate);
}

function selectPhaseBlock(
  ctx: ViewerAppContext,
  phaseId: string,
  event: SelectionModifiers | null = null,
): void {
  ctx.state.selectedPhases = resolveSelectionValues(
    ctx.state.selectedPhases,
    phaseId,
    event,
  );
  clearSelectionCollections(ctx, "phase");
  ctx.state.selectedItem = resolvePrimarySelectionItem(
    "phase",
    ctx.state.selectedPhases,
  );
  ctx.setSidebarGroup("inspect");
  ctx.syncTimelineSelection(ctx.state.currentTemplate);
}

function selectSceneBlock(
  ctx: ViewerAppContext,
  sceneId: string,
  event: SelectionModifiers | null = null,
): void {
  const wasExpanded = ctx.isSceneExpanded(sceneId);
  ctx.state.selectedScenes = resolveSelectionValues(
    ctx.state.selectedScenes,
    sceneId,
    event,
  );
  clearSelectionCollections(ctx, "scene");
  ctx.state.selectedItem = resolvePrimarySelectionItem(
    "scene",
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

function selectTrackLane(ctx: ViewerAppContext, trackId: string): void {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template?.timeline?.tracks?.some((track) => track.id === trackId)) {
    return;
  }
  clearSelectionCollections(ctx, "track");
  ctx.state.selectedItem = { trackId, type: "track" };
  ctx.setSidebarGroup("inspect");
  ctx.syncTimelineSelection(ctx.state.currentTemplate);
}

function clearSelectionCollections(
  ctx: ViewerAppContext,
  keep: SelectionCollectionKind | null = null,
): void {
  if (keep !== "clip") ctx.state.selectedClips = [];
  if (keep !== "layer") ctx.state.selectedLayers = [];
  if (keep !== "phase") ctx.state.selectedPhases = [];
  if (keep !== "scene") ctx.state.selectedScenes = [];
  if (keep !== "keyframe") ctx.state.selectedKeyframes = [];
}

export function syncCanvasSelection(ctx: ViewerAppContext): void {
  ctx.updateCanvasSelectionBox?.();
}

function isSelectedClip(
  ctx: ViewerAppContext,
  layerId: string | null | undefined,
): boolean {
  return (
    typeof layerId === "string" && ctx.state.selectedClips.includes(layerId)
  );
}

function isSelectedLayer(
  ctx: ViewerAppContext,
  layerId: string | null | undefined,
): boolean {
  return (
    typeof layerId === "string" && ctx.state.selectedLayers.includes(layerId)
  );
}

function isSelectedPhase(
  ctx: ViewerAppContext,
  phaseId: string | null | undefined,
): boolean {
  return (
    typeof phaseId === "string" && ctx.state.selectedPhases.includes(phaseId)
  );
}

function isSelectedScene(
  ctx: ViewerAppContext,
  sceneId: string | null | undefined,
): boolean {
  return (
    typeof sceneId === "string" && ctx.state.selectedScenes.includes(sceneId)
  );
}

function clearSelection(ctx: ViewerAppContext): void {
  ctx.clearTimelineSelection();
  ctx.syncTimelineSelection(ctx.state.currentTemplate);
}

export function createTimelineSelectionStateActions(
  getContext: () => ViewerAppContext,
) {
  return {
    clearTimelineSelection: bindViewerAction(
      clearTimelineSelection,
      getContext,
    ),
    selectLayer: bindViewerAction(selectLayer, getContext),
    selectClipBlock: bindViewerAction(selectClipBlock, getContext),
    selectPhaseBlock: bindViewerAction(selectPhaseBlock, getContext),
    selectSceneBlock: bindViewerAction(selectSceneBlock, getContext),
    selectTrackLane: bindViewerAction(selectTrackLane, getContext),
    isSelectedClip: bindViewerAction(isSelectedClip, getContext),
    isSelectedLayer: bindViewerAction(isSelectedLayer, getContext),
    isSelectedPhase: bindViewerAction(isSelectedPhase, getContext),
    isSelectedScene: bindViewerAction(isSelectedScene, getContext),
    clearSelectionCollections: bindViewerAction(
      clearSelectionCollections,
      getContext,
    ),
    clearSelection: bindViewerAction(clearSelection, getContext),
  };
}
