import type { ViewerAppContext } from "../app/context.js";
import { serializeSvgTextVectorAsset } from "../../../shared/svg-vector-source.js";

const assetBitmapSourceCache = new WeakMap<object, Promise<ImageBitmap>>();
const assetCacheKeys = new WeakMap<object, string>();
let assetCacheKeySequence = 0;
let renderAssetSelectionSequence = 0;

type RenderAssetSelection = {
  assetIds: string[];
  assetSources: Array<any | null>;
  id: string;
  routeId: string;
};

async function createRenderAssets(ctx: ViewerAppContext, template) {
  const selection = resolveRenderAssetSelection(ctx, template);
  if (ctx.state.sandboxRenderAssetsId === selection.id) {
    return {
      cacheKeys: [],
      envelope: { renderAssetsId: selection.id },
      transfer: [],
    };
  }
  const assets: Record<string, any> = {};
  const cacheKeys: string[] = [];
  const transfer: ImageBitmap[] = [];
  for (let index = 0; index < selection.assetIds.length; index += 1) {
    const id = selection.assetIds[index];
    const asset = selection.assetSources[index];
    if (!asset) {
      ctx.logDiagnostic(`${template.id}: unknown asset ${id}.`, "error");
      continue;
    }
    if (
      asset.kind === "audio" ||
      String(asset.mimeType ?? "").startsWith("audio/")
    ) {
      continue;
    }
    const cacheKey = getAssetCacheKey(asset);
    const sessionCacheKey = getSessionAssetCacheKey(template, cacheKey);
    const cachedBySandbox =
      ctx.state.sandboxAssetCacheKeys.has(sessionCacheKey);
    const bitmap = cachedBySandbox ? null : await ctx.createAssetBitmap(asset);
    const svgVector =
      !cachedBySandbox &&
      asset.mimeType === "image/svg+xml" &&
      typeof asset.svgText === "string"
        ? serializeSvgTextVectorAsset(asset)
        : undefined;
    if (bitmap) {
      transfer.push(bitmap);
      cacheKeys.push(sessionCacheKey);
    }
    assets[id] = bitmap
      ? {
          bitmap,
          cacheKey,
          height: asset.height ?? bitmap.height,
          id: asset.id,
          kind: asset.kind,
          mimeType: asset.mimeType,
          path: asset.path,
          svgText: asset.svgText,
          svgVector,
          width: asset.width ?? bitmap.width,
        }
      : { cacheKey, id: asset.id };
  }
  return {
    cacheKeys,
    envelope: { assets, renderAssetsId: selection.id },
    transfer,
  };
}

function resolveRenderAssetSelection(
  ctx: ViewerAppContext,
  template: {
    assets?: unknown;
    effectId?: unknown;
    id?: unknown;
  },
): RenderAssetSelection {
  const routeId = String(template.effectId ?? template.id ?? "effect");
  const assetIds = Array.isArray(template.assets)
    ? template.assets.map(String)
    : [];
  const assetSources = assetIds.map(
    (assetId) => ctx.state.assets.get(assetId) ?? null,
  );
  const cached = ctx.state.renderAssetSelection as RenderAssetSelection | null;
  if (
    cached?.routeId === routeId &&
    cached.assetIds.length === assetIds.length &&
    cached.assetIds.every((assetId, index) => assetId === assetIds[index]) &&
    cached.assetSources.every(
      (assetSource, index) => assetSource === assetSources[index],
    )
  ) {
    return cached;
  }
  renderAssetSelectionSequence += 1;
  const selection = {
    assetIds,
    assetSources,
    id: `render-assets-${renderAssetSelectionSequence}`,
    routeId,
  };
  ctx.state.renderAssetSelection = selection;
  return selection;
}

function getSessionAssetCacheKey(template: any, cacheKey: string): string {
  return `${template?.effectId ?? template?.id ?? "effect"}:${cacheKey}`;
}

function getAssetCacheKey(asset: object): string {
  let cacheKey = assetCacheKeys.get(asset);
  if (!cacheKey) {
    assetCacheKeySequence += 1;
    cacheKey = `asset-${assetCacheKeySequence}`;
    assetCacheKeys.set(asset, cacheKey);
  }
  return cacheKey;
}

function commitRenderAssetTransfers(ctx: ViewerAppContext, renderAssets) {
  for (const cacheKey of renderAssets?.cacheKeys ?? []) {
    if (!ctx.state.sandboxAssetCacheKeys.has(cacheKey)) {
      ctx.state.sandboxAssetCacheKeys.add(cacheKey);
      ctx.state.assetBitmapTransfers += 1;
    }
  }
  const renderAssetsId = renderAssets?.envelope?.renderAssetsId;
  if (
    typeof renderAssetsId === "string" &&
    ctx.state.sandboxRenderAssetsId !== renderAssetsId
  ) {
    ctx.state.sandboxRenderAssetsId = renderAssetsId;
    ctx.state.assetEnvelopeTransfers =
      (Number(ctx.state.assetEnvelopeTransfers) || 0) + 1;
  }
}

function resetRenderAssetCache(ctx: ViewerAppContext) {
  ctx.state.sandboxAssetCacheKeys.clear();
  ctx.state.sandboxRenderAssetsId = null;
}

async function createAssetBitmap(ctx: ViewerAppContext, asset) {
  let sourcePromise = assetBitmapSourceCache.get(asset);
  if (!sourcePromise) {
    sourcePromise = createAssetBitmapSource(ctx, asset).catch((error) => {
      assetBitmapSourceCache.delete(asset);
      throw error;
    });
    assetBitmapSourceCache.set(asset, sourcePromise);
  }
  return await createImageBitmap(await sourcePromise);
}

async function createAssetBitmapSource(ctx: ViewerAppContext, asset) {
  return asset.mimeType === "image/svg+xml"
    ? await ctx.rasterizeSvgAsset(asset)
    : await createImageBitmap(asset.blob);
}

export function calculateSvgRasterSize(asset, image) {
  const sourceWidth = Math.max(1, asset.width ?? image.naturalWidth ?? 512);
  const sourceHeight = Math.max(1, asset.height ?? image.naturalHeight ?? 512);
  const longEdge = Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(8, 1800 / longEdge);
  return {
    height: Math.max(1, Math.round(sourceHeight * scale)),
    width: Math.max(1, Math.round(sourceWidth * scale)),
  };
}

function getSvgRasterSize(_ctx: ViewerAppContext, asset, image) {
  return calculateSvgRasterSize(asset, image);
}

export function installRenderingAssetsOwner(ctx: ViewerAppContext): void {
  ctx.createRenderAssets = (...args: any[]) =>
    (createRenderAssets as any)(ctx, ...args);
  ctx.createAssetBitmap = (...args: any[]) =>
    (createAssetBitmap as any)(ctx, ...args);
  ctx.commitRenderAssetTransfers = (...args: any[]) =>
    (commitRenderAssetTransfers as any)(ctx, ...args);
  ctx.resetRenderAssetCache = (...args: any[]) =>
    (resetRenderAssetCache as any)(ctx, ...args);
  ctx.getSvgRasterSize = (...args: any[]) =>
    (getSvgRasterSize as any)(ctx, ...args);
}
