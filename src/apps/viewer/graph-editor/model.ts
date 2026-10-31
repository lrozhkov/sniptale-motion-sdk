import { resolveGraphEditorViewport } from "./viewport.js";
import type { EditorTimeline } from "../editor/model-types.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { ResolvedKeyframeSelection } from "../timeline/model/keyframe-selection.js";
import type { GraphEditorModel, GraphCoordinates } from "./model-types.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  getKeyframeSelectionBounds,
  resolveKeyframeSelection,
} from "../timeline/model/keyframe-selection.js";
import { getTrackNumericPropertyRange } from "../layers/property-range.js";
import {
  createMotionPathGeometry,
  getMotionPathLayerProperty,
} from "../../../shared/timeline/motion-path.js";

export function createGraphEditorModel(
  ctx: ViewerAppContext,
  timeline: EditorTimeline,
): GraphEditorModel | null {
  const template = ctx.state.currentTemplate;
  const selection = resolveKeyframeSelection(
    timeline,
    ctx.getSelectedKeyframeRefs(),
  );
  if (!template || selection.length === 0) {
    return null;
  }
  const selectedTrackIds = new Set(selection.map((entry) => entry.trackId));
  const tracks = (timeline.tracks ?? [])
    .filter((track) => selectedTrackIds.has(track.id))
    .filter(
      (track) =>
        track.keyframes.length > 0 &&
        track.keyframes.every(
          (keyframe) =>
            typeof keyframe.value === "number" &&
            Number.isFinite(keyframe.value),
        ),
    )
    .map((track, index) => {
      const curvePoints = createSpatialGraphCurvePoints(ctx, timeline, track);
      return {
        colorIndex: index,
        curvePoints,
        id: track.id,
        label: ctx.getTimelineTrackDisplayLabel(track),
        points: [...track.keyframes]
          .sort((left, right) => left.time - right.time)
          .map((keyframe) => ({
            easing: keyframe.easing ?? "linear",
            handles: ctx.deps.normalizeHandles(keyframe.handles),
            id: keyframe.id,
            selected: ctx.isSelectedKeyframe(track.id, keyframe.id),
            time: Number(keyframe.time) || 0,
            value: Number(keyframe.value) || 0,
          })),
        source: track,
        spatialMotionPath: Boolean(curvePoints),
        valueRange: getTrackNumericPropertyRange(ctx, template, track),
      };
    });
  if (tracks.length === 0) {
    return null;
  }
  const graphSelection = selection.filter((entry) =>
    tracks.some((track) => track.id === entry.trackId),
  );
  const selectionBounds = getKeyframeSelectionBounds(graphSelection);
  const viewport = resolveGraphEditorViewport(
    ctx.state.graphEditorViewport,
    template.id,
    tracks,
    selectionBounds,
    ctx.getEffectiveDuration(template),
  );
  const primaryRef = ctx.getPrimaryKeyframeSelection();
  const primary = primaryRef
    ? (graphSelection.find(
        (entry) =>
          entry.trackId === primaryRef.trackId &&
          entry.keyframeId === primaryRef.keyframeId,
      ) ?? null)
    : null;
  return {
    canEditEasing: graphSelection.every(hasOutgoingSegment),
    linkedHandles: ctx.state.graphEditorLinkedHandles !== false,
    multiTrack: tracks.length > 1,
    primary,
    selection: graphSelection,
    selectionBounds,
    template,
    timeline,
    tracks,
    viewport,
  };
}

function createSpatialGraphCurvePoints(
  ctx: ViewerAppContext,
  timeline: EditorTimeline,
  track: MotionPathTrack,
): GraphCoordinates[] | null {
  const owner = getMotionPathLayerProperty(track);
  if (
    !owner ||
    !(timeline.motionPaths ?? []).some((path) => path.layerId === owner.layerId)
  ) {
    return null;
  }
  const geometry = createMotionPathGeometry(timeline, owner.layerId);
  if (!geometry.ok || geometry.points.length < 2) {
    return null;
  }
  const samples: Array<{ time: number; value: number }> = [];
  const fallback = Number(track.keyframes?.[0]?.value) || 0;
  for (let index = 0; index < geometry.points.length - 1; index += 1) {
    const from = geometry.points[index];
    const to = geometry.points[index + 1];
    if (!from || !to) continue;
    for (let sample = index === 0 ? 0 : 1; sample <= 20; sample += 1) {
      const time = from.time + ((to.time - from.time) * sample) / 20;
      samples.push({
        time,
        value: ctx.resolveNumericTrack(track, time, fallback, timeline),
      });
    }
  }
  return samples;
}

function hasOutgoingSegment(entry: ResolvedKeyframeSelection): boolean {
  const ordered = [...entry.track.keyframes].sort(
    (left, right) => left.time - right.time,
  );
  const index = ordered.findIndex(
    (keyframe) => keyframe.id === entry.keyframeId,
  );
  return index >= 0 && index < ordered.length - 1;
}
