import { bindViewerAction } from "../app/bind-action.js";
import type { RenderAssetActions } from "./model-contract.js";
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
  > & {
    baseAssets?: ReadonlyMap<string, unknown>;
    sandboxRuntimeGeneration?: number;
  };
  createAssetBitmap(asset: ViewerAsset): Promise<ImageBitmap>;
  logDiagnostic(message: string, severity: string): void;
};
type AssetTemplate = { assets?: unknown; effectId?: unknown; id?: unknown };
export async function createRenderAssets(
  ctx: RenderAssetsContext,
  template: AssetTemplate,
): Promise<RenderAssetTransfer> {
  const runtimeGeneration = ctx.state.sandboxRuntimeGeneration ?? 0;
  const selection = resolveRenderAssetSelection(ctx, template);
  if (ctx.state.sandboxRenderAssetsId === selection.id) {
    return {
      runtimeGeneration,
      cacheKeys: [],
      envelope: { renderAssetsId: selection.id },
      transfer: [],
    };
  }
  const assets = new Map<string, TransferredAsset>();
  const cacheKeys: string[] = [];
  const assetVersions: Array<{
    id: string;
    cacheKey: string;
    sessionKey: string;
  }> = [];
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
        assetVersions.push({ id, cacheKey, sessionKey: sessionCacheKey });
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
    runtimeGeneration,
    assetVersions,
    cacheKeys,
    envelope: {
      assets: Object.fromEntries(assets),
      retainedAssetIds: [
        ...new Set([
          ...ctx.state.assets.keys(),
          ...(ctx.state.baseAssets?.keys() ?? []),
        ]),
      ],
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

export function commitRenderAssetTransfers(
  ctx: Pick<ViewerAppContext, "state">,
  renderAssets: RenderAssetTransfer,
) {
  if (
    renderAssets.runtimeGeneration !== undefined &&
    renderAssets.runtimeGeneration !== (ctx.state.sandboxRuntimeGeneration ?? 0)
  )
    return;
  if (
    ctx.state.renderAssetSelection &&
    ctx.state.renderAssetSelection.id !== renderAssets.envelope.renderAssetsId
  ) {
    resetRenderAssetCache(ctx);
    return;
  }
  const versions = (ctx.state.sandboxAssetVersions ??= new Map());
  if (renderAssets.envelope.retainedAssetIds) {
    const retained = new Set(renderAssets.envelope.retainedAssetIds);
    for (const [id, version] of versions) {
      if (retained.has(id)) continue;
      for (const key of version.sessionKeys)
        ctx.state.sandboxAssetCacheKeys.delete(key);
      versions.delete(id);
    }
  }
  for (const asset of renderAssets.assetVersions ?? []) {
    const previous = versions.get(asset.id);
    if (previous && previous.cacheKey !== asset.cacheKey) {
      for (const key of previous.sessionKeys)
        ctx.state.sandboxAssetCacheKeys.delete(key);
    }
    const current =
      previous?.cacheKey === asset.cacheKey
        ? previous
        : { cacheKey: asset.cacheKey, sessionKeys: new Set<string>() };
    current.sessionKeys.add(asset.sessionKey);
    versions.set(asset.id, current);
  }
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

export function resetRenderAssetCache(ctx: Pick<ViewerAppContext, "state">) {
  ctx.state.sandboxAssetCacheKeys.clear();
  ctx.state.sandboxAssetVersions?.clear();
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

export function createRenderAssetActions(
  getContext: () => ViewerAppContext,
): RenderAssetActions {
  return {
    createRenderAssets: bindViewerAction(createRenderAssets, getContext),
    createAssetBitmap: bindViewerAction(createAssetBitmap, getContext),
    commitRenderAssetTransfers: bindViewerAction(
      commitRenderAssetTransfers,
      getContext,
    ),
    resetRenderAssetCache: bindViewerAction(resetRenderAssetCache, getContext),
  };
}
