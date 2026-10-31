import { bindViewerAction } from "../app/bind-action.js";
import type { PlaybackVideoCacheActions } from "./contract.js";
import type { PlaybackVideoCacheState } from "./video-cache-state.js";
import type { PlaybackVideoCacheMode } from "./video-cache-state.js";
import type { ViewerAppContext } from "../app/context.js";
import { fallBackToExactFrameCache } from "./video-cache-fallback.js";
import {
  createPlaybackVideoCacheKey,
  createPlaybackVideoCacheSegmentFingerprint,
  createPlaybackVideoCacheStorageKey,
  isPlaybackVideoCacheCurrent,
  isPlaybackVideoCacheEligible,
  resolvePlaybackVideoCacheRange,
  shouldPreferPlaybackVideoCache,
} from "./video-cache-key.js";
import { restorePersistentPlaybackVideoCache } from "./video-cache-persistence.js";
import {
  activateCachedVideoPlayback,
  hidePlaybackVideoCacheSurface,
  stopPlaybackVideoCache,
  syncPlaybackVideoCache,
} from "./video-cache-playback.js";
import { capturePlaybackVideoCacheFrame } from "./video-cache-recording.js";
import { invalidatePlaybackVideoCache } from "./video-cache-reset.js";
import { createPlaybackVideoCacheSegmentPlan } from "./video-cache-segments.js";
import { beginPlaybackVideoSegmentWarm } from "./video-cache-warm.js";

export { invalidatePlaybackVideoCache } from "./video-cache-reset.js";
export {
  hidePlaybackVideoCacheSurface,
  stopPlaybackVideoCache,
  syncPlaybackVideoCache,
} from "./video-cache-playback.js";
export { capturePlaybackVideoCacheFrame } from "./video-cache-recording.js";

const MIN_VIDEO_CACHE_FPS = 6;

export function beginPlaybackVideoCache(
  ctx: ViewerAppContext,
): Promise<PlaybackVideoCacheMode> {
  const cache = ctx.state.previewVideoCache;
  const activePreparation = cache.preparePromise;
  if (activePreparation) {
    return activePreparation;
  }
  let trackedPreparation: Promise<PlaybackVideoCacheMode>;
  trackedPreparation = preparePlaybackVideoCache(ctx).finally(() => {
    if (cache.preparePromise === trackedPreparation) {
      cache.preparePromise = null;
      ctx.syncPlaybackButtons?.();
      ctx.syncPlaybackCacheButton?.();
    }
  });
  cache.preparePromise = trackedPreparation;
  return trackedPreparation;
}

