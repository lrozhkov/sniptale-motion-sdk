import type { ViewerAppContext } from "../app/context.js";
export function syncSnapshotTime(ctx: ViewerAppContext, time: unknown): void {
  const duration = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  const nextTime = ctx.deps.clamp(Number(time) || 0, 0, duration);
  ctx.refs.timeSlider.value = String(nextTime);
  ctx.refs.timeOutput.textContent = ctx.formatSeconds(nextTime);
  if (ctx.refs.fullscreenTimeSlider) {
    ctx.refs.fullscreenTimeSlider.value = String(nextTime);
  }
  if (ctx.refs.fullscreenTimeOutput) {
    ctx.refs.fullscreenTimeOutput.textContent = ctx.formatSeconds(nextTime);
  }
}
