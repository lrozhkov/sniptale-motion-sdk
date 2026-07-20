export function recordPreviewFrameCacheResult(state: any, result: any): void {
  if (result.previewCacheHit === true) {
    state.previewFrameCacheHits += 1;
  } else if (result.previewCacheHit === false) {
    state.previewFrameCacheMisses += 1;
  }
  if (Number.isFinite(result.previewCacheBytes)) {
    state.previewFrameCacheBytes = Math.max(
      0,
      Number(result.previewCacheBytes),
    );
  }
  if (typeof result.previewCacheComplete === "boolean") {
    state.previewFrameCacheComplete = result.previewCacheComplete;
  }
  if (Number.isFinite(result.previewCacheEntries)) {
    state.previewFrameCacheEntries = Math.max(
      0,
      Number(result.previewCacheEntries),
    );
  }
  if (Number.isFinite(result.previewCacheEvictions)) {
    state.previewFrameCacheEvictions = Math.max(
      0,
      Number(result.previewCacheEvictions),
    );
  }
  if (Number.isFinite(result.previewCacheFrames)) {
    state.previewFrameCacheFrames = Math.max(
      0,
      Number(result.previewCacheFrames),
    );
  }
  if (Number.isFinite(result.previewCacheRawBytes)) {
    state.previewFrameCacheRawBytes = Math.max(
      0,
      Number(result.previewCacheRawBytes),
    );
  }
  if (
    result.previewCacheStorage === "bitmap" ||
    result.previewCacheStorage === "mixed" ||
    result.previewCacheStorage === "none" ||
    result.previewCacheStorage === "png"
  ) {
    state.previewFrameCacheStorage = result.previewCacheStorage;
  }
  if (Number.isFinite(result.previewCacheStoreMs)) {
    state.previewFrameCacheStoreMs = Math.max(
      0,
      Number(result.previewCacheStoreMs),
    );
  }
  if (Number.isFinite(result.previewCacheTotalFrames)) {
    state.previewFrameCacheTotalFrames = Math.max(
      0,
      Number(result.previewCacheTotalFrames),
    );
  }
}
