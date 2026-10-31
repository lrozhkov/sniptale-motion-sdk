import type { PlaybackVideoCacheState } from "./video-cache-state.js";
import type { ViewerAppContext } from "../app/context.js";
import { cancelPreviewCacheWarm } from "./cache-warm.js";

export async function invalidatePlaybackVideoCache(
  ctx: ViewerAppContext,
): Promise<void> {
  const cache = ctx.state.previewVideoCache;
  const encoder = cache.encoder;
  const pendingCancellation = cache.cancelPromise;
  const url = cache.url;
  const cancellation =
    encoder || pendingCancellation
      ? Promise.all([
          pendingCancellation?.catch(() => undefined),
          encoder?.cancel().catch(() => undefined),
        ])
      : null;
  cache.cancelPromise = cancellation;
  cache.preparePromise = null;
  cache.generation += 1;
  cache.encoder = null;
  if (url) {
    URL.revokeObjectURL(url);
  }
  const video = ctx.refs.cachedPreviewVideo;
  video.pause();
  video.removeAttribute("src");
  video.load();
  video.hidden = true;
  Object.assign(cache, {
    bytes: 0,
    codec: null,
    duration: 0,
    encoder: null,
    error: null,
    fallbackKey: null,
    finalizing: false,
    fps: 0,
    key: null,
    lastPlaybackTime: 0,
    mediaSource: null,
    mimeType: null,
    originalTime: 0,
    pendingSegmentCursor: 0,
    pendingSegmentIndexes: [],
    persistenceMissReason: null,
    persistenceStatus: "idle",
    persistent: false,
    playbackActive: false,
    preparing: false,
    rangeEndFrame: 0,
    rangeEndTime: 0,
    rangeStartFrame: 0,
    rangeStartTime: 0,
    ready: false,
    recording: false,
    restoredSegmentCount: 0,
    segmentBlobs: [],
    segmentIndex: 0,
    segmentPlan: [],
    storageKey: null,
    url: null,
    width: 0,
    height: 0,
  } satisfies Partial<PlaybackVideoCacheState>);
  cancelPreviewCacheWarm(ctx.state);
  ctx.state.previewCacheWarmPrepared = false;
  ctx.state.previewFrameCacheBytes = 0;
  ctx.state.previewFrameCacheComplete = false;
  ctx.state.previewFrameCacheEntries = 0;
  ctx.state.previewFrameCacheFrames = 0;
  ctx.state.previewFrameCacheRawBytes = 0;
  ctx.state.previewFrameCacheStorage = "none";
  ctx.state.previewFrameCacheStoreMs = 0;
  ctx.state.previewFrameCacheTotalFrames = 0;
  if (cancellation) {
    await cancellation;
    if (cache.cancelPromise === cancellation) {
      cache.cancelPromise = null;
    }
  }
}
