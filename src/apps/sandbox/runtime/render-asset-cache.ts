import { parseSerializedSvgVector } from "./svg-vector-payload.js";

type BitmapLike = {
  close: () => void;
  height: number;
  width: number;
};

type CachedRenderAsset = {
  bitmap: BitmapLike;
  cacheKey: string;
  height?: number | undefined;
  id: string;
  kind?: string | undefined;
  mimeType?: string | undefined;
  path?: string | undefined;
  svgText?: string | undefined;
  svgVector?: ReturnType<typeof parseSerializedSvgVector> | undefined;
  width?: number | undefined;
};

export function createRenderAssetCache() {
  const entries = new Map<string, CachedRenderAsset>();
  let currentSelection: {
    assets: Record<string, CachedRenderAsset>;
    id: string;
  } | null = null;

  return {
    close() {
      for (const asset of entries.values()) {
        asset.bitmap.close();
      }
      entries.clear();
      currentSelection = null;
    },
    resolve(value: unknown, selectionIdValue?: unknown) {
      const selectionId = parseSelectionId(selectionIdValue);
      if (value === undefined && selectionId) {
        if (currentSelection?.id !== selectionId) {
          throw new Error(`Missing cached render asset set ${selectionId}.`);
        }
        return currentSelection.assets;
      }
      const resolvedAssets = new Map<string, CachedRenderAsset>();
      if (value == null) {
        return Object.fromEntries(resolvedAssets);
      }
      if (!isRecord(value)) {
        throw new Error("Expected render assets to be an object.");
      }
      for (const [assetId, candidate] of Object.entries(value)) {
        const asset = parseRenderAsset(assetId, candidate);
        const incomingBitmap = readBitmap(candidate);
        const cached = entries.get(asset.cacheKey);
        if (incomingBitmap) {
          if (cached?.bitmap && cached.bitmap !== incomingBitmap) {
            cached.bitmap.close();
          }
          const next = {
            ...cached,
            ...asset,
            bitmap: incomingBitmap,
          } as CachedRenderAsset;
          entries.set(asset.cacheKey, next);
          resolvedAssets.set(assetId, next);
          continue;
        }
        if (!cached) {
          throw new Error(`Missing cached bitmap for asset ${assetId}.`);
        }
        if (cached.id !== asset.id) {
          throw new Error(`Cached render asset id mismatch for ${assetId}.`);
        }
        resolvedAssets.set(assetId, cached);
      }
      const assets = Object.fromEntries(resolvedAssets);
      if (selectionId) {
        currentSelection = { assets, id: selectionId };
      }
      return assets;
    },
    size() {
      return entries.size;
    },
  };
}

function parseSelectionId(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }
  if (typeof value !== "string" || value.length === 0 || value.length > 128) {
    throw new Error("Expected a valid render asset set id.");
  }
  return value;
}

function parseRenderAsset(
  assetId: string,
  value: unknown,
): Omit<CachedRenderAsset, "bitmap"> {
  if (!isRecord(value)) {
    throw new Error(`Expected render asset ${assetId} to be an object.`);
  }
  const cacheKey = readRequiredString(value.cacheKey, "cacheKey", assetId);
  const id = readRequiredString(value.id, "id", assetId);
  if (id !== assetId) {
    throw new Error(`Render asset id mismatch for ${assetId}.`);
  }
  return {
    cacheKey,
    height: readOptionalNumber(value.height, "height", assetId),
    id,
    kind: readOptionalString(value.kind, "kind", assetId),
    mimeType: readOptionalString(value.mimeType, "mimeType", assetId),
    path: readOptionalString(value.path, "path", assetId),
    svgText: readOptionalString(value.svgText, "svgText", assetId),
    svgVector: readOptionalSvgVector(value.svgVector, assetId),
    width: readOptionalNumber(value.width, "width", assetId),
  };
}

function readOptionalSvgVector(value: unknown, assetId: string) {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = parseSerializedSvgVector(value);
  if (!parsed) {
    throw new Error(`Expected svgVector for render asset ${assetId}.`);
  }
  return parsed;
}

function readBitmap(value: unknown): BitmapLike | null {
  if (!isRecord(value) || value.bitmap == null) {
    return null;
  }
  const bitmap = value.bitmap;
  if (
    !isRecord(bitmap) ||
    typeof bitmap.close !== "function" ||
    typeof bitmap.height !== "number" ||
    !Number.isFinite(bitmap.height) ||
    typeof bitmap.width !== "number" ||
    !Number.isFinite(bitmap.width)
  ) {
    throw new Error("Expected render asset bitmap to be an ImageBitmap.");
  }
  return bitmap as BitmapLike;
}

function readRequiredString(
  value: unknown,
  field: string,
  assetId: string,
): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    throw new Error(`Expected ${field} for render asset ${assetId}.`);
  }
  return value;
}

function readOptionalString(
  value: unknown,
  field: string,
  assetId: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected ${field} for render asset ${assetId}.`);
  }
  return value;
}

function readOptionalNumber(
  value: unknown,
  field: string,
  assetId: string,
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Expected ${field} for render asset ${assetId}.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
