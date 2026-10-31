import type { RuntimeCanvas, CanvasFactory } from "./canvas-model.js";

type RasterOptions = {
  createCanvas?: CanvasFactory;
  height?: number;
  opaqueBackground?: boolean;
  width?: number;
};
type RasterSize = { width: number; height: number };

export async function normalizeRenderResult(
  result: unknown,
  context: RasterSize,
  renderSvgToCanvas: (
    markup: string,
    width: number,
    height: number,
  ) => Promise<HTMLCanvasElement | OffscreenCanvas>,
  raster: RasterOptions = {},
): Promise<ImageBitmap> {
  if (
    raster.opaqueBackground === true &&
    raster.createCanvas &&
    isCanvasRenderResult(result)
  ) {
    return copyRenderSourceToRaster(result, raster, rasterSize(raster, result));
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

function isCanvasRenderResult(result: unknown): result is RuntimeCanvas {
  return (
    (typeof OffscreenCanvas !== "undefined" &&
      result instanceof OffscreenCanvas) ||
    (typeof HTMLCanvasElement !== "undefined" &&
      result instanceof HTMLCanvasElement)
  );
}

async function normalizeBitmapRasterSize(
  bitmap: ImageBitmap,
  raster: RasterOptions,
): Promise<ImageBitmap> {
  let returnOriginal = false;
  try {
    if (!raster.createCanvas) {
      returnOriginal = true;
      return bitmap;
    }
    const size = rasterSize(raster, bitmap);
    if (
      bitmap.width === size.width &&
      bitmap.height === size.height &&
      raster.opaqueBackground !== true
    ) {
      returnOriginal = true;
      return bitmap;
    }
    return await copyRenderSourceToRaster(bitmap, raster, size);
  } finally {
    if (!returnOriginal) bitmap.close();
  }
}

function rasterSize(raster: RasterOptions, source: RasterSize): RasterSize {
  const width = raster.width === undefined ? source.width : raster.width;
  const height = raster.height === undefined ? source.height : raster.height;
  if (
    typeof width !== "number" ||
    !Number.isFinite(width) ||
    typeof height !== "number" ||
    !Number.isFinite(height)
  ) {
    throw new RangeError("Raster dimensions must be finite numbers.");
  }
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

async function copyRenderSourceToRaster(
  source: RuntimeCanvas | ImageBitmap,
  raster: RasterOptions,
  { width, height }: RasterSize,
): Promise<ImageBitmap> {
  if (!raster.createCanvas)
    throw new Error("Canvas factory unavailable for raster normalization.");
  const canvas = raster.createCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("2D canvas context unavailable for raster normalization.");
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  if (raster.opaqueBackground === true) {
    // Export codecs require an opaque matte before bitmap transfer.
    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);
  } else context.clearRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  return supportsBitmapTransfer(canvas)
    ? canvas.transferToImageBitmap()
    : await createImageBitmap(canvas);
}

function supportsBitmapTransfer(
  canvas: RuntimeCanvas,
): canvas is OffscreenCanvas {
  return (
    "transferToImageBitmap" in canvas &&
    typeof canvas.transferToImageBitmap === "function"
  );
}
