type CanvasFactory = (width: number, height: number) => any;

export type LogicalCanvas = {
  __sniptaleLogicalHeight?: number;
  __sniptaleLogicalWidth?: number;
  getContext: (kind: string, options?: { desynchronized?: boolean }) => any;
  height: number;
  width: number;
};

type LogicalCanvasContext = {
  __sniptaleLogicalScaleX?: number;
  __sniptaleLogicalScaleY?: number;
  setTransform?: (
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number,
  ) => void;
};

export type LogicalCanvasScale = {
  uniform: number;
  x: number;
  y: number;
};

export function createLogicalCanvasFactory({
  createCanvas,
  outputHeight,
  outputWidth,
  renderHeight,
  renderWidth,
}: {
  createCanvas: CanvasFactory;
  outputHeight: number;
  outputWidth: number;
  renderHeight: number;
  renderWidth: number;
}): CanvasFactory {
  const scaleX = normalizeScale(renderWidth, outputWidth);
  const scaleY = normalizeScale(renderHeight, outputHeight);
  return (logicalWidth, logicalHeight) => {
    const width = normalizeDimension(logicalWidth);
    const height = normalizeDimension(logicalHeight);
    const canvas = createCanvas(
      Math.max(1, Math.round(width * scaleX)),
      Math.max(1, Math.round(height * scaleY)),
    ) as LogicalCanvas;
    canvas.__sniptaleLogicalWidth = width;
    canvas.__sniptaleLogicalHeight = height;
    const context = canvas.getContext?.("2d", {
      desynchronized: true,
    }) as LogicalCanvasContext | null;
    if (context) {
      context.__sniptaleLogicalScaleX = scaleX;
      context.__sniptaleLogicalScaleY = scaleY;
    }
    context?.setTransform?.(scaleX, 0, 0, scaleY, 0, 0);
    return canvas;
  };
}

export function getLogicalCanvasSize(
  canvas: Pick<
    LogicalCanvas,
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
  context: LogicalCanvasContext,
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
  return Math.max(1, Math.round(Number(value) || 1));
}

function normalizeContextScale(value: unknown): number {
  const scale = Number(value);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}
