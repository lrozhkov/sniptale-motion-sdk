import type {
  RuntimeCanvasContext,
  PrimitiveLayerReference,
} from "./canvas-model.js";

export type BitmapAsset = {
  bitmap?: ImageBitmap | null;
  height?: number;
  width?: number;
};
export type ImageAssetDrawOptions = PrimitiveLayerReference & {
  alpha?: number;
  fit?: "contain" | "cover" | "fill";
  height?: number;
  opacity?: number;
  rotate?: number;
  scale?: number;
  composite?: GlobalCompositeOperation;
  filter?: string;
  shadowBlur?: number;
  shadowColor?: string;
  width?: number;
  x?: number;
  y?: number;
};
export type AssetTrailDrawOptions = ImageAssetDrawOptions & {
  count?: number;
  dx?: number;
  dy?: number;
  rotateStep?: number;
  scaleStep?: number;
};

export function drawImageAsset(
  context: RuntimeCanvasContext,
  asset: BitmapAsset | null | undefined,
  args?: ImageAssetDrawOptions | null,
): void {
  if (!asset || !asset.bitmap) {
    return;
  }
  const {
    alpha = 1,
    fit = "contain",
    height = asset.height ?? asset.bitmap.height,
    opacity = alpha,
    rotate = 0,
    scale = 1,
    composite = "source-over",
    filter = "none",
    shadowBlur = 0,
    shadowColor = "transparent",
    width = asset.width ?? asset.bitmap.width,
    x = 0,
    y = 0,
  } = args ?? {};
  const drawWidth = width * scale;
  const drawHeight = height * scale;
  const sourceWidth = asset.bitmap.width;
  const sourceHeight = asset.bitmap.height;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;
  if (fit === "cover") {
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = drawWidth / drawHeight;
    if (sourceRatio > targetRatio) {
      sw = sourceHeight * targetRatio;
      sx = (sourceWidth - sw) * 0.5;
    } else {
      sh = sourceWidth / targetRatio;
      sy = (sourceHeight - sh) * 0.5;
    }
  }
  context.save();
  context.globalAlpha *= opacity;
  context.globalCompositeOperation = composite;
  context.filter = filter;
  context.shadowBlur = shadowBlur;
  context.shadowColor = shadowColor;
  context.translate(x + drawWidth * 0.5, y + drawHeight * 0.5);
  context.rotate(rotate);
  context.drawImage(
    asset.bitmap,
    sx,
    sy,
    sw,
    sh,
    -drawWidth * 0.5,
    -drawHeight * 0.5,
    drawWidth,
    drawHeight,
  );
  context.restore();
}

export function drawAssetTrail(
  context: RuntimeCanvasContext,
  asset: BitmapAsset | null | undefined,
  args?: AssetTrailDrawOptions | null,
): void {
  if (!asset || !asset.bitmap) {
    return;
  }
  const {
    alpha = 0.36,
    count = 8,
    dx = 0,
    dy = 0,
    filter = "none",
    height = asset.height ?? asset.bitmap.height,
    rotateStep = 0,
    scale = 1,
    scaleStep = 0,
    width = asset.width ?? asset.bitmap.width,
    x = 0,
    y = 0,
  } = args ?? {};
  const steps = Math.max(1, Math.floor(count));
  for (let i = steps - 1; i >= 0; i -= 1) {
    const t = steps <= 1 ? 1 : i / (steps - 1);
    drawImageAsset(context, asset, {
      alpha: alpha * Math.pow(1 - t, 1.4),
      composite: "lighter",
      filter,
      height,
      rotate: rotateStep * i,
      scale: scale + scaleStep * i,
      width,
      x: x - dx * i,
      y: y - dy * i,
    });
  }
}

export function closeAssetBitmaps(assets: unknown): void {
  if (!assets || typeof assets !== "object") {
    return;
  }
  for (const asset of Object.values(assets)) {
    const bitmap: unknown = isRecord(asset) ? (asset.bitmap ?? asset) : asset;
    if (isRecord(bitmap) && typeof bitmap.close === "function") {
      const result: unknown = Reflect.apply(bitmap.close, bitmap, []);
      void Promise.resolve(result).catch(() => {});
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
