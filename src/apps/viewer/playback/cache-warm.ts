import type { PreviewFrameCacheResult } from "./contract.js";
import type { CacheWarmHostState } from "./cache-warm-state.js";
import { resetPreviewCacheWarmEstimate } from "./cache-warm-estimate.js";
import {
  resolvePreviewCacheFrameRange,
  type PreviewCachePlaybackRange,
} from "./cache-range.js";

type CacheWarmOptions = {
  currentTime: number;
  duration: number;
  fps: number;
  range?: PreviewCachePlaybackRange;
};

export type { PreviewCacheWarmStep } from "./cache-warm-state.js";
import type { PreviewCacheWarmStep } from "./cache-warm-state.js";

export function beginPreviewCacheWarm(
  state: Partial<
    Pick<
      CacheWarmHostState,
      | "previewCacheWarmActive"
      | "previewCacheWarmAverageFrameMs"
      | "previewCacheWarmCapacityLimited"
      | "previewCacheWarmElapsedMs"
      | "previewCacheWarmPrepared"
      | "previewCacheWarmPublicTime"
      | "previewCacheWarmRangeEndFrame"
      | "previewCacheWarmRangeStartFrame"
      | "previewCacheWarmRenderTime"
      | "previewCacheWarmSampleCount"
      | "previewCacheWarmScale"
      | "previewCacheWarmStartTime"
      | "previewCacheWarmTargetFrames"
      | "previewCacheWarmUnsupportedResults"
      | "previewCacheWarmVisitedFrames"
      | "previewFrameCacheComplete"
    >
  >,
  options: CacheWarmOptions,
  force = false,
): boolean {
  if (state.previewCacheWarmActive) {
    return true;
  }
  if (
    !force &&
    (state.previewCacheWarmPrepared || state.previewFrameCacheComplete)
  ) {
    return false;
  }
  const bounds = resolveCacheWarmBounds(options);
  resetPreviewCacheWarmEstimate(state);
  state.previewCacheWarmActive = true;
  state.previewCacheWarmCapacityLimited = false;
  state.previewCacheWarmPrepared = false;
  state.previewCacheWarmPublicTime = clampTime(
    options.currentTime,
    options.duration,
  );
  state.previewCacheWarmRangeEndFrame = bounds.endFrame;
  state.previewCacheWarmRangeStartFrame = bounds.startFrame;
  state.previewCacheWarmRenderTime = bounds.currentFrame / bounds.fps;
  state.previewCacheWarmScale = 0;
  state.previewCacheWarmStartTime = bounds.currentFrame / bounds.fps;
  state.previewCacheWarmTargetFrames = Math.max(
    1,
    bounds.endFrame - bounds.startFrame,
  );
  state.previewCacheWarmUnsupportedResults = 0;
  state.previewCacheWarmVisitedFrames = 0;
  return true;
}

export function advancePreviewCacheWarm(
  state: Pick<
    CacheWarmHostState,
    | "previewCacheWarmActive"
    | "previewCacheWarmCapacityLimited"
    | "previewCacheWarmPrepared"
    | "previewCacheWarmRangeEndFrame"
    | "previewCacheWarmRangeStartFrame"
    | "previewCacheWarmRenderTime"
    | "previewCacheWarmStartTime"
    | "previewCacheWarmTargetFrames"
    | "previewCacheWarmUnsupportedResults"
    | "previewCacheWarmVisitedFrames"
  >,
  result: PreviewFrameCacheResult,
  options: CacheWarmOptions,
): PreviewCacheWarmStep | null {
  if (!state.previewCacheWarmActive) {
    return null;
  }
  if (typeof result.previewCacheHit !== "boolean") {
    state.previewCacheWarmUnsupportedResults =
      Math.max(0, Number(state.previewCacheWarmUnsupportedResults) || 0) + 1;
    if (state.previewCacheWarmUnsupportedResults < 3) {
      return {
        finished: false,
        prepared: false,
        time: Math.max(0, Number(state.previewCacheWarmRenderTime) || 0),
      };
    }
    state.previewCacheWarmActive = false;
    state.previewCacheWarmPrepared = false;
    state.previewCacheWarmRenderTime = state.previewCacheWarmStartTime;
    return {
      finished: true,
      prepared: false,
      time: clampTime(options.currentTime, options.duration),
    };
  }
  state.previewCacheWarmUnsupportedResults = 0;
  const fps = normalizeFps(options.fps);
  const startFrame = Math.max(
    0,
    Number(state.previewCacheWarmRangeStartFrame) || 0,
  );
  const endFrame = Math.max(
    startFrame + 1,
    Number(state.previewCacheWarmRangeEndFrame) || startFrame + 1,
  );
  const targetFrames = Math.max(
    1,
    Number(state.previewCacheWarmTargetFrames) || endFrame - startFrame,
  );
  const visitedFrames = Math.min(
    targetFrames,
    Math.max(0, Number(state.previewCacheWarmVisitedFrames) || 0) + 1,
  );
  state.previewCacheWarmVisitedFrames = visitedFrames;
  if (result.previewCacheComplete === true) {
    state.previewCacheWarmActive = false;
    state.previewCacheWarmCapacityLimited = false;
    state.previewCacheWarmPrepared = true;
    state.previewCacheWarmRenderTime = state.previewCacheWarmStartTime;
    return {
      finished: true,
      prepared: true,
      time: clampTime(state.previewCacheWarmStartTime, options.duration),
    };
  }
  if (visitedFrames >= targetFrames) {
    state.previewCacheWarmActive = false;
    state.previewCacheWarmCapacityLimited = true;
    state.previewCacheWarmPrepared = false;
    state.previewCacheWarmRenderTime = state.previewCacheWarmStartTime;
    return {
      finished: true,
      prepared: false,
      time: clampTime(state.previewCacheWarmStartTime, options.duration),
    };
  }
  const currentFrame = Math.max(
    startFrame,
    Math.min(endFrame - 1, Math.round(Number(options.currentTime) * fps)),
  );
  const nextFrame =
    currentFrame + 1 >= endFrame ? startFrame : currentFrame + 1;
  state.previewCacheWarmRenderTime = nextFrame / fps;
  return {
    finished: false,
    prepared: false,
    time: nextFrame / fps,
  };
}

