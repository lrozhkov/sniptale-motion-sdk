export const INTERACTIVE_RENDER_TIMEOUT_MS = 5_000;
export const EDITOR_RENDER_TIMEOUT_MS = 10_000;
export const FULL_QUALITY_RENDER_TIMEOUT_MS = 15_000;
export const PREVIEW_CACHE_RENDER_TIMEOUT_MS = 60_000;
const FULL_HD_RENDER_PIXELS = 1920 * 1080;

export function resolveViewerRenderTimeoutMs(
  forceFull = false,
  interactionActive = true,
  previewCacheRequested = false,
  renderPixels = FULL_HD_RENDER_PIXELS,
): number {
  if (previewCacheRequested) {
    return PREVIEW_CACHE_RENDER_TIMEOUT_MS;
  }
  const baseTimeout = forceFull
    ? FULL_QUALITY_RENDER_TIMEOUT_MS
    : interactionActive
      ? INTERACTIVE_RENDER_TIMEOUT_MS
      : EDITOR_RENDER_TIMEOUT_MS;
  const requestedPixels = Number(renderPixels);
  const resolutionScale = Number.isFinite(requestedPixels)
    ? Math.max(1, requestedPixels / FULL_HD_RENDER_PIXELS)
    : 1;
  return Math.min(
    PREVIEW_CACHE_RENDER_TIMEOUT_MS,
    Math.ceil(baseTimeout * resolutionScale),
  );
}
