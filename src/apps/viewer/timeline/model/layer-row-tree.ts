import type { ViewerAppContext } from "../../app/context.js";
import type { EditorTemplate } from "../../templates/model.js";
import type { EditorTimeline } from "../../editor/model-types.js";
import type {
  EffectClip,
  EffectLayer,
  TimelinePhase,
} from "../../../../sdk/types.js";
import type {
  TimelineScene,
  TimelineLayerRow,
  TimelineLayerLeafRow,
  TimelineTrackRow,
  TimelinePhaseRow,
  TimelinePhaseParent,
  TimelineTrackParent,
} from "./row-tree-model.js";
import {
  createLayerHierarchyIndex,
  getLayerLeafIds,
  isLayerGroup,
} from "../../layers/hierarchy.js";

export function buildTimelineLayerForest(
  ctx: ViewerAppContext,
  timeline: EditorTimeline,
  scene: TimelineScene,
  {
    effectiveTemplate,
    firstSceneId,
    globalLayerIds,
    globalScope,
  }: {
    effectiveTemplate: EditorTemplate;
    firstSceneId: string | null;
    globalLayerIds: ReadonlySet<string>;
    globalScope: boolean;
  },
): TimelineLayerRow[] {
  const layers = effectiveTemplate.layers ?? [];
  const clips = effectiveTemplate.clips ?? [];
  const hierarchy = createLayerHierarchyIndex(layers);
  const clipsByLayer = new Map<string, EffectClip>(
    clips.map((clip) => [clip.layerId, clip]),
  );
  const layerRows = new Map<string, TimelineLayerLeafRow>();
  for (const layer of layers) {
    if (isLayerGroup(layer) || globalLayerIds.has(layer.id) !== globalScope) {
      continue;
    }
    const row = buildLayerRow(ctx, timeline, scene, {
      clip: clipsByLayer.get(layer.id) ?? null,
      firstSceneId,
      layer,
      layerId: layer.id,
    });
    if (row) {
      layerRows.set(layer.id, row);
    }
  }
  const forest = [...(hierarchy.childrenByParentId.get(null) ?? [])]
    .reverse()
    .map((layer) => buildStructuralRow(layer, null))
    .filter((row): row is TimelineLayerRow => row !== null);
  const knownLayerIds = new Set(layers.map((layer) => layer.id));
  for (const clip of [...clips].reverse()) {
    if (
      knownLayerIds.has(clip.layerId) ||
      globalLayerIds.has(clip.layerId) !== globalScope
    ) {
      continue;
    }
    const row = buildLayerRow(ctx, timeline, scene, {
      clip,
      firstSceneId,
      layer: null,
      layerId: clip.layerId,
    });
    if (row) {
      forest.push(row);
    }
  }
  assignTimelineDepth(forest, globalScope ? 0 : 1);
  return forest;

  function buildStructuralRow(
    layer: EffectLayer,
    parentId: string | null,
  ): TimelineLayerRow | null {
    if (!isLayerGroup(layer)) {
      return layerRows.get(layer.id) ?? null;
    }
    const children = [...(hierarchy.childrenByParentId.get(layer.id) ?? [])]
      .reverse()
      .map((child) => buildStructuralRow(child, layer.id))
      .filter((row): row is TimelineLayerRow => row !== null);
    if (children.length === 0) {
      return null;
    }
    return {
      allLeafIds: getLayerLeafIds(hierarchy, [layer.id]),
      children,
      expansionId: `${scene.id}:${layer.id}`,
      kind: "group",
      layer,
      layerId: layer.id,
      leafIds: collectVisibleLeafIds(children),
      parentId,
    };
  }
}

