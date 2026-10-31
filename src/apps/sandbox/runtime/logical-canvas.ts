import type {
  CanvasFactory,
  CanvasSurface,
  CanvasSurfaceContext,
} from "./canvas-model.js";

export type LogicalCanvasScale = {
  uniform: number;
  x: number;
  y: number;
};

export function createLogicalCanvasFactory<T extends CanvasSurface>({
  createCanvas,
  outputHeight,
  outputWidth,
  renderHeight,
  renderWidth,
}: {
  createCanvas: CanvasFactory<T>;
  outputHeight: number;
  outputWidth: number;
  renderHeight: number;
  renderWidth: number;
}): CanvasFactory<T> {
  const scaleX = normalizeScale(renderWidth, outputWidth);
  const scaleY = normalizeScale(renderHeight, outputHeight);
  return (logicalWidth, logicalHeight) => {
    const width = normalizeDimension(logicalWidth);
    const height = normalizeDimension(logicalHeight);
    const canvas = createCanvas(
      Math.max(1, Math.round(width * scaleX)),
      Math.max(1, Math.round(height * scaleY)),
    );
    canvas.__sniptaleLogicalWidth = width;
    canvas.__sniptaleLogicalHeight = height;
    const context = canvas.getContext("2d", {
      desynchronized: true,
    });
    if (!context) throw new Error("Logical canvas 2D context is unavailable.");
    context.__sniptaleLogicalScaleX = scaleX;
    context.__sniptaleLogicalScaleY = scaleY;
    context.setTransform?.(scaleX, 0, 0, scaleY, 0, 0);
    return canvas;
  };
}

export function getLogicalCanvasSize(
  canvas: Pick<
    CanvasSurface,
    "height" | "width" | "__sniptaleLogicalHeight" | "__sniptaleLogicalWidth"
  >,
): {
  height: number;
  width: number;
} {
  return {
    height: normalizeDimension(canvas.__sniptaleLogicalHeight ?? canvas.height),
    width: normalizeDimension(canvas.__sniptaleLogicalWidth ?? canvas.width),
  };
}

export function getLogicalCanvasScale(
  context: CanvasSurfaceContext,
): LogicalCanvasScale {
  const x = normalizeContextScale(context.__sniptaleLogicalScaleX);
  const y = normalizeContextScale(context.__sniptaleLogicalScaleY);
  return { uniform: Math.sqrt(x * y), x, y };
}

function normalizeScale(renderSize: number, outputSize: number): number {
  return Math.max(
    0.0001,
    normalizeDimension(renderSize) / normalizeDimension(outputSize),
  );
}

function normalizeDimension(value: number): number {
  return Math.max(1, Math.round(Number.isFinite(value) ? value : 1));
}

function normalizeContextScale(value: unknown): number {
  const scale = typeof value === "number" ? value : NaN;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
