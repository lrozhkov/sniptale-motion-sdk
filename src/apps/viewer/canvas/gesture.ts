import type { ViewerAppContext } from "../app/context.js";

export function prepareCanvasGesture(ctx: ViewerAppContext): number {
  if (ctx.state.playing) {
    ctx.pausePlayback({
      preservePreparation: true,
      renderCurrentFrame: false,
    });
  }
  return ctx.snapTime(Number(ctx.refs.timeSlider.value) || 0);
}