async function preparePlaybackVideoCache(
  ctx: ViewerAppContext,
): Promise<PlaybackVideoCacheMode> {
  const template = ctx.state.currentTemplate;
  if (!template || !isPlaybackVideoCacheEligible(ctx, template)) {
    return "unavailable";
  }
  const cache = ctx.state.previewVideoCache;
  const fps = Math.max(1, Number(ctx.refs.fpsInput.value) || 30);
  const duration = ctx.getEffectiveDuration(template);
  const key = createPlaybackVideoCacheKey(ctx, template, fps, duration);
  const storageKey = createPlaybackVideoCacheStorageKey(
    ctx,
    template,
    fps,
    duration,
  );
  const range = resolvePlaybackVideoCacheRange(ctx, duration, fps);
  const segmentPlan = createPlaybackVideoCacheSegmentPlan(range, fps, true).map(
    (segment) => ({
      ...segment,
      fingerprint: createPlaybackVideoCacheSegmentFingerprint(
        ctx,
        template,
        fps,
        duration,
        segment,
      ),
    }),
  );
  if (cache.ready && cache.key === key && cache.url) {
    activateCachedVideoPlayback(ctx, Number(ctx.refs.timeSlider.value) || 0);
    return "playback";
  }
  if (
    cache.key === key &&
    cache.encoder &&
    (cache.recording || cache.finalizing)
  ) {
    cache.error = null;
    cache.preparing = false;
    ctx.state.previewFrameCacheStorage = "video-recording";
    return "recording";
  }
  if (cache.fallbackKey === key) {
    return "unavailable";
  }
  if (fps < MIN_VIDEO_CACHE_FPS) {
    if (cache.key || cache.fallbackKey) {
      await invalidatePlaybackVideoCache(ctx);
    }
    return "unavailable";
  }
  const invalidation = invalidatePlaybackVideoCache(ctx);
  const generation = cache.generation;
  await invalidation;
  if (
    generation !== cache.generation ||
    !isPreviewCacheEnabled(ctx) ||
    ctx.state.currentTemplate?.id !== template.id
  ) {
    return "unavailable";
  }
  const rasterSize = ctx.getPreviewRasterSize();
  const identity = {
    duration,
    fps,
    height: rasterSize.height,
    key: storageKey,
    rangeEndFrame: range.endFrame,
    rangeEndTime: range.endTime,
    rangeStartFrame: range.startFrame,
    rangeStartTime: range.startTime,
    templateId: template.id,
    width: rasterSize.width,
    contentKey: key,
    segments: segmentPlan,
  };
  Object.assign(cache, {
    duration,
    fps,
    height: rasterSize.height,
    key,
    originalTime: Math.max(
      range.startTime,
      Math.min(
        range.endTime,
        Number(ctx.refs.timeSlider.value) || range.startTime,
      ),
    ),
    preparing: true,
    rangeEndFrame: range.endFrame,
    rangeEndTime: range.endTime,
    rangeStartFrame: range.startFrame,
    rangeStartTime: range.startTime,
    restoredSegmentCount: 0,
    segmentBlobs: Array.from(
      { length: segmentPlan.length },
      (): Blob | null => null,
    ),
    segmentPlan,
    storageKey,
    width: rasterSize.width,
  } satisfies Partial<PlaybackVideoCacheState>);
  const restored = await restorePersistentPlaybackVideoCache(
    ctx,
    identity,
    generation,
  );
  if (restored.mode === "complete") {
    if (
      generation === cache.generation &&
      ctx.state.playing &&
      ctx.state.currentTemplate?.id === template.id
    ) {
      activateCachedVideoPlayback(ctx, cache.originalTime);
    }
    return "playback";
  }
  try {
    const { createPlaybackVideoCacheEncoder } =
      await import("./video-cache-encoder.js");
    const encoder = await createPlaybackVideoCacheEncoder({
      fps,
      height: rasterSize.height,
      preferredCodec:
        restored.mode === "partial" ? restored.preferredCodec : null,
      width: rasterSize.width,
    });
    if (
      !encoder &&
      generation === cache.generation &&
      isPreviewCacheEnabled(ctx) &&
      ctx.state.currentTemplate?.id === template.id
    ) {
      await fallBackToExactFrameCache(ctx, key);
      return "unavailable";
    }
    if (
      !encoder ||
      generation !== cache.generation ||
      !isPreviewCacheEnabled(ctx) ||
      ctx.state.currentTemplate?.id !== template.id
    ) {
      await encoder?.cancel();
      cache.preparing = false;
      return "unavailable";
    }
    cache.encoder = encoder;
    cache.codec = encoder.codec;
    cache.error = null;
    cache.mimeType = encoder.mimeType;
    cache.persistenceMissReason = null;
    cache.preparing = false;
    cache.recording = true;
    if (!encoder.segmented) {
      cache.segmentPlan = createPlaybackVideoCacheSegmentPlan(
        range,
        fps,
        false,
      ).map((segment) => ({
        ...segment,
        fingerprint: createPlaybackVideoCacheSegmentFingerprint(
          ctx,
          template,
          fps,
          duration,
          segment,
        ),
      }));
      cache.segmentBlobs = Array.from(
        { length: cache.segmentPlan.length },
        (): Blob | null => null,
      );
    }
    const pendingSegmentIndexes =
      encoder.segmented && restored.mode === "partial"
        ? restored.pendingSegmentIndexes
        : cache.segmentPlan.map((_segment, index) => index);
    beginPlaybackVideoSegmentWarm(ctx.state, cache, {
      currentTime: range.startTime,
      duration,
      fps,
      pendingSegmentIndexes,
      segments: cache.segmentPlan,
    });
    ctx.syncPlaybackButtons?.();
    ctx.state.previewFrameCacheStorage = "video-recording";
    ctx.state.previewFrameCacheTotalFrames =
      ctx.state.previewCacheWarmTargetFrames;
    return "recording";
  } catch {
    if (generation === cache.generation) {
      await fallBackToExactFrameCache(ctx, key);
    }
    return "unavailable";
  }
}

export function createPlaybackVideoCacheActions(
  getContext: () => ViewerAppContext,
): PlaybackVideoCacheActions {
  return {
    beginPlaybackVideoCache: bindViewerAction(
      beginPlaybackVideoCache,
      getContext,
    ),
    capturePlaybackVideoCacheFrame: bindViewerAction(
      capturePlaybackVideoCacheFrame,
      getContext,
    ),
    hidePlaybackVideoCacheSurface: bindViewerAction(
      hidePlaybackVideoCacheSurface,
      getContext,
    ),
    invalidatePlaybackVideoCache: bindViewerAction(
      invalidatePlaybackVideoCache,
      getContext,
    ),
    isPlaybackVideoCacheCurrent: bindViewerAction(
      isPlaybackVideoCacheCurrent,
      getContext,
    ),
    shouldPreferPlaybackVideoCache: bindViewerAction(
      shouldPreferPlaybackVideoCache,
      getContext,
    ),
    stopPlaybackVideoCache: bindViewerAction(
      stopPlaybackVideoCache,
      getContext,
    ),
    syncPlaybackVideoCache: bindViewerAction(
      syncPlaybackVideoCache,
      getContext,
    ),
  };
}

function isPreviewCacheEnabled(ctx: ViewerAppContext): boolean {
  return ctx.state.previewCacheEnabled;
}
