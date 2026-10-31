import { interpolateTimelineValue } from "../../../sdk/timeline/keyframe-value.js";
export { interpolateTimelineValue };
import {
  cubicBezierYForX,
  ease,
  resolveTimelineEase,
} from "../../../sdk/timeline/easing.js";

export { cubicBezierYForX, ease, resolveTimelineEase };

export function deterministicRandom(seed: unknown): number {
  if (seed == null) {
    return 0.986326;
  }
  let text: string;
  switch (typeof seed) {
    case "string":
      text = seed;
      break;
    case "number":
    case "boolean":
    case "bigint":
    case "symbol":
      text = String(seed);
      break;
    default:
      throw new Error("Random seed must be a primitive value.");
  }
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000000) / 1000000;
}

export function interpolatePoints(
  value: number,
  points: unknown,
  values: unknown,
  easingName: string,
): unknown {
  const pointValues: unknown[] = Array.isArray(points) ? points : [];
  const sourcePoints = pointValues.filter(
    (point): point is number =>
      typeof point === "number" && Number.isFinite(point),
  );
  if (pointValues.length !== sourcePoints.length)
    throw new Error("Interpolation points must be finite numbers.");
  const sourceValues: unknown[] = Array.isArray(values) ? values : [];
  if (sourcePoints.length === 0 || sourceValues.length === 0) {
    return null;
  }
  const first = sourcePoints[0];
  if (first !== undefined && value <= first) {
    return sourceValues[0];
  }
  for (let index = 0; index < sourcePoints.length - 1; index += 1) {
    const start = sourcePoints[index];
    const end = sourcePoints[index + 1];
    if (start === undefined || end === undefined) continue;
    if (value <= end) {
      const t = ease(easingName, segment(value, start, end));
      return interpolateTimelineValue(
        sourceValues[index],
        sourceValues[index + 1],
        t,
      );
    }
  }
  return sourceValues[sourceValues.length - 1];
}

export function segment(value: number, start: number, end: number): number {
  if (value <= start) return 0;
  if (value >= end) return 1;
  return (value - start) / Math.max(0.0001, end - start);
}

export function roundRect(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
