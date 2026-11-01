import { unionPrimitiveBounds } from "../../../shared/geometry/primitive-bounds.js";
import {
  shouldRecordPrimitivePaintRead,
  type PrimitivePaintBounds,
  type BindingReads,
} from "./binding-reads.js";

export function recordPrimitivePaintRead(
  context: PrimitivePaintContext,
  args: unknown,
): void {
  if (!isRecord(args)) return;
  const layerId = args?.layerId ?? args?.layer ?? args?.targetLayerId;
  const reads = context?.__sniptaleBindingReads;
  if (!reads?.primitivePaintReads || typeof layerId !== "string" || !layerId) {
    return;
  }
  const id = layerId;
  if (!shouldRecordPrimitivePaintRead(reads, id)) {
    return;
  }
  reads.primitivePaintReads.add(id);
  const bounds = inferPrimitiveBounds(context, id, args);
  if (!bounds) {
    return;
  }
  const previous = reads.primitiveBounds?.get(id);
  reads.primitiveBounds?.set(
    id,
    previous ? unionPrimitiveBounds(previous, bounds) : bounds,
  );
}

function inferPrimitiveBounds(
  context: PrimitivePaintContext,
  layerId: string,
  args: Record<string, unknown>,
): PrimitivePaintBounds | null {
  if (!args || typeof args !== "object") {
    return null;
  }
  const pointBounds = boundsFromPoints(layerId, args);
  if (pointBounds) {
    return transformBounds(context, pointBounds);
  }
  const rectBounds = boundsFromRectArgs(layerId, args);
  if (rectBounds) {
    return transformBounds(context, rectBounds);
  }
  const textBounds = boundsFromTextArgs(context, layerId, args);
  return textBounds ? transformBounds(context, textBounds) : null;
}

function boundsFromRectArgs(
  layerId: string,
  args: Record<string, unknown>,
): PrimitivePaintBounds | null {
  const x = numberValue(args.x ?? args.left);
  const y = numberValue(args.y ?? args.top);
  const width = numberValue(args.width ?? args.w);
  const height = numberValue(args.height ?? args.h);
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return null;
  }
  return { height, layerId, width, x, y };
}

