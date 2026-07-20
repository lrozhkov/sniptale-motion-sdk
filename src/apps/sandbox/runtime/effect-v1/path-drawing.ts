import { n, type RenderState } from "./model.js";

export function drawCanvasPathSegments(command: any, state: RenderState): void {
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

export function trimPolyline(points: any[], progress: number): any[] {
  if (progress >= 1) return points;
  if (progress <= 0) return [points[0], points[0]];
  const lengths = points
    .slice(1)
    .map((point, index) =>
      Math.hypot(point.x - points[index].x, point.y - points[index].y),
    );
  const target = lengths.reduce((sum, value) => sum + value, 0) * progress;
  const result = [points[0]];
  let consumed = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index];
    if (consumed + length <= target) {
      result.push(points[index + 1]);
      consumed += length;
      continue;
    }
    const ratio = length > 0 ? (target - consumed) / length : 0;
    result.push({
      x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
      y: points[index].y + (points[index + 1].y - points[index].y) * ratio,
    });
    break;
  }
  return result;
}
