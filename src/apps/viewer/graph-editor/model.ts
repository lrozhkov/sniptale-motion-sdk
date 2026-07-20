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

export const GRAPH_EDITOR_VIEWBOX = {
  height: 240,
  marginBottom: 30,
  marginLeft: 58,
  marginRight: 18,
  marginTop: 18,
  width: 1000,
} as const;

export type GraphEditorViewport = {
  templateId: string;
  timeEnd: number;
  timeStart: number;
  valueMax: number;
  valueMin: number;
};

export function createGraphEditorModel(ctx: ViewerAppContext, timeline) {
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
        track.keyframes.every((keyframe) => typeof keyframe.value === "number"),
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
        property: ctx.inferTrackProperty(track),
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
    ? graphSelection.find(
        (entry) =>
          entry.trackId === primaryRef.trackId &&
          entry.keyframeId === primaryRef.keyframeId,
      )
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

function createSpatialGraphCurvePoints(ctx, timeline, track) {
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

export function createFittedGraphViewport(
  templateId: string,
  tracks,
  selectedRefs,
  duration: number,
  mode: "all" | "selection" = "selection",
): GraphEditorViewport {
  const selected = new Set(
    selectedRefs.map((ref) => `${ref.trackId}:${ref.keyframeId}`),
  );
  const selectedPoints = tracks.flatMap((track) => {
    const selectedOnTrack = track.points.some((point) =>
      selected.has(`${track.id}:${point.id}`),
    );
    if (track.curvePoints?.length && (mode === "all" || selectedOnTrack)) {
      return track.curvePoints.map((point) => ({
        ...point,
        trackId: track.id,
      }));
    }
    return track.points
      .filter(
        (point) => mode === "all" || selected.has(`${track.id}:${point.id}`),
      )
      .map((point) => ({ ...point, trackId: track.id }));
  });
  const fallback = tracks.flatMap((track) =>
    (track.curvePoints?.length ? track.curvePoints : track.points).map(
      (point) => ({ ...point, trackId: track.id }),
    ),
  );
  return createViewportFromPoints(
    templateId,
    selectedPoints.length >= 2 ? selectedPoints : fallback,
    duration,
  );
}

export function graphTimeToX(
  time: number,
  viewport: GraphEditorViewport,
): number {
  const plotWidth =
    GRAPH_EDITOR_VIEWBOX.width -
    GRAPH_EDITOR_VIEWBOX.marginLeft -
    GRAPH_EDITOR_VIEWBOX.marginRight;
  return (
    GRAPH_EDITOR_VIEWBOX.marginLeft +
    ((time - viewport.timeStart) /
      Math.max(0.0001, viewport.timeEnd - viewport.timeStart)) *
      plotWidth
  );
}

export function graphValueToY(
  value: number,
  viewport: GraphEditorViewport,
): number {
  const plotHeight =
    GRAPH_EDITOR_VIEWBOX.height -
    GRAPH_EDITOR_VIEWBOX.marginTop -
    GRAPH_EDITOR_VIEWBOX.marginBottom;
  return (
    GRAPH_EDITOR_VIEWBOX.marginTop +
    ((viewport.valueMax - value) /
      Math.max(0.0001, viewport.valueMax - viewport.valueMin)) *
      plotHeight
  );
}

export function graphXToTime(x: number, viewport: GraphEditorViewport): number {
  const plotWidth =
    GRAPH_EDITOR_VIEWBOX.width -
    GRAPH_EDITOR_VIEWBOX.marginLeft -
    GRAPH_EDITOR_VIEWBOX.marginRight;
  return (
    viewport.timeStart +
    ((x - GRAPH_EDITOR_VIEWBOX.marginLeft) / Math.max(1, plotWidth)) *
      (viewport.timeEnd - viewport.timeStart)
  );
}

export function graphYToValue(
  y: number,
  viewport: GraphEditorViewport,
): number {
  const plotHeight =
    GRAPH_EDITOR_VIEWBOX.height -
    GRAPH_EDITOR_VIEWBOX.marginTop -
    GRAPH_EDITOR_VIEWBOX.marginBottom;
  return (
    viewport.valueMax -
    ((y - GRAPH_EDITOR_VIEWBOX.marginTop) / Math.max(1, plotHeight)) *
      (viewport.valueMax - viewport.valueMin)
  );
}

function resolveGraphEditorViewport(
  current,
  templateId,
  tracks,
  selectionBounds,
  duration,
) {
  if (
    current?.templateId === templateId &&
    [
      current.timeStart,
      current.timeEnd,
      current.valueMin,
      current.valueMax,
    ].every(Number.isFinite) &&
    current.timeEnd > current.timeStart &&
    current.valueMax > current.valueMin
  ) {
    return current;
  }
  const selectedRefs = tracks.flatMap((track) =>
    track.points
      .filter((point) => point.selected)
      .map((point) => ({ keyframeId: point.id, trackId: track.id })),
  );
  if (selectionBounds) {
    return createFittedGraphViewport(
      templateId,
      tracks,
      selectedRefs,
      duration,
    );
  }
  return createFittedGraphViewport(
    templateId,
    tracks,
    selectedRefs,
    duration,
    "all",
  );
}

function createViewportFromPoints(
  templateId,
  points,
  duration,
): GraphEditorViewport {
  const times = points.map((point) => Number(point.time) || 0);
  const values = points.map((point) => Number(point.value) || 0);
  const rawTimeStart = times.length > 0 ? Math.min(...times) : 0;
  const rawTimeEnd =
    times.length > 0 ? Math.max(...times) : Math.max(1, duration);
  const rawValueMin = values.length > 0 ? Math.min(...values) : 0;
  const rawValueMax = values.length > 0 ? Math.max(...values) : 1;
  const timePadding = Math.max(
    1 / 30,
    (rawTimeEnd - rawTimeStart || Math.min(1, duration)) * 0.12,
  );
  const valuePadding = Math.max(
    0.1,
    (rawValueMax - rawValueMin || Math.max(1, Math.abs(rawValueMax))) * 0.14,
  );
  return {
    templateId,
    timeEnd: Math.min(Math.max(0.1, duration), rawTimeEnd + timePadding),
    timeStart: Math.max(0, rawTimeStart - timePadding),
    valueMax: rawValueMax + valuePadding,
    valueMin: rawValueMin - valuePadding,
  };
}

function hasOutgoingSegment(entry): boolean {
  const ordered = [...entry.track.keyframes].sort(
    (left, right) => left.time - right.time,
  );
  const index = ordered.findIndex(
    (keyframe) => keyframe.id === entry.keyframeId,
  );
  return index >= 0 && index < ordered.length - 1;
}
