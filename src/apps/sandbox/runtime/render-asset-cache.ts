import { parseRetainedAssetIds } from "../../../shared/render-asset-retention.js";
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
    resolve(
      value: unknown,
      selectionIdValue?: unknown,
      retainedIdsValue?: unknown,
    ) {
      const selectionId = parseSelectionId(selectionIdValue);
      const retainedIds =
        retainedIdsValue === undefined
          ? undefined
          : parseRetainedAssetIds(retainedIdsValue);
      if (retainedIds === null)
        throw new Error("Expected valid retained asset ids.");
      if (value === undefined && selectionId) {
        if (currentSelection?.id !== selectionId) {
          throw new Error(`Missing cached render asset set ${selectionId}.`);
        }
        return currentSelection.assets;
      }
      const retained = retainedIds === undefined ? null : new Set(retainedIds);
      const nextEntries = new Map(entries);
      const resolvedAssets = new Map<string, CachedRenderAsset>();
      if (value == null) {
        return Object.fromEntries(resolvedAssets);
      }
      if (!isRecord(value)) {
        throw new Error("Expected render assets to be an object.");
      }
      try {
        for (const [assetId, candidate] of Object.entries(value)) {
          const asset = parseRenderAsset(assetId, candidate);
          const incomingBitmap = readBitmap(candidate);
          const cached = nextEntries.get(asset.cacheKey);
          if (cached && cached.id !== asset.id)
            throw new Error(`Cached render asset id mismatch for ${assetId}.`);
          if (incomingBitmap) {
            for (const [key, previous] of nextEntries) {
              if (previous.id === asset.id && key !== asset.cacheKey)
                nextEntries.delete(key);
            }
            const next = {
              ...cached,
              ...asset,
              bitmap: incomingBitmap,
            } as CachedRenderAsset;
            nextEntries.set(asset.cacheKey, next);
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
        if (retained) {
          if ([...resolvedAssets.keys()].some((id) => !retained.has(id)))
            throw new Error("Active assets must be retained.");
          for (const [key, asset] of nextEntries)
            if (!retained.has(asset.id)) nextEntries.delete(key);
        }
      } catch (error) {
        const previous = new Set<unknown>(
          [...entries.values()].map((asset) => asset.bitmap),
        );
        for (const candidate of Object.values(value)) {
          const bitmap: unknown = isRecord(candidate) ? candidate.bitmap : null;
          if (
            isRecord(bitmap) &&
            typeof bitmap.close === "function" &&
            !previous.has(bitmap)
          ) {
            previous.add(bitmap);
            bitmap.close();
          }
        }
        throw error;
      }
      const kept = new Set(
        [...nextEntries.values()].map((asset) => asset.bitmap),
      );
      const closed = new Set<BitmapLike>();
      for (const asset of entries.values()) {
        if (!kept.has(asset.bitmap) && !closed.has(asset.bitmap)) {
          asset.bitmap.close();
          closed.add(asset.bitmap);
        }
      }
      entries.clear();
      for (const [key, asset] of nextEntries) entries.set(key, asset);
      const assets = Object.fromEntries(resolvedAssets);
      currentSelection = selectionId ? { assets, id: selectionId } : null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
