import type { EffectV1PathSegment } from "../../../../sdk/effect-v1/types.js";
import { n, type RenderState } from "./model.js";

export function drawCanvasPathSegments(
  command: { segments: readonly EffectV1PathSegment[]; closed?: boolean },
  state: RenderState,
): void {
  const c = state.context;
  c.beginPath();
  for (const segment of command.segments) {
    switch (segment.kind) {
      case "moveTo":
        c.moveTo(n(segment.x, state), n(segment.y, state));
        break;
      case "lineTo":
        c.lineTo(n(segment.x, state), n(segment.y, state));
        break;
      case "quadraticTo":
        c.quadraticCurveTo(
          n(segment.cpx, state),
          n(segment.cpy, state),
          n(segment.x, state),
          n(segment.y, state),
        );
        break;
      case "cubicTo":
        c.bezierCurveTo(
          n(segment.cp1x, state),
          n(segment.cp1y, state),
          n(segment.cp2x, state),
          n(segment.cp2y, state),
          n(segment.x, state),
          n(segment.y, state),
        );
        break;
      case "arc":
        c.arc(
          n(segment.centerX, state),
          n(segment.centerY, state),
          n(segment.radius, state),
          n(segment.start, state),
          n(segment.end, state),
          segment.counterclockwise === true,
        );
        break;
      case "ellipse":
        c.ellipse(
          n(segment.centerX, state),
          n(segment.centerY, state),
          n(segment.radiusX, state),
          n(segment.radiusY, state),
          n(segment.rotation, state),
          n(segment.start, state),
          n(segment.end, state),
          segment.counterclockwise === true,
        );
        break;
      case "rect":
        c.rect(
          n(segment.x, state),
          n(segment.y, state),
          n(segment.width, state),
          n(segment.height, state),
        );
        break;
      case "roundRect":
        c.roundRect(
          n(segment.x, state),
          n(segment.y, state),
          n(segment.width, state),
          n(segment.height, state),
          n(segment.radius, state),
        );
        break;
    }
  }
  if (command.closed === true) c.closePath();
}

type PathPoint = { x: number; y: number };
export function trimPolyline(
  points: PathPoint[],
  progress: number,
): PathPoint[] {
  const first = points[0];
  if (!first || !Number.isFinite(progress)) return [];
  if (progress >= 1) return points;
  if (progress <= 0) return [first, first];
  const segments: { from: PathPoint; to: PathPoint; length: number }[] = [];
  let previous = first;
  for (const point of points.slice(1)) {
    segments.push({
      from: previous,
      to: point,
      length: Math.hypot(point.x - previous.x, point.y - previous.y),
    });
    previous = point;
  }
  const target =
    segments.reduce((sum, segment) => sum + segment.length, 0) * progress;
  const result = [first];
  let consumed = 0;
  for (const { from, to, length } of segments) {
    if (consumed + length <= target) {
      result.push(to);
      consumed += length;
      continue;
    }
    const ratio = length > 0 ? (target - consumed) / length : 0;
    result.push({
      x: from.x + (to.x - from.x) * ratio,
      y: from.y + (to.y - from.y) * ratio,
    });
    break;
  }
  return result;
}