export function cancelPreviewCacheWarm(
  state: Partial<
    Pick<
      CacheWarmHostState,
      | "previewCacheWarmActive"
      | "previewCacheWarmAverageFrameMs"
      | "previewCacheWarmCapacityLimited"
      | "previewCacheWarmElapsedMs"
      | "previewCacheWarmPublicTime"
      | "previewCacheWarmRenderTime"
      | "previewCacheWarmSampleCount"
      | "previewCacheWarmScale"
      | "previewCacheWarmUnsupportedResults"
      | "previewCacheWarmVisitedFrames"
    >
  >,
): void {
  resetPreviewCacheWarmEstimate(state);
  state.previewCacheWarmActive = false;
  state.previewCacheWarmCapacityLimited = false;
  state.previewCacheWarmRenderTime = 0;
  state.previewCacheWarmPublicTime = 0;
  state.previewCacheWarmScale = 0;
  state.previewCacheWarmUnsupportedResults = 0;
  state.previewCacheWarmVisitedFrames = 0;
}

export function resolvePreviewCacheRenderTime(
  state: Pick<
    CacheWarmHostState,
    "playing" | "previewCacheWarmActive" | "previewCacheWarmRenderTime"
  >,
  fallbackTime: number,
): number {
  const renderTime = Number(state.previewCacheWarmRenderTime);
  return state.playing &&
    state.previewCacheWarmActive &&
    Number.isFinite(renderTime) &&
    renderTime >= 0
    ? renderTime
    : fallbackTime;
}

export function resolvePreviewCacheWarmProgress(
  state: Pick<
    CacheWarmHostState,
    | "previewCacheWarmActive"
    | "previewCacheWarmPrepared"
    | "previewCacheWarmTargetFrames"
    | "previewCacheWarmVisitedFrames"
    | "previewFrameCacheComplete"
  >,
): number {
  if (!state.previewCacheWarmActive) {
    return state.previewCacheWarmPrepared || state.previewFrameCacheComplete
      ? 1
      : 0;
  }
  return Math.max(
    0,
    Math.min(
      1,
      (Number(state.previewCacheWarmVisitedFrames) || 0) /
        Math.max(1, Number(state.previewCacheWarmTargetFrames) || 1),
    ),
  );
}

function resolveCacheWarmBounds(options: CacheWarmOptions) {
  const duration = Math.max(0.001, Number(options.duration) || 1);
  const { endFrame, fps, startFrame } = resolvePreviewCacheFrameRange(options);
  const requestedCurrentFrame = Math.round(
    clampTime(options.currentTime, duration) * fps,
  );
  const currentFrame = Math.max(
    startFrame,
    Math.min(endFrame - 1, requestedCurrentFrame),
  );
  return { currentFrame, endFrame, fps, startFrame };
}

function normalizeFps(value: number): number {
  return Math.max(1, Number(value) || 30);
}

function clampTime(value: unknown, duration: number): number {
  return Math.max(0, Math.min(Math.max(0.001, duration), Number(value) || 0));
}
