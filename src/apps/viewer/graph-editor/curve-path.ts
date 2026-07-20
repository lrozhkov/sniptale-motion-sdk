import { graphTimeToX, graphValueToY } from "./model.js";

const TRACK_COLORS = [
  "#72dbe6",
  "#ff8418",
  "#ad8cff",
  "#40d28a",
  "#ff6b8a",
  "#e0c45c",
];

export function createGraphTrackPath(track, viewport): string {
  if (track.curvePoints?.length) {
    return track.curvePoints
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${graphTimeToX(point.time, viewport)},${graphValueToY(point.value, viewport)}`,
      )
      .join(" ");
  }
  const points = track.points;
  const commands = points.length
    ? [
        `M${graphTimeToX(points[0].time, viewport)},${graphValueToY(points[0].value, viewport)}`,
      ]
    : [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const point = points[index];
    const next = points[index + 1];
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
      const deltaTime = next.time - point.time;
      const deltaValue = next.value - point.value;
      commands.push(
        `C${graphTimeToX(point.time + point.handles.x1 * deltaTime, viewport)},${graphValueToY(point.value + point.handles.y1 * deltaValue, viewport)} ${graphTimeToX(point.time + point.handles.x2 * deltaTime, viewport)},${graphValueToY(point.value + point.handles.y2 * deltaValue, viewport)} ${graphTimeToX(next.time, viewport)},${graphValueToY(next.value, viewport)}`,
      );
    }
  }
  return commands.join(" ");
}

export function getGraphTrackColor(track): string {
  return TRACK_COLORS[track.colorIndex % TRACK_COLORS.length];
}

export function formatGraphValue(value): string {
  const rounded = Math.round(Number(value) * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(3);
}
