const MAX_PREVIEW_CACHE_ESTIMATE_SAMPLES = 30;
const MIN_PREVIEW_CACHE_ESTIMATE_PROGRESS = 0.15;
const MIN_PREVIEW_CACHE_ESTIMATE_SAMPLES = 5;
const PREVIEW_CACHE_RECENT_SAMPLE_WEIGHT = 0.25;
const PREVIEW_CACHE_ESTIMATE_HEADROOM = 1.15;

export function resetPreviewCacheWarmEstimate(state: any): void {
  state.previewCacheWarmAverageFrameMs = 0;
  state.previewCacheWarmElapsedMs = 0;
  state.previewCacheWarmSampleCount = 0;
}

export function recordPreviewCacheWarmSample(
  state: any,
  frameLatencyMs: unknown,
): void {
  const sample = Number(frameLatencyMs);
  if (
    !state.previewCacheWarmActive ||
    !Number.isFinite(sample) ||
    sample <= 0
  ) {
    return;
  }
  const sampleCount = Math.max(
    0,
    Number(state.previewCacheWarmSampleCount) || 0,
  );
  const previousAverage = Math.max(
    0,
    Number(state.previewCacheWarmAverageFrameMs) || 0,
  );
  state.previewCacheWarmAverageFrameMs =
    sampleCount === 0
      ? sample
      : previousAverage * (1 - PREVIEW_CACHE_RECENT_SAMPLE_WEIGHT) +
        sample * PREVIEW_CACHE_RECENT_SAMPLE_WEIGHT;
  state.previewCacheWarmElapsedMs =
    Math.max(0, Number(state.previewCacheWarmElapsedMs) || 0) + sample;
  state.previewCacheWarmSampleCount = sampleCount + 1;
}

export function resolvePreviewCacheWarmRemainingMs(state: any): number | null {
  const sampleCount = Math.max(
    0,
    Number(state.previewCacheWarmSampleCount) || 0,
  );
  const totalFrames = Math.max(
    1,
    Number(state.previewCacheWarmTargetFrames) || 1,
  );
  const requiredSamples = Math.min(
    MAX_PREVIEW_CACHE_ESTIMATE_SAMPLES,
    Math.max(
      MIN_PREVIEW_CACHE_ESTIMATE_SAMPLES,
      Math.ceil(totalFrames * MIN_PREVIEW_CACHE_ESTIMATE_PROGRESS),
    ),
  );
  if (sampleCount < requiredSamples) {
    return null;
  }
  const remainingFrames = Math.max(
    0,
    totalFrames - (Number(state.previewCacheWarmVisitedFrames) || 0),
  );
  const cumulativeAverage =
    Math.max(0, Number(state.previewCacheWarmElapsedMs) || 0) / sampleCount;
  const recentAverage = Math.max(
    0,
    Number(state.previewCacheWarmAverageFrameMs) || 0,
  );
  const estimatedFrameMs = Math.max(cumulativeAverage, recentAverage);
  return Number.isFinite(estimatedFrameMs) && estimatedFrameMs > 0
    ? remainingFrames * estimatedFrameMs * PREVIEW_CACHE_ESTIMATE_HEADROOM
    : null;
}
