import {
  shouldRecordPrimitivePaintRead,
  type PrimitivePaintBounds,
} from "./binding-reads.js";

export function recordPrimitivePaintRead(context: any, args: any): void {
  const layerId = args?.layerId ?? args?.layer ?? args?.targetLayerId;
  const reads = context?.__sniptaleBindingReads;
  if (!reads?.primitivePaintReads || !layerId) {
    return;
  }
  const id = String(layerId);
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
    previous ? unionBounds(previous, bounds) : bounds,
  );
}

function inferPrimitiveBounds(
  context: any,
  layerId: string,
  args: any,
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
  args: any,
): PrimitivePaintBounds | null {
  const x = Number(args.x ?? args.left);
  const y = Number(args.y ?? args.top);
  const width = Number(args.width ?? args.w);
  const height = Number(args.height ?? args.h);
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
  args: any,
): PrimitivePaintBounds | null {
  const points = args?.points;
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }
  const xs = points.map((point) => Number(point?.x)).filter(Number.isFinite);
  const ys = points.map((point) => Number(point?.y)).filter(Number.isFinite);
  if (xs.length === 0 || ys.length === 0) {
    return null;
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const strokeWidth = Math.max(
    0,
    Number(args.width ?? args.strokeWidth ?? 0) || 0,
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
  context: any,
  layerId: string,
  args: any,
): PrimitivePaintBounds | null {
  if (args.text === undefined && args.label === undefined) {
    return null;
  }
  const x = Number(args.x);
  const y = Number(args.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const text = String(args.text ?? args.label ?? "");
  const previousFont = context.font;
  if (args.font) {
    context.font = String(args.font);
  }
  const metrics = context.measureText(text);
  context.font = previousFont;
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
  const align = String(args.align ?? args.textAlign ?? "left");
  const baseline = String(args.baseline ?? args.textBaseline ?? "alphabetic");
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
  context: any,
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

function removeLogicalCanvasRasterScale(context: any, matrix: any): any {
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
  matrix: any,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

function unionBounds(
  a: PrimitivePaintBounds,
  b: PrimitivePaintBounds,
): PrimitivePaintBounds {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return {
    height: bottom - y,
    layerId: a.layerId,
    width: right - x,
    x,
    y,
  };
}

function finitePositive(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function finiteScale(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function parseFontSize(font: unknown): number {
  const match = String(font ?? "").match(/(\d+(?:\.\d+)?)px/);
  return match ? Math.max(1, Number(match[1]) || 48) : 48;
}