function boundsFromPoints(
  layerId: string,
  args: Record<string, unknown>,
): PrimitivePaintBounds | null {
  const points: unknown = args.points;
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }
  const entries: unknown[] = points;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const point of entries) {
    if (!isRecord(point)) return null;
    const x = numberValue(point.x);
    const y = numberValue(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    xs.push(x);
    ys.push(y);
  }
  if (xs.length === 0 || ys.length === 0) {
    return null;
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const strokeWidth = Math.max(
    0,
    numberValue(args.width ?? args.strokeWidth ?? 0) || 0,
  );
  return {
    height: Math.max(1, maxY - minY + strokeWidth),
    layerId,
    width: Math.max(1, maxX - minX + strokeWidth),
    x: minX - strokeWidth * 0.5,
    y: minY - strokeWidth * 0.5,
  };
}

function boundsFromTextArgs(
  context: PrimitivePaintContext,
  layerId: string,
  args: Record<string, unknown>,
): PrimitivePaintBounds | null {
  if (args.text === undefined && args.label === undefined) {
    return null;
  }
  const x = numberValue(args.x);
  const y = numberValue(args.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const rawText = args.text ?? args.label ?? "";
  if (
    (typeof rawText !== "string" && typeof rawText !== "number") ||
    !context.measureText
  )
    return null;
  const text = String(rawText);
  const previousFont = context.font;
  if (typeof args.font === "string" && args.font) context.font = args.font;
  let metrics;
  try {
    metrics = context.measureText(text);
  } finally {
    context.font = previousFont;
  }
  const measuredWidth =
    Number(metrics.width) || parseFontSize(args.font) * text.length * 0.55;
  const maxWidth = finitePositive(args.maxWidth);
  const width = Math.max(
    1,
    maxWidth === null ? measuredWidth : Math.min(measuredWidth, maxWidth),
  );
  const ascent = Number(metrics.actualBoundingBoxAscent);
  const descent = Number(metrics.actualBoundingBoxDescent);
  const fallbackHeight = parseFontSize(args.font);
  const height = Math.max(
    1,
    Number.isFinite(ascent + descent) && ascent + descent > 0
      ? ascent + descent
      : fallbackHeight,
  );
  const align = textOption(args.align ?? args.textAlign, "left");
  const baseline = textOption(args.baseline ?? args.textBaseline, "alphabetic");
  return {
    height,
    layerId,
    width,
    x: textLeft(x, width, align),
    y: textTop(y, height, ascent, baseline),
  };
}

function textLeft(x: number, width: number, align: string): number {
  if (align === "center") {
    return x - width * 0.5;
  }
  if (align === "right" || align === "end") {
    return x - width;
  }
  return x;
}

function textTop(
  y: number,
  height: number,
  ascent: number,
  baseline: string,
): number {
  if (baseline === "middle") {
    return y - height * 0.5;
  }
  if (baseline === "top" || baseline === "hanging") {
    return y;
  }
  if (baseline === "bottom" || baseline === "ideographic") {
    return y - height;
  }
  return y - (Number.isFinite(ascent) && ascent > 0 ? ascent : height * 0.78);
}

function transformBounds(
  context: PrimitivePaintContext,
  bounds: PrimitivePaintBounds,
): PrimitivePaintBounds {
  const canvasMatrix =
    typeof context.getTransform === "function" ? context.getTransform() : null;
  const matrix = canvasMatrix
    ? removeLogicalCanvasRasterScale(context, canvasMatrix)
    : null;
  if (
    !matrix ||
    (matrix.a === 1 &&
      matrix.b === 0 &&
      matrix.c === 0 &&
      matrix.d === 1 &&
      matrix.e === 0 &&
      matrix.f === 0)
  ) {
    return bounds;
  }
  const corners = [
    transformPoint(matrix, bounds.x, bounds.y),
    transformPoint(matrix, bounds.x + bounds.width, bounds.y),
    transformPoint(matrix, bounds.x, bounds.y + bounds.height),
    transformPoint(matrix, bounds.x + bounds.width, bounds.y + bounds.height),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    height: Math.max(1, Math.max(...ys) - y),
    layerId: bounds.layerId,
    width: Math.max(1, Math.max(...xs) - x),
    x,
    y,
  };
}

function removeLogicalCanvasRasterScale(
  context: PrimitivePaintContext,
  matrix: PaintMatrix,
): PaintMatrix {
  const scaleX = finiteScale(context?.__sniptaleLogicalScaleX);
  const scaleY = finiteScale(context?.__sniptaleLogicalScaleY);
  if (scaleX === 1 && scaleY === 1) {
    return matrix;
  }
  return {
    a: matrix.a / scaleX,
    b: matrix.b / scaleY,
    c: matrix.c / scaleX,
    d: matrix.d / scaleY,
    e: matrix.e / scaleX,
    f: matrix.f / scaleY,
  };
}

function transformPoint(
  matrix: PaintMatrix,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

function finitePositive(value: unknown): number | null {
  const numeric = numberValue(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function finiteScale(value: unknown): number {
  const numeric = numberValue(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function parseFontSize(font: unknown): number {
  const match = (typeof font === "string" ? font : "").match(
    /(\d+(?:\.\d+)?)px/,
  );
  return match ? Math.max(1, Number(match[1]) || 48) : 48;
}

export type PaintMatrix = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};
export type PrimitivePaintContext = {
  __sniptaleBindingReads?: BindingReads | null;
  __sniptaleLogicalScaleX?: unknown;
  __sniptaleLogicalScaleY?: unknown;
  font?: string | undefined;
  getTransform?(): PaintMatrix;
  measureText?(text: string): {
    width: number;
    actualBoundingBoxAscent?: number;
    actualBoundingBoxDescent?: number;
  };
};
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function numberValue(value: unknown): number {
  return typeof value === "number" ? value : NaN;
}
function textOption(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
