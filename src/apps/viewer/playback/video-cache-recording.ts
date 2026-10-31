import type { PreviewCacheWarmStep } from "./cache-warm.js";
import type { PlaybackVideoCacheState } from "./video-cache-state.js";
import type { ViewerAppContext } from "../app/context.js";
import type { PlaybackVideoCacheEncoder } from "./video-cache-encoder.js";
import { fallBackToExactFrameCache } from "./video-cache-fallback.js";
import { attachPlaybackVideoCacheSource } from "./video-cache-media-source.js";
import { persistPlaybackVideoCache } from "./video-cache-persistence.js";
import { activateCachedVideoPlayback } from "./video-cache-playback.js";
import type {
  PlaybackVideoCacheSegment,
  PlaybackVideoCacheSegmentBlob,
} from "./video-cache-segments.js";
import { advancePlaybackVideoSegmentWarm } from "./video-cache-warm.js";

export async function capturePlaybackVideoCacheFrame(
  ctx: ViewerAppContext,
  options: { fps: number; result: any; time: number },
) {
  const cache = ctx.state.previewVideoCache;
  const encoder = cache.encoder;
  if (!cache.recording || !encoder) {
    return null;
  }
  const generation = cache.generation;
  const fps = Math.max(1, Number(options.fps) || cache.fps || 30);
  const frameIndex = Math.max(0, Math.round(options.time * fps));
  const segment = resolveActiveSegment(cache, frameIndex, fps);
  const relativeFrameIndex = Math.max(0, frameIndex - segment.startFrame);
  const bitmap = options.result?.bitmap as CanvasImageSource | undefined;
  if (!bitmap) {
    return { deferred: true };
  }
  try {
    await encoder.addFrame(
      bitmap,
      relativeFrameIndex / fps,
      1 / fps,
      relativeFrameIndex === 0,
    );
  } catch {
    await fallBackToExactFrameCache(ctx, cache.key);
    return { failed: true };
  }
  if (generation !== cache.generation) {
    return { cancelled: true, captured: true };
  }
  const step = advancePlaybackVideoSegmentWarm(ctx.state, cache, {
    currentFrame: frameIndex,
    fps,
    segments: cache.segmentPlan,
  });
  ctx.state.previewFrameCacheFrames = ctx.state.previewCacheWarmVisitedFrames;
  ctx.state.previewFrameCacheEntries = Math.max(
    1,
    Number(cache.segmentIndex) + 1,
  );
  if (!step) {
    return { cancelled: true, captured: true };
  }
  if (frameIndex + 1 < segment.endFrame) {
    return { ...step, captured: true };
  }
  cache.finalizing = true;
  if (step.finished) {
    ctx.state.previewCacheWarmActive = true;
  }
  try {
    const blob = await encoder.finalize();
    if (generation !== cache.generation) {
      return { cancelled: true, captured: true };
    }
    cache.encoder = null;
    cache.segmentBlobs[segment.index] = blob;
    cache.finalizing = false;
    if (!step.finished) {
      const nextEncoder = await createNextSegmentEncoder(cache);
      if (!nextEncoder || generation !== cache.generation) {
        await nextEncoder?.cancel();
        await fallBackToExactFrameCache(ctx, cache.key);
        return { failed: true };
      }
      const nextIndex = cache.pendingSegmentIndexes[cache.pendingSegmentCursor];
      if (nextIndex === undefined) {
        await nextEncoder.cancel();
        await fallBackToExactFrameCache(ctx, cache.key);
        return { failed: true };
      }
      cache.encoder = nextEncoder;
      cache.segmentIndex = nextIndex;
      return { ...step, captured: true };
    }
    return await finalizeSegmentedPlaybackCache(ctx, step, generation);
  } catch {
    await fallBackToExactFrameCache(ctx, cache.key);
    return { failed: true };
  }
}

async function createNextSegmentEncoder(
  cache: PlaybackVideoCacheState,
): Promise<PlaybackVideoCacheEncoder | null> {
  const { createPlaybackVideoCacheEncoder } =
    await import("./video-cache-encoder.js");
  const encoder = await createPlaybackVideoCacheEncoder({
    fps: cache.fps,
    height: cache.height,
    preferredCodec: cache.codec,
    width: cache.width,
  });
  if (encoder?.codec !== cache.codec) {
    await encoder?.cancel();
    return null;
  }
  return encoder;
}

async function finalizeSegmentedPlaybackCache(
  ctx: ViewerAppContext,
  step: PreviewCacheWarmStep,
  generation: number,
) {
  const cache = ctx.state.previewVideoCache;
  cache.recording = false;
  cache.finalizing = true;
  const segments: PlaybackVideoCacheSegmentBlob[] = [];
  for (const segment of cache.segmentPlan) {
    const blob = cache.segmentBlobs[segment.index];
    if (!(blob instanceof Blob)) {
      await fallBackToExactFrameCache(ctx, cache.key);
      return { failed: true };
    }
    segments.push({ ...segment, blob });
  }
  const first = segments[0];
  if (!first || !cache.codec) {
    await fallBackToExactFrameCache(ctx, cache.key);
    return { failed: true };
  }
  const source = await attachPlaybackVideoCacheSource(
    ctx,
    segments.map((segment) => segment.blob),
    cache.codec,
  );
  if (generation !== cache.generation) {
    ctx.refs.cachedPreviewVideo.removeAttribute("src");
    ctx.refs.cachedPreviewVideo.load();
    URL.revokeObjectURL(source.url);
    return { cancelled: true, captured: true };
  }
  const bytes = segments.reduce(
    (total, segment) => total + segment.blob.size,
    0,
  );
  Object.assign(cache, {
    bytes,
    encoder: null,
    finalizing: false,
    mediaSource: source.mediaSource,
    mimeType: first.blob.type || null,
    ready: true,
    url: source.url,
  } satisfies Partial<PlaybackVideoCacheState>);
  ctx.state.previewCacheWarmActive = false;
  ctx.state.previewCacheWarmPrepared = true;
  ctx.state.previewFrameCacheBytes = bytes;
  ctx.state.previewFrameCacheComplete = true;
  const totalFrames = Math.max(
    1,
    Number(cache.rangeEndFrame) - Number(cache.rangeStartFrame),
  );
  ctx.state.previewFrameCacheFrames = totalFrames;
  ctx.state.previewFrameCacheEntries = segments.length;
  ctx.state.previewFrameCacheStorage = "video";
  ctx.state.previewFrameCacheTotalFrames = totalFrames;
  ctx.syncPlaybackButtons?.();
  persistPlaybackVideoCache(ctx, segments);
  if (ctx.state.playing) {
    activateCachedVideoPlayback(ctx, cache.originalTime);
    ctx.syncPreviewAudio?.(cache.originalTime);
    ctx.lastPlaybackAudioTs = performance.now();
  } else {
    ctx.syncPreviewQualityBadge?.(1);
  }
  return { ...step, captured: true, time: cache.originalTime };
}

function resolveActiveSegment(
  cache: PlaybackVideoCacheState,
  frameIndex: number,
  fps: number,
): PlaybackVideoCacheSegment {
  return (
    cache.segmentPlan[cache.segmentIndex] ?? {
      endFrame: Math.max(frameIndex + 1, Number(cache.rangeEndFrame) || 1),
      endTime: Number(cache.rangeEndTime) || (frameIndex + 1) / fps,
      index: 0,
      startFrame: Math.max(0, Number(cache.rangeStartFrame) || 0),
      startTime: Math.max(0, Number(cache.rangeStartTime) || 0),
    }
  );
}
