import type { GraphCurve } from "./model-types.js";
import type { GraphEditorViewport } from "./state.js";
import { normalizeHandles } from "../editor/model.js";
import { graphTimeToX, graphValueToY } from "./viewport.js";

const TRACK_COLORS = [
  "#72dbe6",
  "#ff8418",
  "#ad8cff",
  "#40d28a",
  "#ff6b8a",
  "#e0c45c",
] as const;

export function createGraphTrackPath(
  track: GraphCurve,
  viewport: GraphEditorViewport,
): string {
  if (track.curvePoints?.length) {
    return track.curvePoints
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${graphTimeToX(point.time, viewport)},${graphValueToY(point.value, viewport)}`,
      )
      .join(" ");
  }
  const points = track.points;
  const first = points[0];
  const commands = first
    ? [
        `M${graphTimeToX(first.time, viewport)},${graphValueToY(first.value, viewport)}`,
      ]
    : [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
    if (!point || !next) continue;
    if (point.easing === "hold") {
      commands.push(
        `H${graphTimeToX(next.time, viewport)}`,
        `V${graphValueToY(next.value, viewport)}`,
      );
    } else if (point.easing !== "bezier") {
      commands.push(
        `L${graphTimeToX(next.time, viewport)},${graphValueToY(next.value, viewport)}`,
      );
    } else {
      const handles = normalizeHandles(point.handles);
      const deltaTime = next.time - point.time;
      const deltaValue = next.value - point.value;
      commands.push(
        `C${graphTimeToX(point.time + handles.x1 * deltaTime, viewport)},${graphValueToY(point.value + handles.y1 * deltaValue, viewport)} ${graphTimeToX(point.time + handles.x2 * deltaTime, viewport)},${graphValueToY(point.value + handles.y2 * deltaValue, viewport)} ${graphTimeToX(next.time, viewport)},${graphValueToY(next.value, viewport)}`,
      );
    }
  }
  return commands.join(" ");
}

export function getGraphTrackColor(track: { colorIndex: number }): string {
  return (
    TRACK_COLORS[track.colorIndex % TRACK_COLORS.length] ?? TRACK_COLORS[0]
  );
}

export function formatGraphValue(value: number): string {
  const rounded = Math.round(Number(value) * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3);
}
