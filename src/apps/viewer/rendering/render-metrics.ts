const SCALED_PREVIEW_EXTRAPOLATION_SAFETY = 1.25;

export function estimateFullResolutionRenderMs(
  durationMs: number,
  renderScale = 1,
): number {
  const duration = Math.max(0, Number.isFinite(durationMs) ? durationMs : 0);
  const scale = Math.max(
    0.0625,
    Math.min(
      1,
      Number.isFinite(renderScale) && renderScale > 0 ? renderScale : 1,
    ),
  );
  const extrapolated = duration / (scale * scale);
  return scale < 0.999
    ? extrapolated * SCALED_PREVIEW_EXTRAPOLATION_SAFETY
    : duration;
}

export function updateFullResolutionRenderAverage(
  previousAverageMs: number,
  estimatedFullRenderMs: number,
  renderScale: number,
  renderCount: number,
): number {
  if (renderScale >= 0.999 || renderCount === 1) {
    return estimatedFullRenderMs;
  }
  return previousAverageMs * 0.85 + estimatedFullRenderMs * 0.15;
}
