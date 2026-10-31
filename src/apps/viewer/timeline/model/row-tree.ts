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
  type: string,
  id: string,
) {
  return `${type}:${id}`;
}

function isTimelineRowExpanded(
  ctx: ViewerAppContext,
  type: string,
  id: string,
) {
  return ctx.state.expandedTimelineRowIds.has(
    ctx.getTimelineRowExpansionId(type, id),
  );
}

function setTimelineRowExpanded(
  ctx: ViewerAppContext,
  type: string,
  id: string,
  expanded: boolean,
) {
  const rowId = ctx.getTimelineRowExpansionId(type, id);
  if (expanded) {
    ctx.state.expandedTimelineRowIds.add(rowId);
  } else {
    ctx.state.expandedTimelineRowIds.delete(rowId);
  }
}

function toggleTimelineRowExpansion(
  ctx: ViewerAppContext,
  type: string,
  id: string,
) {
  ctx.setTimelineRowExpanded(type, id, !ctx.isTimelineRowExpanded(type, id));
  ctx.renderTimelineStructure(ctx.state.currentTemplate);
}

function setAllTimelineRowsExpanded(ctx: ViewerAppContext, expanded: boolean) {
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
  template = ctx.state.currentTemplate,
) {
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
  template = ctx.state.currentTemplate,
) {
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

export function installTimelineRowTreeOwner(ctx: ViewerAppContext): void {
  Object.assign(ctx, {
    createExpandedTimelineRowIdSet: createExpandedTimelineRowIdSet.bind(
      undefined,
      ctx,
    ),
    createInitialTimelineRowIdSet: createInitialTimelineRowIdSet.bind(
      undefined,
      ctx,
    ),
    createTimelineRowTree: createTimelineRowTree.bind(undefined, ctx),
    getTimelineRowExpansionId: getTimelineRowExpansionId.bind(undefined, ctx),
    isTimelineRowExpanded: isTimelineRowExpanded.bind(undefined, ctx),
    setAllTimelineRowsExpanded: setAllTimelineRowsExpanded.bind(undefined, ctx),
    setTimelineRowExpanded: setTimelineRowExpanded.bind(undefined, ctx),
    toggleTimelineRowExpansion: toggleTimelineRowExpansion.bind(undefined, ctx),
  });
}
