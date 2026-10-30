export async function normalizeRenderResult(
  result: unknown,
  context: { height: number; width: number },
  renderSvgToCanvas: (
    markup: string,
    width: number,
    height: number,
  ) => Promise<HTMLCanvasElement | OffscreenCanvas>,
  raster: {
    createCanvas?: (width: number, height: number) => any;
    height?: number;
    opaqueBackground?: boolean;
    width?: number;
  } = {},
): Promise<ImageBitmap> {
  if (
    raster.opaqueBackground === true &&
    raster.createCanvas &&
    isCanvasRenderResult(result)
  ) {
    return copyRenderSourceToRaster(result, raster, false);
  }
  let bitmap: ImageBitmap;
  if (typeof ImageBitmap !== "undefined" && result instanceof ImageBitmap) {
    bitmap = result;
  } else if (
    typeof OffscreenCanvas !== "undefined" &&
    result instanceof OffscreenCanvas
  ) {
    bitmap =
      typeof result.transferToImageBitmap === "function"
        ? result.transferToImageBitmap()
        : await createImageBitmap(result);
  } else if (
    typeof HTMLCanvasElement !== "undefined" &&
    result instanceof HTMLCanvasElement
  ) {
    bitmap = await createImageBitmap(result);
  } else if (typeof result === "string") {
    bitmap = await createImageBitmap(
      await renderSvgToCanvas(result, context.width, context.height),
    );
  } else {
    throw new Error(
      "Effect renderFrame must return a bitmap, canvas, or SVG string.",
    );
  }
  return normalizeBitmapRasterSize(bitmap, raster);
}

function isCanvasRenderResult(result: unknown): boolean {
  return (
    (typeof OffscreenCanvas !== "undefined" &&
      result instanceof OffscreenCanvas) ||
    (typeof HTMLCanvasElement !== "undefined" &&
      result instanceof HTMLCanvasElement)
  );
}

async function normalizeBitmapRasterSize(
  bitmap: ImageBitmap,
  raster: {
    createCanvas?: (width: number, height: number) => any;
    height?: number;
    opaqueBackground?: boolean;
    width?: number;
  },
): Promise<ImageBitmap> {
  const width = Math.max(1, Math.round(Number(raster.width) || 0));
  const height = Math.max(1, Math.round(Number(raster.height) || 0));
  if (
    !raster.createCanvas ||
    !Number.isFinite(Number(raster.width)) ||
    !Number.isFinite(Number(raster.height)) ||
    (bitmap.width === width &&
      bitmap.height === height &&
      raster.opaqueBackground !== true)
  ) {
    return bitmap;
  }
  return copyRenderSourceToRaster(bitmap, raster, true);
}

async function copyRenderSourceToRaster(
  source: any,
  raster: {
    createCanvas?: (width: number, height: number) => any;
    height?: number;
    opaqueBackground?: boolean;
    width?: number;
  },
  closeSource: boolean,
): Promise<ImageBitmap> {
  const width = Math.max(1, Math.round(Number(raster.width) || 0));
  const height = Math.max(1, Math.round(Number(raster.height) || 0));
  if (!raster.createCanvas) {
    throw new Error("Canvas factory unavailable for raster normalization.");
  }
  const canvas = raster.createCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("2D canvas context unavailable for raster normalization.");
  }
  context.setTransform?.(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  if (raster.opaqueBackground === true) {
    // Export codecs do not preserve canvas alpha. Flatten before the bitmap
    // crosses the worker boundary so GPU-specific alpha premultiplication
    // cannot change partially transparent colors from frame to frame.
    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);
  } else {
    context.clearRect(0, 0, width, height);
  }
  context.drawImage(source, 0, 0, width, height);
  if (closeSource) source.close?.();
  return typeof canvas.transferToImageBitmap === "function"
    ? canvas.transferToImageBitmap()
    : await createImageBitmap(canvas);
}
