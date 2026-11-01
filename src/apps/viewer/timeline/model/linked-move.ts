import type { ViewerAppContext } from "../../app/context.js";
import type { PhaseMovePlan } from "./move-plan-model.js";
export function applyLinkedTimelineMove(
  ctx: ViewerAppContext,
  plan: PhaseMovePlan,
  delta: number,
  totalDuration: number,
): void {
  plan.phaseItems.forEach((item) => {
    item.phase.start = ctx.snapTime(
      ctx.deps.clamp(item.start + delta, 0, totalDuration - item.duration),
    );
  });
  plan.keyframeItems.forEach((item) => {
    item.keyframe.time = ctx.snapTime(
      ctx.deps.clamp(item.time + delta, 0, totalDuration),
    );
  });
  (plan.timeline.tracks ?? []).forEach((track) => {
    track.keyframes = [...(track.keyframes ?? [])].sort(
      (a, b) => a.time - b.time,
    );
  });
}
