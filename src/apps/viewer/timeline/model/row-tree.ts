import type { TimelineExpansionType } from "./row-tree-model.js";
import { bindViewerAction } from "../../app/bind-action.js";
import type {
  TimelineRowTree,
  TimelineScene,
  TimelineLayerRow,
} from "./row-tree-model.js";
import type { EditorTimeline } from "../../editor/model-types.js";
import type { ViewerAppContext } from "../../app/context.js";
import {
  buildTimelineLayerForest,
  buildTimelinePhaseRow,
  buildTrackRowsForParent,
} from "./layer-row-tree.js";

function getTimelineRowExpansionId(
  _ctx: ViewerAppContext,
  type: TimelineExpansionType,
  id: string,
): string {
  return `${type}:${id}`;
}

function isTimelineRowExpanded(
  ctx: ViewerAppContext,
  type: TimelineExpansionType,
  id: string,
): boolean {
  return ctx.state.expandedTimelineRowIds.has(
    ctx.getTimelineRowExpansionId(type, id),
  );
}

function setTimelineRowExpanded(
  ctx: ViewerAppContext,
  type: TimelineExpansionType,
  id: string,
  expanded: boolean,
): void {
  const rowId = ctx.getTimelineRowExpansionId(type, id);
  if (expanded) {
    ctx.state.expandedTimelineRowIds.add(rowId);
  } else {
    ctx.state.expandedTimelineRowIds.delete(rowId);
  }
}

function toggleTimelineRowExpansion(
  ctx: ViewerAppContext,
  type: TimelineExpansionType,
  id: string,
): void {
  ctx.setTimelineRowExpanded(type, id, !ctx.isTimelineRowExpanded(type, id));
  ctx.renderTimelineStructure(ctx.state.currentTemplate);
}

function setAllTimelineRowsExpanded(
  ctx: ViewerAppContext,
  expanded: boolean,
): void {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return;
  }
  ctx.state.expandedSceneIds = expanded
    ? ctx.createExpandedSceneIdSet(template)
    : new Set();
  ctx.state.expandedTimelineRowIds = expanded
    ? ctx.createExpandedTimelineRowIdSet(template)
    : new Set();
  ctx.renderTimelineStructure(ctx.state.currentTemplate);
}

function createExpandedTimelineRowIdSet(
  ctx: ViewerAppContext,
  template: unknown = ctx.state.currentTemplate,
): Set<string> {
  const rowIds = new Set<string>();
  const tree = ctx.createTimelineRowTree(template);
  addExpandedLayerRows(ctx, rowIds, tree.globalLayers ?? []);
  for (const scene of tree.scenes) {
    rowIds.add(ctx.getTimelineRowExpansionId("scene", scene.scene.id));
    addExpandedLayerRows(ctx, rowIds, scene.layers);
    for (const phase of scene.scenePhases) {
      rowIds.add(
        ctx.getTimelineRowExpansionId("scenePhase", phase.expansionId),
      );
    }
    if (scene.sceneTracks.length > 0) {
      rowIds.add(ctx.getTimelineRowExpansionId("sceneTracks", scene.scene.id));
    }
  }
  return rowIds;
}

function createInitialTimelineRowIdSet(
  ctx: ViewerAppContext,
  template: unknown = ctx.state.currentTemplate,
): Set<string> {
  const rowIds = new Set<string>();
  const tree = ctx.createTimelineRowTree(template);
  for (const scene of tree.scenes) {
    rowIds.add(ctx.getTimelineRowExpansionId("scene", scene.scene.id));
  }
  return rowIds;
}

export function createTimelineRowTree(
  ctx: ViewerAppContext,
  template: unknown,
): TimelineRowTree {
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!effectiveTemplate) {
    return { globalLayers: [], globalScene: null, scenes: [] };
  }
  const timeline = effectiveTemplate.timeline;
  const duration = effectiveTemplate.duration;
  const scenes = ctx.normalizeScenes(effectiveTemplate.scenes ?? [], duration);
  const firstSceneId = scenes[0]?.id ?? null;
  const globalScene: TimelineScene = {
    duration,
    enabled: true,
    id: "__global__",
    isGlobalTimelineScope: true,
    label: "Global",
    locked: true,
    start: 0,
  };
  const globalLayerIds = ctx.getGlobalTimelineLayerIds(
    effectiveTemplate,
    scenes,
  );
  const globalLayers = buildTimelineLayerForest(ctx, timeline, globalScene, {
    effectiveTemplate,
    firstSceneId: globalScene.id,
    globalLayerIds,
    globalScope: true,
  });
  return {
    globalLayers,
    globalScene,
    scenes: scenes.map((scene) => {
      const layerRows = buildTimelineLayerForest(ctx, timeline, scene, {
        effectiveTemplate,
        firstSceneId,
        globalLayerIds,
        globalScope: false,
      });
      const scenePhaseRows = (timeline.phases ?? [])
        .filter(
          (phase) =>
            ctx.phaseBelongsToScene(phase, scene) &&
            isScenePhase(ctx, timeline, phase.id),
        )
        .map((phase) =>
          buildTimelinePhaseRow(ctx, timeline, scene, phase, {
            id: scene.id,
            type: "scenePhase",
          }),
        );
      return {
        layers: layerRows,
        scene,
        scenePhases: scenePhaseRows,
        sceneTracks: buildTrackRowsForParent(ctx, timeline, scene, {
          id: scene.id,
          type: "scene",
        }),
      };
    }),
  };
}

function isScenePhase(
  ctx: ViewerAppContext,
  timeline: EditorTimeline,
  phaseId: string,
): boolean {
  const owners = ctx.getPhaseTrackLayerIds(timeline, phaseId);
  return owners.size === 0 || owners.has("__scene__");
}

function addExpandedLayerRows(
  ctx: ViewerAppContext,
  rowIds: Set<string>,
  rows: readonly TimelineLayerRow[],
): void {
  for (const row of rows) {
    rowIds.add(
      ctx.getTimelineRowExpansionId(
        row.kind === "group" ? "group" : "layer",
        row.expansionId,
      ),
    );
    if (row.kind === "group") {
      addExpandedLayerRows(ctx, rowIds, row.children);
      continue;
    }
    for (const phase of row.phases) {
      rowIds.add(ctx.getTimelineRowExpansionId("phase", phase.expansionId));
    }
  }
}

export function createTimelineRowTreeActions(
  getContext: () => ViewerAppContext,
) {
  return {
    createExpandedTimelineRowIdSet: bindViewerAction(
      createExpandedTimelineRowIdSet,
      getContext,
    ),
    createInitialTimelineRowIdSet: bindViewerAction(
      createInitialTimelineRowIdSet,
      getContext,
    ),
    getTimelineRowExpansionId: bindViewerAction(
      getTimelineRowExpansionId,
      getContext,
    ),
    isTimelineRowExpanded: bindViewerAction(isTimelineRowExpanded, getContext),
    setAllTimelineRowsExpanded: bindViewerAction(
      setAllTimelineRowsExpanded,
      getContext,
    ),
    setTimelineRowExpanded: bindViewerAction(
      setTimelineRowExpanded,
      getContext,
    ),
    toggleTimelineRowExpansion: bindViewerAction(
      toggleTimelineRowExpansion,
      getContext,
    ),
  };
}
