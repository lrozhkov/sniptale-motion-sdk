import { keyframeRefKey } from "../timeline/model/keyframe-reference.js";
import type { KeyframeSelectionRef } from "../timeline/model/selection-model.js";
import type { GraphEditorViewport } from "./state.js";
import type {
  GraphCoordinates,
  GraphFitTrack,
  GraphTrack,
  GraphEditorModel,
} from "./model-types.js";

export const GRAPH_EDITOR_VIEWBOX = {
  height: 240,
  marginBottom: 30,
  marginLeft: 58,
  marginRight: 18,
  marginTop: 18,
  width: 1000,
} as const;

export function createFittedGraphViewport(
  templateId: string,
  tracks: readonly GraphFitTrack[],
  selectedRefs: readonly KeyframeSelectionRef[],
  duration: number,
  mode: "all" | "selection" = "selection",
): GraphEditorViewport {
  const selected = new Set(selectedRefs.map((ref) => keyframeRefKey(ref)));
  const selectedPoints = tracks.flatMap((track) => {
    const selectedOnTrack = track.points.some((point) =>
      selected.has(keyframeRefKey({ trackId: track.id, keyframeId: point.id })),
    );
    if (track.curvePoints?.length && (mode === "all" || selectedOnTrack)) {
      return track.curvePoints.map((point) => ({
        ...point,
        trackId: track.id,
      }));
    }
    return track.points
      .filter(
        (point) =>
          mode === "all" ||
          selected.has(
            keyframeRefKey({ trackId: track.id, keyframeId: point.id }),
          ),
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

export function resolveGraphEditorViewport(
  current: GraphEditorViewport | null,
  templateId: string,
  tracks: readonly GraphTrack[],
  selectionBounds: GraphEditorModel["selectionBounds"],
  duration: number,
): GraphEditorViewport {
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
  templateId: string,
  points: readonly GraphCoordinates[],
  duration: number,
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
