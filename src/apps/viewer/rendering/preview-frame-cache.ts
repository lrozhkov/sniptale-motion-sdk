import type { ViewerAppContext } from "../app/context.js";
export function recordPreviewFrameCacheResult(
  state: Pick<
    ViewerAppContext["state"],
    | "previewFrameCacheBytes"
    | "previewFrameCacheComplete"
    | "previewFrameCacheEntries"
    | "previewFrameCacheEvictions"
    | "previewFrameCacheFrames"
    | "previewFrameCacheHits"
    | "previewFrameCacheMisses"
    | "previewFrameCacheRawBytes"
    | "previewFrameCacheStorage"
    | "previewFrameCacheStoreMs"
    | "previewFrameCacheTotalFrames"
  >,
  result: PreviewFrameCacheMetrics,
): void {
  if (result.previewCacheHit === true) {
    state.previewFrameCacheHits += 1;
  } else if (result.previewCacheHit === false) {
    state.previewFrameCacheMisses += 1;
  }
  if (
    typeof result.previewCacheBytes === "number" &&
    Number.isFinite(result.previewCacheBytes)
  ) {
    state.previewFrameCacheBytes = Math.max(0, result.previewCacheBytes);
  }
  if (typeof result.previewCacheComplete === "boolean") {
    state.previewFrameCacheComplete = result.previewCacheComplete;
  }
  if (
    typeof result.previewCacheEntries === "number" &&
    Number.isFinite(result.previewCacheEntries)
  ) {
    state.previewFrameCacheEntries = Math.max(0, result.previewCacheEntries);
  }
  if (
    typeof result.previewCacheEvictions === "number" &&
    Number.isFinite(result.previewCacheEvictions)
  ) {
    state.previewFrameCacheEvictions = Math.max(
      0,
      result.previewCacheEvictions,
    );
  }
  if (
    typeof result.previewCacheFrames === "number" &&
    Number.isFinite(result.previewCacheFrames)
  ) {
    state.previewFrameCacheFrames = Math.max(0, result.previewCacheFrames);
  }
  if (
    typeof result.previewCacheRawBytes === "number" &&
    Number.isFinite(result.previewCacheRawBytes)
  ) {
    state.previewFrameCacheRawBytes = Math.max(0, result.previewCacheRawBytes);
  }
  if (
    result.previewCacheStorage === "bitmap" ||
    result.previewCacheStorage === "mixed" ||
    result.previewCacheStorage === "none" ||
    result.previewCacheStorage === "png"
  ) {
    state.previewFrameCacheStorage = result.previewCacheStorage;
  }
  if (
    typeof result.previewCacheStoreMs === "number" &&
    Number.isFinite(result.previewCacheStoreMs)
  ) {
    state.previewFrameCacheStoreMs = Math.max(0, result.previewCacheStoreMs);
  }
  if (
    typeof result.previewCacheTotalFrames === "number" &&
    Number.isFinite(result.previewCacheTotalFrames)
  ) {
    state.previewFrameCacheTotalFrames = Math.max(
      0,
      result.previewCacheTotalFrames,
    );
  }
}

type PreviewFrameCacheMetrics = {
  previewCacheHit?: unknown;
  previewCacheBytes?: unknown;
  previewCacheComplete?: unknown;
  previewCacheEntries?: unknown;
  previewCacheEvictions?: unknown;
  previewCacheFrames?: unknown;
  previewCacheRawBytes?: unknown;
  previewCacheStorage?: unknown;
  previewCacheStoreMs?: unknown;
  previewCacheTotalFrames?: unknown;
};
