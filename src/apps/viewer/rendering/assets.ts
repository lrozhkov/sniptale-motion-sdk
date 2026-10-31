import type { ViewerAsset, RenderAssetSelection } from "../assets/state.js";
import type { RenderAssetTransfer, TransferredAsset } from "./state.js";
import type { ViewerAppContext } from "../app/context.js";
import { serializeSvgTextVectorAsset } from "../../../shared/svg-vector-source.js";

const assetBitmapSourceCache = new WeakMap<object, Promise<ImageBitmap>>();
const assetCacheKeys = new WeakMap<object, string>();
let assetCacheKeySequence = 0;
let renderAssetSelectionSequence = 0;

type RenderAssetsContext = {
  state: Pick<
    ViewerAppContext["state"],
    | "assets"
    | "renderAssetSelection"
    | "sandboxAssetCacheKeys"
    | "sandboxRenderAssetsId"
  >;
  createAssetBitmap(asset: ViewerAsset): Promise<ImageBitmap>;
  logDiagnostic(message: string, severity: string): void;
};
type AssetTemplate = { assets?: unknown; effectId?: unknown; id?: unknown };
export async function createRenderAssets(
  ctx: RenderAssetsContext,
  template: AssetTemplate,
): Promise<RenderAssetTransfer> {
  const selection = resolveRenderAssetSelection(ctx, template);
  if (ctx.state.sandboxRenderAssetsId === selection.id) {
    return {
      cacheKeys: [],
      envelope: { renderAssetsId: selection.id },
      transfer: [],
    };
  }
  const assets = new Map<string, TransferredAsset>();
  const cacheKeys: string[] = [];
  const transfer: ImageBitmap[] = [];
  try {
    for (let index = 0; index < selection.assetIds.length; index += 1) {
      const id = selection.assetIds[index];
      const asset = selection.assetSources[index];
      if (id === undefined) continue;
      if (!asset) {
        ctx.logDiagnostic(
          `${getRouteId(template)}: unknown asset ${id}.`,
          "error",
        );
        continue;
      }
      if (asset.kind === "audio" || asset.mimeType?.startsWith("audio/")) {
        continue;
      }
      const cacheKey = getAssetCacheKey(asset);
      const sessionCacheKey = getSessionAssetCacheKey(template, cacheKey);
      const cachedBySandbox =
        ctx.state.sandboxAssetCacheKeys.has(sessionCacheKey);
      const bitmap: ImageBitmap | null = cachedBySandbox
        ? null
        : await ctx.createAssetBitmap(asset);
      if (bitmap) transfer.push(bitmap);
      const svgVector =
        !cachedBySandbox &&
        asset.mimeType === "image/svg+xml" &&
        typeof asset.svgText === "string"
          ? serializeSvgTextVectorAsset({
              id: asset.id,
              svgText: asset.svgText,
              ...(asset.width == null ? {} : { width: asset.width }),
              ...(asset.height == null ? {} : { height: asset.height }),
            })
          : undefined;
      if (bitmap) {
        cacheKeys.push(sessionCacheKey);
      }
      assets.set(
        id,
        bitmap
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
          : { cacheKey, id: asset.id },
      );
    }
  } catch (error) {
    for (const bitmap of transfer) bitmap.close();
    throw error;
  }
  return {
    cacheKeys,
    envelope: {
      assets: Object.fromEntries(assets),
      renderAssetsId: selection.id,
    },
    transfer,
  };
}

function resolveRenderAssetSelection(
  ctx: RenderAssetsContext,
  template: {
    assets?: unknown;
    effectId?: unknown;
    id?: unknown;
  },
): RenderAssetSelection {
  const routeId = getRouteId(template);
  const assetIds = Array.isArray(template.assets)
    ? template.assets.filter((id): id is string => typeof id === "string")
    : [];
  const assetSources = assetIds.map(
    (assetId) => ctx.state.assets.get(assetId) ?? null,
  );
  const cached = ctx.state.renderAssetSelection;
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

function getRouteId(template: AssetTemplate): string {
  return typeof template.effectId === "string"
    ? template.effectId
    : typeof template.id === "string"
      ? template.id
      : "effect";
}
function getSessionAssetCacheKey(
  template: AssetTemplate,
  cacheKey: string,
): string {
  return `${getRouteId(template)}:${cacheKey}`;
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

function commitRenderAssetTransfers(
  ctx: ViewerAppContext,
  renderAssets: RenderAssetTransfer,
) {
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

export async function createAssetBitmap(
  ctx: ViewerAppContext,
  asset: ViewerAsset,
): Promise<ImageBitmap> {
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

async function createAssetBitmapSource(
  ctx: ViewerAppContext,
  asset: ViewerAsset,
): Promise<ImageBitmap> {
  if (asset.mimeType === "image/svg+xml")
    return await ctx.rasterizeSvgAsset(asset);
  if (!asset.blob)
    throw new Error(`Asset ${asset.id} has no materialized content.`);
  return await createImageBitmap(asset.blob);
}

export function calculateSvgRasterSize(
  asset: {
    width?: number | null | undefined;
    height?: number | null | undefined;
  },
  image: { naturalWidth: number; naturalHeight: number },
) {
  const sourceWidth = positiveDimension(asset.width, image.naturalWidth);
  const sourceHeight = positiveDimension(asset.height, image.naturalHeight);
  const longEdge = Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(8, 1800 / longEdge);
  return {
    height: Math.max(1, Math.round(sourceHeight * scale)),
    width: Math.max(1, Math.round(sourceWidth * scale)),
  };
}

function positiveDimension(
  metadata: number | null | undefined,
  natural: number,
): number {
  if (typeof metadata === "number" && Number.isFinite(metadata) && metadata > 0)
    return metadata;
  return Number.isFinite(natural) && natural > 0 ? natural : 512;
}

function getSvgRasterSize(
  _ctx: ViewerAppContext,
  asset: ViewerAsset,
  image: HTMLImageElement,
) {
  return calculateSvgRasterSize(asset, image);
}

export function installRenderingAssetsOwner(ctx: ViewerAppContext): void {
  ctx.createRenderAssets = createRenderAssets.bind(undefined, ctx);
  ctx.createAssetBitmap = createAssetBitmap.bind(undefined, ctx);
  ctx.commitRenderAssetTransfers = commitRenderAssetTransfers.bind(
    undefined,
    ctx,
  );
  ctx.resetRenderAssetCache = resetRenderAssetCache.bind(undefined, ctx);
  ctx.getSvgRasterSize = getSvgRasterSize.bind(undefined, ctx);
}
