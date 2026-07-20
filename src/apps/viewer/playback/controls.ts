import type { ViewerAppContext } from "../app/context.js";
import { cancelPreviewCacheWarm } from "./cache-warm.js";
import { pausePlaybackCacheBuild } from "./cache-pause.js";
import { renderPausedFrame } from "./paused-frame.js";
import { beginPlaybackRun } from "./run.js";
import {
  beginPlaybackRunState,
  pausePlaybackRunState,
  stopPlaybackRunState,
} from "./run-state.js";
import {
  cancelPlaybackAnimationFrame,
  clearPlaybackRenderContinuation,
  resetPlaybackRunClock,
} from "./timers.js";

type PausePlaybackOptions = {
  preservePreparation?: boolean;
  renderCurrentFrame?: boolean;
};

export function toggleLoopPlayback(ctx: ViewerAppContext): void {
  ctx.state.loopPlayback = !ctx.state.loopPlayback;
  ctx.refs.loopButton.classList.toggle("active", ctx.state.loopPlayback);
  ctx.refs.loopButton.setAttribute(
    "aria-pressed",
    String(ctx.state.loopPlayback),
  );
}

export function togglePlayback(ctx: ViewerAppContext): void {
  if (ctx.state.playing) {
    pausePlayback(ctx);
    return;
  }
  startPlayback(ctx);
}

export function pausePlayback(
  ctx: ViewerAppContext,
  options: PausePlaybackOptions = {},
): boolean {
  const wasPlaying = ctx.state.playing;
  ctx.state.playing = false;
  const preserveCacheBuild = pausePlaybackCacheBuild(
    ctx,
    options.preservePreparation !== false,
  );
  pausePlaybackRunState(ctx, preserveCacheBuild);
  clearPlaybackRenderContinuation(ctx);
  cancelPlaybackAnimationFrame(ctx);
  resetPlaybackRunClock(ctx);
  ctx.stopPreviewAudio?.();
  ctx.lastPlaybackAudioTs = 0;
  ctx.syncPlaybackButtons();
  if (
    wasPlaying &&
    !preserveCacheBuild &&
    options.renderCurrentFrame !== false
  ) {
    void renderPausedFrame(ctx);
  }
  return preserveCacheBuild;
}

export function startPlayback(ctx: ViewerAppContext): void {
  if (
    ctx.state.playing ||
    ctx.state.canvasTransformDragActive ||
    ctx.state.timelineDragActive ||
    ctx.state.sandboxRecoveryPending ||
    ctx.refs.playButton?.disabled === true
  ) {
    return;
  }
  ctx.state.playing = true;
  const token = beginPlaybackRunState(ctx);
  resetPlaybackRunClock(ctx);
  resetDirectPresentationCadence(ctx);
  ctx.state.averagePlaybackTickMs = 0;
  ctx.lastPlaybackUiTs = 0;
  ctx.syncPlaybackButtons();
  void beginPlaybackRun(ctx, token);
}

export function stopPlaybackForRuntimeRecovery(ctx: ViewerAppContext): void {
  clearPlaybackRenderContinuation(ctx);
  cancelPlaybackAnimationFrame(ctx);
  ctx.state.playing = false;
  stopPlaybackRunState(ctx, "recovering");
  ctx.stopPlaybackVideoCache?.();
  cancelPreviewCacheWarm(ctx.state);
  ctx.lastPlaybackTs = 0;
  ctx.lastPlaybackRenderTs = 0;
  ctx.lastPlaybackUiTs = 0;
  ctx.stopPreviewAudio?.();
  ctx.lastPlaybackAudioTs = 0;
  ctx.syncPlaybackButtons();
}

function resetDirectPresentationCadence(ctx: ViewerAppContext): void {
  ctx.state.directPresentationIntervalsMs = [];
  ctx.state.lastDirectPresentationAtMs = null;
  ctx.state.lastDirectPresentationLocalAtMs = null;
  ctx.state.lastPlaybackBindingReadAtMs = 0;
  ctx.state.playbackBindingLayerId = null;
}
