import { bindViewerAction } from "../app/bind-action.js";
import type { PlaybackActions } from "./contract.js";
import type { ViewerAppContext } from "../app/context.js";
import { calculateTimelinePlaybackStep } from "../timeline/viewport.js";
import {
  advancePlaybackRenderAnchorMs,
  isPlaybackRenderDue,
  resolvePlaybackRenderAnchorMs,
  resolvePlaybackRenderDelayMs,
  resolvePlaybackRenderIntervalForContext,
  resolvePlaybackUiIntervalMs,
} from "./cadence.js";
import {
  advancePlaybackCacheWarmResult,
  beginPlaybackCacheWarm,
} from "./cache-warm-controller.js";
import {
  pausePlayback,
  startPlayback,
  stopPlaybackForRuntimeRecovery,
  toggleLoopPlayback,
  togglePlayback,
} from "./controls.js";
import { renderPausedFrame } from "./paused-frame.js";
import {
  isPlaybackPreparationPhase,
  stopPlaybackRunState,
  syncPlaybackRunState,
} from "./run-state.js";
import { clearPlaybackRenderContinuation } from "./timers.js";

const PLAYBACK_AUDIO_SYNC_INTERVAL_MS = 200;

export function schedulePlaybackTick(ctx: ViewerAppContext): void {
  if (ctx.playbackAnimationFrame !== null) {
    return;
  }
  ctx.playbackAnimationFrame = window.requestAnimationFrame((now) => {
    ctx.playbackAnimationFrame = null;
    ctx.playbackTick(now);
  });
}

function playbackTick(ctx: ViewerAppContext, now: number) {
  if (!ctx.state.playing || !ctx.state.currentTemplate) {
    clearPlaybackRenderContinuation(ctx);
    ctx.lastPlaybackTs = 0;
    ctx.lastPlaybackAudioTs = 0;
    ctx.lastPlaybackRenderTs = 0;
    ctx.lastPlaybackUiTs = 0;
    return;
  }
  const playbackPhase = syncPlaybackRunState(ctx);
  const preparingPreview = isPlaybackPreparationPhase(playbackPhase);
  if (!ctx.lastPlaybackTs) {
    ctx.lastPlaybackTs = now;
    ctx.lastPlaybackRenderTs = 0;
  }
  const tickIntervalMs = now - ctx.lastPlaybackTs;
  const delta = tickIntervalMs / 1000;
  ctx.lastPlaybackTs = now;
  if (tickIntervalMs > 0 && tickIntervalMs < 250) {
    ctx.state.averagePlaybackTickMs = ctx.state.averagePlaybackTickMs
      ? ctx.state.averagePlaybackTickMs * 0.85 + tickIntervalMs * 0.15
      : tickIntervalMs;
  }
  const duration = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  const current = ctx.state.previewCacheWarmActive
    ? Number(ctx.state.previewCacheWarmPublicTime) || 0
    : Number(ctx.refs.timeSlider.value) || 0;
  const playback = preparingPreview
    ? { finished: false, time: current }
    : calculateTimelinePlaybackStep({
        current,
        deltaSeconds: delta,
        duration,
        loop: ctx.state.loopPlayback,
        range: ctx.state.playbackRange,
      });
  const next = playback.time;
  if (playback.finished) {
    ctx.state.playing = false;
    stopPlaybackRunState(ctx);
    clearPlaybackRenderContinuation(ctx);
    ctx.syncPlaybackButtons();
    ctx.syncPlaybackVideoCache?.(next, true);
    ctx.stopPreviewAudio?.();
    ctx.lastPlaybackAudioTs = 0;
  }
  ctx.refs.timeSlider.value = String(next);
  if (ctx.refs.fullscreenTimeSlider && ctx.isPreviewFullscreenActive()) {
    ctx.refs.fullscreenTimeSlider.value = String(next);
  }
  ctx.updateTimelinePlayhead();
  const renderIntervalMs = resolvePlaybackRenderIntervalForContext(ctx);
  const uiIntervalMs = resolvePlaybackUiIntervalMs(
    renderIntervalMs,
    ctx.state.averagePlaybackTickMs,
    (ctx.state.currentTemplate.layers?.length ?? 0) +
      getTimelineTrackCount(ctx.state.currentTemplate.timeline),
  );
  if (
    playback.finished ||
    !ctx.lastPlaybackUiTs ||
    now - ctx.lastPlaybackUiTs >= uiIntervalMs
  ) {
    ctx.lastPlaybackUiTs = now;
    const formattedTime = ctx.formatSeconds(next);
    ctx.refs.timeOutput.textContent = formattedTime;
    if (ctx.refs.fullscreenTimeOutput && ctx.isPreviewFullscreenActive()) {
      ctx.refs.fullscreenTimeOutput.textContent = formattedTime;
    }
  }
  if (
    !playback.finished &&
    !preparingPreview &&
    (!ctx.lastPlaybackAudioTs ||
      now - ctx.lastPlaybackAudioTs >= PLAYBACK_AUDIO_SYNC_INTERVAL_MS)
  ) {
    ctx.lastPlaybackAudioTs = now;
    ctx.syncPreviewAudio?.(next);
  }
  if (playback.finished) {
    void renderPausedFrame(ctx);
  } else if (ctx.syncPlaybackVideoCache?.(next)) {
    // The cached video owns presentation; the timeline remains the clock authority.
  } else if (
    playbackPhase === "preparing-video-cache" &&
    !ctx.state.previewCacheWarmActive
  ) {
    // Persistent restore and encoder setup do not advance or render the timeline.
  } else if (
    !ctx.state.renderInFlight &&
    isPlaybackRenderDue(
      now,
      resolvePlaybackRenderAnchorMs(
        ctx.lastPlaybackRenderTs,
        ctx.state.lastDirectPresentationLocalAtMs,
        renderIntervalMs,
      ),
      renderIntervalMs,
    )
  ) {
    const renderAnchor = resolvePlaybackRenderAnchorMs(
      ctx.lastPlaybackRenderTs,
      ctx.state.lastDirectPresentationLocalAtMs,
      renderIntervalMs,
    );
    ctx.lastPlaybackRenderTs = advancePlaybackRenderAnchorMs(
      now,
      renderAnchor,
      renderIntervalMs,
    );
    void ctx.renderCurrentFrame();
  }
  schedulePlaybackTick(ctx);
}

