import type { ViewerAppContext } from "../app/context.js";
import { invalidatePlaybackVideoCache } from "./video-cache-reset.js";
import { setCachedVideoTime } from "./video-cache-surface.js";

const VIDEO_SYNC_TOLERANCE_SECONDS = 0.12;

export function activateCachedVideoPlayback(
  ctx: ViewerAppContext,
  time: number,
): void {
  const cache = ctx.state.previewVideoCache;
  const video = ctx.refs.cachedPreviewVideo as HTMLVideoElement;
  cache.playbackActive = true;
  cache.lastPlaybackTime = resolveCachedVideoTime(cache, time);
  ctx.syncPreviewQualityBadge?.(1);
  setCachedVideoTime(video, cache.lastPlaybackTime);
  video.hidden = false;
  ctx.refs.fastPreviewCanvas.hidden = true;
  ctx.refs.directPreviewCanvas.hidden = true;
  void video.play().catch(() => undefined);
}

export function syncPlaybackVideoCache(
  ctx: ViewerAppContext,
  time: number,
  finished = false,
): boolean {
  const cache = ctx.state.previewVideoCache;
  const video = ctx.refs.cachedPreviewVideo as HTMLVideoElement;
  if (!cache.playbackActive) {
    return false;
  }
  if (finished) {
    video.pause();
    video.hidden = true;
    cache.playbackActive = false;
    return true;
  }
  const target = resolveCachedVideoTime(cache, time);
  if (
    !Number.isFinite(video.currentTime) ||
    Math.abs(video.currentTime - target) > VIDEO_SYNC_TOLERANCE_SECONDS ||
    target + 0.01 < cache.lastPlaybackTime
  ) {
    setCachedVideoTime(video, target);
  }
  cache.lastPlaybackTime = target;
  video.hidden = false;
  ctx.refs.fastPreviewCanvas.hidden = true;
  ctx.refs.directPreviewCanvas.hidden = true;
  if (video.paused) {
    void video.play().catch(() => undefined);
  }
  return true;
}

export function stopPlaybackVideoCache(
  ctx: ViewerAppContext,
  discardRecording = true,
): void {
  const cache = ctx.state.previewVideoCache;
  const video = ctx.refs.cachedPreviewVideo as HTMLVideoElement;
  video.pause();
  video.hidden = true;
  cache.playbackActive = false;
  cache.lastPlaybackTime = 0;
  if (
    discardRecording &&
    (cache.preparing || cache.recording || cache.finalizing)
  ) {
    void invalidatePlaybackVideoCache(ctx);
  }
}

export function hidePlaybackVideoCacheSurface(ctx: ViewerAppContext): void {
  if (!ctx.state.previewVideoCache.playbackActive) {
    ctx.refs.cachedPreviewVideo.hidden = true;
  }
}

function resolveCachedVideoTime(cache, time: number): number {
  const rangeStart = Math.max(0, Number(cache.rangeStartTime) || 0);
  const rangeEnd = Math.max(
    rangeStart,
    Number(cache.rangeEndTime) || Number(cache.duration) || rangeStart,
  );
  const timelineTime = Math.max(
    rangeStart,
    Math.min(rangeEnd, Number(time) || rangeStart),
  );
  return timelineTime - rangeStart;
}
