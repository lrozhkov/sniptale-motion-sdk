import type { ViewerAppContext } from "../../app/context.js";
import type { EditorTemplate } from "../../templates/model.js";
import type { TimelineTrackRow, TimelineLayerRow } from "./row-tree-model.js";
import type { TimelineNavigationItem } from "./selection-model.js";

export function getVisibleTimelineSelectionItems(
  ctx: ViewerAppContext,
  template: EditorTemplate,
): TimelineNavigationItem[] {
  const items: TimelineNavigationItem[] = [];
  const appendTracks = (
    trackRows: TimelineTrackRow[],
    sceneId: string | null,
  ) => {
    for (const { keyframes, track } of trackRows) {
      items.push({ sceneId, trackId: track.id, type: "track" });
      for (const keyframe of keyframes) {
        items.push({
          keyframeId: keyframe.id,
          sceneId,
          trackId: track.id,
          type: "keyframe",
        });
      }
    }
  };
  const tree = ctx.createTimelineRowTree(template);
  appendLayerRows(tree.globalLayers ?? [], null);
  for (const sceneRow of tree.scenes) {
    const { scene } = sceneRow;
    items.push({ sceneId: scene.id, type: "scene" });
    if (!ctx.isSceneExpanded(scene.id)) {
      continue;
    }
    appendLayerRows(sceneRow.layers, scene.id);
    for (const phaseRow of sceneRow.scenePhases) {
      items.push({
        phaseId: phaseRow.phase.id,
        sceneId: scene.id,
        type: "phase",
      });
      if (ctx.isTimelineRowExpanded("scenePhase", phaseRow.expansionId)) {
        appendTracks(phaseRow.tracks, scene.id);
      }
    }
    if (
      sceneRow.sceneTracks.length > 0 &&
      ctx.isTimelineRowExpanded("sceneTracks", scene.id)
    ) {
      appendTracks(sceneRow.sceneTracks, scene.id);
    }
  }
  return items;

  function appendLayerRows(
    layerRows: TimelineLayerRow[],
    sceneId: string | null,
  ): void {
    for (const layerRow of layerRows) {
      items.push({ layerId: layerRow.layerId, sceneId, type: "layer" });
      if (layerRow.kind !== "group" && layerRow.clip) {
        items.push({ layerId: layerRow.layerId, sceneId, type: "clip" });
      }
      const rowType = layerRow.kind === "group" ? "group" : "layer";
      if (!ctx.isTimelineRowExpanded(rowType, layerRow.expansionId)) {
        continue;
      }
      if (layerRow.kind === "group") {
        appendLayerRows(layerRow.children, sceneId);
        continue;
      }
      for (const phaseRow of layerRow.phases) {
        items.push({
          phaseId: phaseRow.phase.id,
          sceneId,
          type: "phase",
        });
        if (ctx.isTimelineRowExpanded("phase", phaseRow.expansionId)) {
          appendTracks(phaseRow.tracks, sceneId);
        }
      }
      appendTracks(layerRow.directTracks, sceneId);
    }
  }
}