function continuePlaybackRendering(ctx: ViewerAppContext) {
  if (
    !ctx.state.playing ||
    !ctx.state.currentTemplate ||
    ctx.state.renderInFlight ||
    ctx.state.renderQueued ||
    ctx.state.previewVideoCache?.playbackActive
  ) {
    return false;
  }
  const now = performance.now();
  const renderIntervalMs = resolvePlaybackRenderIntervalForContext(ctx);
  const renderAnchor = resolvePlaybackRenderAnchorMs(
    ctx.lastPlaybackRenderTs,
    ctx.state.lastDirectPresentationLocalAtMs,
    renderIntervalMs,
  );
  if (!isPlaybackRenderDue(now, renderAnchor, renderIntervalMs)) {
    return false;
  }
  ctx.lastPlaybackRenderTs = advancePlaybackRenderAnchorMs(
    now,
    renderAnchor,
    renderIntervalMs,
  );
  void ctx.renderCurrentFrame();
  return true;
}

function schedulePlaybackRenderContinuation(ctx: ViewerAppContext): boolean {
  clearPlaybackRenderContinuation(ctx);
  if (
    !ctx.state.playing ||
    !ctx.state.currentTemplate ||
    ctx.state.renderInFlight ||
    ctx.state.renderQueued ||
    ctx.state.previewVideoCache?.playbackActive
  ) {
    return false;
  }
  const now = performance.now();
  const renderIntervalMs = resolvePlaybackRenderIntervalForContext(ctx);
  const renderAnchor = resolvePlaybackRenderAnchorMs(
    ctx.lastPlaybackRenderTs,
    ctx.state.lastDirectPresentationLocalAtMs,
    renderIntervalMs,
  );
  const delayMs = resolvePlaybackRenderDelayMs(
    now,
    renderAnchor,
    renderIntervalMs,
  );
  if (delayMs === 0) {
    return continuePlaybackRendering(ctx);
  }
  ctx.playbackRenderTimer = window.setTimeout(() => {
    ctx.playbackRenderTimer = null;
    continuePlaybackRendering(ctx);
  }, delayMs);
  return true;
}

export function createPlaybackActions(
  getContext: () => ViewerAppContext,
): PlaybackActions {
  return {
    schedulePlaybackTick: bindViewerAction(schedulePlaybackTick, getContext),
    playbackTick: bindViewerAction(playbackTick, getContext),
    toggleLoopPlayback: bindViewerAction(toggleLoopPlayback, getContext),
    togglePlayback: bindViewerAction(togglePlayback, getContext),
    pausePlayback: bindViewerAction(pausePlayback, getContext),
    startPlayback: bindViewerAction(startPlayback, getContext),
    beginPlaybackCacheWarm: bindViewerAction(
      beginPlaybackCacheWarm,
      getContext,
    ),
    advancePlaybackCacheWarmResult: bindViewerAction(
      advancePlaybackCacheWarmResult,
      getContext,
    ),
    schedulePlaybackRenderContinuation: bindViewerAction(
      schedulePlaybackRenderContinuation,
      getContext,
    ),
    stopPlaybackForRuntimeRecovery: bindViewerAction(
      stopPlaybackForRuntimeRecovery,
      getContext,
    ),
  };
}

function getTimelineTrackCount(value: unknown): number {
  return value !== null &&
    typeof value === "object" &&
    "tracks" in value &&
    Array.isArray(value.tracks)
    ? value.tracks.length
    : 0;
}
