import type { EffectV1PathSegment } from "../../../../sdk/effect-v1/types.js";
import { recordPrimitivePaintRead } from "../primitive-paint-reads.js";
import { n, type RenderState, valueOr } from "./model.js";

export function attachPrimitiveBindingReads(
  context: any,
  bindingReads: any,
): void {
  context.__sniptaleBindingReads = bindingReads;
}

export function recordPrimitiveRect(
  context: any,
  layerId: unknown,
  rect: { height: number; width: number; x: number; y: number },
): void {
  recordPrimitivePaintRead(context, { ...rect, layerId });
}

export function recordCenteredPrimitiveRect(
  command: any,
  state: RenderState,
  width: number,
  height: number,
): void {
  recordPrimitiveRect(state.context, command.layerId, {
    height,
    width,
    x: -width / 2,
    y: -height / 2,
  });
}

export function recordRotatedPrimitiveRect(
  command: any,
  state: RenderState,
): void {
  const context = state.context;
  const x = n(command.x, state);
  const y = n(command.y, state);
  const width = n(command.width, state);
  const height = n(command.height, state);
  context.save();
  try {
    context.translate(x + width / 2, y + height / 2);
    context.rotate(n(command.rotation, state));
    recordCenteredPrimitiveRect(command, state, width, height);
  } finally {
    context.restore();
  }
}

export function recordTextPrimitive(
  command: any,
  state: RenderState,
  resolved: {
    font: string;
    measuredWidth: number;
    text: string;
    x: number;
    y: number;
  },
): void {
  recordPrimitivePaintRead(state.context, {
    align: command.align,
    baseline: command.baseline,
    font: resolved.font,
    layerId: command.layerId,
    maxWidth: resolved.measuredWidth,
    text: resolved.text,
    x: resolved.x,
    y: resolved.y,
  });
}

export function recordPolylinePrimitive(
  command: any,
  state: RenderState,
  points: Array<{ x: number; y: number }>,
): void {
  recordPrimitivePaintRead(state.context, {
    layerId: command.layerId,
    points,
    strokeWidth: valueOr(command.lineWidth, 1, state),
  });
}

export function recordSegmentPathPrimitive(
  command: any,
  state: RenderState,
): void {
  recordPolylinePrimitive(
    command,
    state,
    resolveSegmentBoundsPoints(command, state),
  );
}

function resolveSegmentBoundsPoints(command: any, state: RenderState) {
  const points: Array<{ x: number; y: number }> = [];
  const add = (x: unknown, y: unknown) =>
    points.push({ x: n(x, state), y: n(y, state) });
  for (const segment of Array.isArray(command.segments)
    ? command.segments
    : []) {
    if (segment.kind === "moveTo" || segment.kind === "lineTo") {
      add(segment.x, segment.y);
    } else if (segment.kind === "quadraticTo") {
      add(segment.cpx, segment.cpy);
      add(segment.x, segment.y);
    } else if (segment.kind === "cubicTo") {
      add(segment.cp1x, segment.cp1y);
      add(segment.cp2x, segment.cp2y);
      add(segment.x, segment.y);
    } else if (segment.kind === "arc" || segment.kind === "ellipse") {
      addEllipseBounds(points, segment, state);
    } else if (segment.kind === "rect" || segment.kind === "roundRect") {
      const x = n(segment.x, state);
      const y = n(segment.y, state);
      points.push(
        { x, y },
        { x: x + n(segment.width, state), y: y + n(segment.height, state) },
      );
    }
  }
  return points;
}

function addEllipseBounds(
  points: { x: number; y: number }[],
  segment: Extract<EffectV1PathSegment, { kind: "arc" | "ellipse" }>,
  state: RenderState,
): void {
  const centerX = n(segment.centerX, state);
  const centerY = n(segment.centerY, state);
  const radiusX = Math.abs(
    n(segment.kind === "arc" ? segment.radius : segment.radiusX, state),
  );
  const radiusY = Math.abs(
    n(segment.kind === "arc" ? segment.radius : segment.radiusY, state),
  );
  points.push(
    { x: centerX - radiusX, y: centerY - radiusY },
    { x: centerX + radiusX, y: centerY + radiusY },
  );
}