function buildLayerRow(
  ctx: ViewerAppContext,
  timeline: EditorTimeline,
  scene: TimelineScene,
  {
    clip,
    firstSceneId,
    layer,
    layerId,
  }: {
    clip: EffectClip | null;
    firstSceneId: string | null;
    layer: EffectLayer | null;
    layerId: string;
  },
): TimelineLayerLeafRow | null {
  const ownedClip = clip;
  if (ownedClip && !ctx.clipBelongsToScene(ownedClip, scene)) {
    clip = null;
  }
  const directTracks = buildTrackRowsForParent(ctx, timeline, scene, {
    id: layerId,
    type: "layer",
  });
  const phaseRows = (timeline.phases ?? [])
    .filter(
      (phase) =>
        ctx.phaseBelongsToScene(phase, scene) &&
        ctx.getPhaseTrackLayerIds(timeline, phase.id).has(layerId),
    )
    .map((phase) =>
      buildPhaseRow(ctx, timeline, scene, phase, {
        id: layerId,
        type: "layerPhase",
      }),
    );
  const hasSceneContent =
    Boolean(clip) || directTracks.length > 0 || phaseRows.length > 0;
  const isUnscopedLayerHome =
    Boolean(layer) && !ownedClip && scene.id === firstSceneId;
  if (!hasSceneContent && !isUnscopedLayerHome) {
    return null;
  }
  return {
    clip,
    directTracks,
    expansionId: `${scene.id}:${layerId}`,
    kind: "layer",
    layer,
    layerId,
    phases: phaseRows,
  };
}

function buildPhaseRow(
  ctx: ViewerAppContext,
  timeline: EditorTimeline,
  scene: TimelineScene,
  phase: TimelinePhase,
  parent: TimelinePhaseParent,
): TimelinePhaseRow {
  return {
    expansionId:
      parent.type === "layerPhase"
        ? `${scene.id}:${parent.id}:${phase.id}`
        : `${scene.id}:${phase.id}`,
    parent,
    phase,
    tracks: buildTrackRowsForParent(ctx, timeline, scene, {
      id: phase.id,
      layerId: parent.type === "layerPhase" ? parent.id : null,
      type: parent.type,
    }),
  };
}

export function buildTrackRowsForParent(
  ctx: ViewerAppContext,
  timeline: EditorTimeline,
  scene: TimelineScene,
  parent: TimelineTrackParent,
): TimelineTrackRow[] {
  return (timeline.tracks ?? [])
    .map((track) => ({
      keyframes: ctx.getTrackKeyframesForParent(track, scene, timeline, parent),
      parent,
      track,
    }))
    .filter(({ keyframes, track }) => {
      if (keyframes.length > 0) {
        return true;
      }
      if (parent.type === "phase") {
        return track.phaseId === parent.id;
      }
      if (parent.type === "layer") {
        return (
          ctx.getTrackLayerId(track) === parent.id &&
          !track.phaseId &&
          !(track.keyframes ?? []).some((keyframe) => keyframe.phaseId)
        );
      }
      if (parent.type === "layerPhase") {
        return (
          ctx.getTrackLayerId(track) === parent.layerId &&
          track.phaseId === parent.id &&
          ctx.isPhaseCompatibleWithLayer(timeline, parent.id, parent.layerId)
        );
      }
      if (parent.type === "scenePhase") {
        return !ctx.getTrackLayerId(track) && track.phaseId === parent.id;
      }
      return (
        track.sceneId === scene.id &&
        !ctx.getTrackLayerId(track) &&
        !track.phaseId &&
        !(track.keyframes ?? []).some((keyframe) => keyframe.phaseId)
      );
    });
}

export function buildTimelinePhaseRow(
  ctx: ViewerAppContext,
  timeline: EditorTimeline,
  scene: TimelineScene,
  phase: TimelinePhase,
  parent: TimelinePhaseParent,
): TimelinePhaseRow {
  return buildPhaseRow(ctx, timeline, scene, phase, parent);
}

function assignTimelineDepth(rows: TimelineLayerRow[], depth: number): void {
  for (const row of rows) {
    row.depth = depth;
    if (row.kind === "group") {
      assignTimelineDepth(row.children, depth + 1);
      continue;
    }
    for (const phase of row.phases) {
      phase.depth = depth + 1;
      for (const track of phase.tracks) {
        track.depth = depth + 2;
      }
    }
    for (const track of row.directTracks) {
      track.depth = depth + 1;
    }
  }
}

function collectVisibleLeafIds(rows: readonly TimelineLayerRow[]): string[] {
  return rows.flatMap((row) =>
    row.kind === "group" ? collectVisibleLeafIds(row.children) : [row.layerId],
  );
}
