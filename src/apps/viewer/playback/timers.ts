import type { ViewerAppContext } from "../app/context.js";

export function clearPlaybackRenderContinuation(ctx: ViewerAppContext): void {
  if (ctx.playbackRenderTimer === null) {
    return;
  }
  window.clearTimeout(ctx.playbackRenderTimer);
  ctx.playbackRenderTimer = null;
}

export function cancelPlaybackAnimationFrame(ctx: ViewerAppContext): void {
  if (ctx.playbackAnimationFrame === null) {
    return;
  }
  window.cancelAnimationFrame(ctx.playbackAnimationFrame);
  ctx.playbackAnimationFrame = null;
}

export function resetPlaybackRunClock(ctx: ViewerAppContext): void {
  ctx.lastPlaybackTs = 0;
  ctx.lastPlaybackRenderTs = 0;
}
