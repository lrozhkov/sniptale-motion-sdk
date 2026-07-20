import type { ViewerAppContext } from "../app/context.js";
import {
  advancePreviewCacheWarm,
  beginPreviewCacheWarm,
  cancelPreviewCacheWarm,
} from "./cache-warm.js";
import { recordPreviewCacheWarmSample } from "./cache-warm-estimate.js";

export function beginPlaybackCacheWarm(
  ctx: ViewerAppContext,
  force = false,
): boolean {
  const active = beginPreviewCacheWarm(
    ctx.state,
    {
      currentTime: Number(ctx.refs.timeSlider.value) || 0,
      duration: ctx.getEffectiveDuration(ctx.state.currentTemplate),
      fps: Number(ctx.refs.fpsInput.value) || 30,
      range: ctx.state.playbackRange,
    },
    force,
  );
  if (active) {
    ctx.stopPreviewAudio?.();
    ctx.lastPlaybackAudioTs = 0;
    ctx.syncPlaybackButtons?.();
  }
  return active;
}

export function advancePlaybackCacheWarmResult(
  ctx: ViewerAppContext,
  result: any,
  options: {
    currentTime: number;
    duration: number;
    frameLatencyMs?: number;
    fps: number;
    previousCacheFrames?: number;
  },
) {
  if (ctx.state.previewCacheEnabled === false) {
    if (ctx.state.previewCacheWarmActive) {
      cancelPreviewCacheWarm(ctx.state);
      ctx.syncPlaybackButtons?.();
      ctx.syncPreviewQualityBadge?.(1);
    }
    return null;
  }
  if (!ctx.state.playing) {
    return null;
  }
  if (ctx.state.previewCacheWarmCapacityLimited) {
    return null;
  }
  if (
    !ctx.state.previewCacheWarmActive &&
    result.previewCacheHit === false &&
    result.previewCacheComplete !== true
  ) {
    beginPlaybackCacheWarm(ctx, true);
  }
  if (
    ctx.state.previewCacheWarmActive &&
    ctx.state.previewCacheWarmVisitedFrames > 0 &&
    result.previewCacheHit === false &&
    Number(result.previewCacheFrames) <
      Math.max(0, Number(options.previousCacheFrames) || 0)
  ) {
    cancelAndRestartPreviewCacheWarm(ctx);
  }
  if (typeof result.previewCacheHit === "boolean") {
    recordPreviewCacheWarmSample(ctx.state, options.frameLatencyMs);
  }
  const step = advancePreviewCacheWarm(ctx.state, result, {
    ...options,
    range: ctx.state.playbackRange,
  });
  if (!step) {
    return null;
  }
  if (step.finished) {
    ctx.lastPlaybackTs = 0;
    ctx.lastPlaybackRenderTs = 0;
    ctx.lastPlaybackUiTs = 0;
    const playbackTime = Number(ctx.refs.timeSlider.value) || 0;
    ctx.syncPreviewAudio?.(playbackTime);
    ctx.lastPlaybackAudioTs = performance.now();
    ctx.syncPlaybackButtons?.();
  }
  return step;
}

export function invalidatePlaybackCacheRangeCoverage(
  ctx: ViewerAppContext,
): void {
  const videoCache = ctx.state.previewVideoCache;
  if (
    videoCache?.preparing ||
    videoCache?.recording ||
    videoCache?.finalizing ||
    videoCache?.ready
  ) {
    if (!ctx.isPlaybackVideoCacheCurrent?.()) {
      void ctx.invalidatePlaybackVideoCache?.();
    }
    return;
  }
  cancelPreviewCacheWarm(ctx.state);
  Object.assign(ctx.state, {
    previewCacheWarmPrepared: false,
    previewCacheWarmRangeEndFrame: 0,
    previewCacheWarmRangeStartFrame: 0,
    previewCacheWarmStartTime: 0,
    previewCacheWarmTargetFrames: 0,
    previewFrameCacheComplete: false,
    previewFrameCacheEntries: 0,
    previewFrameCacheFrames: 0,
    previewFrameCacheTotalFrames: 0,
  });
  ctx.syncPlaybackCacheButton?.();
  ctx.syncPreviewQualityBadge?.(ctx.state.appliedPreviewScale || 1);
}

function cancelAndRestartPreviewCacheWarm(ctx: ViewerAppContext): void {
  ctx.state.previewCacheWarmActive = false;
  beginPlaybackCacheWarm(ctx, true);
}
