import type { ViewerAppContext } from "../app/context.js";
import { isDirectLiveRenderPreferred } from "../rendering/direct-live-policy.js";

const PLAYBACK_MAX_RENDER_INTERVAL_MS = 50;
const PLAYBACK_RENDER_HEADROOM = 1.15;
const CACHE_WARM_RENDER_HEADROOM = 1.1;
const CACHE_WARM_MINIMUM_BREATHING_MS = 4;
const PLAYBACK_SCHEDULER_TOLERANCE_MS = 3;
const PLAYBACK_MAX_PHASE_LAG_RATIO = 0.25;
const PLAYBACK_MAX_MINIMUM_PRESENTATION_GAP_MS = 5;
const PLAYBACK_MINIMUM_PRESENTATION_GAP_RATIO = 0.15;

export function resolvePlaybackRenderIntervalMs(
  fps: number,
  previewLatencyMs = 0,
  cacheWarmActive = false,
): number {
  const frameInterval = 1000 / Math.max(1, Number(fps) || 30);
  const measured = Math.max(0, Number(previewLatencyMs) || 0);
  const latencyInterval = cacheWarmActive
    ? measured * CACHE_WARM_RENDER_HEADROOM + CACHE_WARM_MINIMUM_BREATHING_MS
    : Math.min(
        PLAYBACK_MAX_RENDER_INTERVAL_MS,
        measured * PLAYBACK_RENDER_HEADROOM,
      );
  return Math.max(frameInterval, latencyInterval);
}

export function resolvePlaybackUiIntervalMs(
  renderIntervalMs: number,
  averagePlaybackTickMs = 0,
  editorComplexity = 0,
): number {
  const measuredTick = Math.max(0, Number(averagePlaybackTickMs) || 0);
  const complexityFloor = Number(editorComplexity) >= 16 ? 1000 / 20 : 0;
  const responsiveFloor =
    measuredTick >= 28 ? 1000 / 15 : measuredTick >= 20 ? 1000 / 20 : 1000 / 30;
  return Math.min(
    100,
    Math.max(complexityFloor, responsiveFloor, Number(renderIntervalMs) || 0),
  );
}

export function resolvePlaybackSchedulingLatencyMs(
  ctx: ViewerAppContext,
): number {
  const template = ctx.state.currentTemplate;
  const directFrame =
    template?.kind === "sceneEffect" ||
    template?.kind === "transitionEffect" ||
    template?.kind === "composition";
  const directlyPresented = Boolean(
    directFrame &&
    ctx.state.previewCacheEnabled === false &&
    isDirectLiveRenderPreferred(ctx, template) &&
    ctx.state.directRenderEffectIds?.has?.(template.effectId) &&
    ctx.state.directRenderResponsePort?.presentationSurfaceAttached,
  );
  if (ctx.state.previewCacheWarmActive) {
    return Math.max(
      Number(ctx.state.lastPreviewLatencyMs) || 0,
      Number(ctx.state.averagePreviewLatencyMs) || 0,
    );
  }
  if (
    ctx.state.previewCacheEnabled !== false &&
    ctx.state.previewFrameCacheComplete
  ) {
    return 0;
  }
  return directlyPresented
    ? ctx.state.averageRenderMs
    : ctx.state.averagePreviewLatencyMs;
}

export function resolvePlaybackRenderIntervalForContext(
  ctx: ViewerAppContext,
): number {
  return resolvePlaybackRenderIntervalMs(
    Number(ctx.refs.fpsInput.value) || 30,
    resolvePlaybackSchedulingLatencyMs(ctx),
    ctx.state.previewCacheWarmActive,
  );
}

export function isPlaybackRenderDue(
  now: number,
  lastRenderAt: number,
  renderIntervalMs: number,
): boolean {
  return (
    !lastRenderAt ||
    now - lastRenderAt + PLAYBACK_SCHEDULER_TOLERANCE_MS >= renderIntervalMs
  );
}

export function resolvePlaybackRenderDelayMs(
  now: number,
  lastRenderAt: number,
  renderIntervalMs: number,
): number {
  if (!lastRenderAt) {
    return 0;
  }
  return Math.max(
    0,
    renderIntervalMs - (now - lastRenderAt) - PLAYBACK_SCHEDULER_TOLERANCE_MS,
  );
}

export function resolvePlaybackRenderAnchorMs(
  lastRequestAtMs: unknown,
  lastPresentationAtMs: unknown,
  renderIntervalMs: unknown,
): number {
  const requestTimestamp = Number(lastRequestAtMs);
  const presentationTimestamp = Number(lastPresentationAtMs);
  const interval = Math.max(0, Number(renderIntervalMs) || 0);
  const minimumPresentationGap = Math.min(
    interval * PLAYBACK_MINIMUM_PRESENTATION_GAP_RATIO,
    PLAYBACK_MAX_MINIMUM_PRESENTATION_GAP_MS,
  );
  const presentationAdjustedAnchor =
    Number.isFinite(presentationTimestamp) && presentationTimestamp > 0
      ? presentationTimestamp + minimumPresentationGap - interval
      : 0;
  return Math.max(
    Number.isFinite(requestTimestamp) && requestTimestamp > 0
      ? requestTimestamp
      : 0,
    presentationAdjustedAnchor,
  );
}

export function advancePlaybackRenderAnchorMs(
  now: number,
  previousAnchor: number,
  renderIntervalMs: number,
): number {
  if (!previousAnchor) {
    return now;
  }
  const nextDeadline = previousAnchor + renderIntervalMs;
  const maximumPhaseLag = Math.max(
    PLAYBACK_SCHEDULER_TOLERANCE_MS,
    renderIntervalMs * PLAYBACK_MAX_PHASE_LAG_RATIO,
  );
  return now - nextDeadline > maximumPhaseLag ? now : nextDeadline;
}
