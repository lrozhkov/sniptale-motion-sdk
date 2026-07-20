import type { ViewerAppContext } from "../app/context.js";
import { beginPlaybackCacheWarm } from "./cache-warm-controller.js";
import {
  beginPlaybackRunState,
  isPlaybackRunCurrent,
  setPlaybackRunPhase,
  type PlaybackRunToken,
} from "./run-state.js";

export async function beginPlaybackRun(
  ctx: ViewerAppContext,
  requestedToken?: PlaybackRunToken,
): Promise<void> {
  const token = requestedToken ?? beginPlaybackRunState(ctx);
  if (ctx.state.previewCacheEnabled === false) {
    if (!setPlaybackRunPhase(ctx, token, "live")) {
      return;
    }
    ctx.syncPreviewAudio?.(Number(ctx.refs.timeSlider.value) || 0);
    ctx.lastPlaybackAudioTs = performance.now();
    ctx.schedulePlaybackTick();
    return;
  }
  ctx.stopPreviewAudio?.();
  ctx.lastPlaybackAudioTs = 0;
  if (ctx.shouldPreferPlaybackVideoCache?.(ctx.state.currentTemplate)) {
    const mode = await ctx.beginPlaybackVideoCache?.();
    if (!isPlaybackRunCurrent(ctx, token)) {
      return;
    }
    if (mode === "playback" || mode === "recording") {
      if (mode === "playback") {
        ctx.syncPreviewAudio?.(Number(ctx.refs.timeSlider.value) || 0);
        ctx.lastPlaybackAudioTs = performance.now();
      }
      setPlaybackRunPhase(
        ctx,
        token,
        mode === "playback" ? "cached-video-playback" : "preparing-video-cache",
      );
      ctx.schedulePlaybackTick();
      return;
    }
  }
  if (!isPlaybackRunCurrent(ctx, token)) {
    return;
  }
  if (!beginPlaybackCacheWarm(ctx)) {
    setPlaybackRunPhase(
      ctx,
      token,
      ctx.state.previewFrameCacheComplete ? "cached-frame-playback" : "live",
    );
    ctx.syncPreviewAudio?.(Number(ctx.refs.timeSlider.value) || 0);
    ctx.lastPlaybackAudioTs = performance.now();
  } else {
    setPlaybackRunPhase(ctx, token, "preparing-frame-cache");
  }
  ctx.schedulePlaybackTick();
}
