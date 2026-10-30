import type { ViewerAppContext } from "../../app/context.js";

function nudgeSelectedKeyframesByFrames(
  ctx: ViewerAppContext,
  direction,
  frames,
) {
  const selectedRefs = ctx.getSelectedKeyframeRefs();
  if (selectedRefs.length === 0) {
    return;
  }
  const fps = Math.max(1, Number(ctx.refs.fpsInput.value) || 30);
  const delta =
    (Math.sign(direction || 0) * Math.max(1, Number(frames) || 1)) / fps;
  return ctx.moveSelectedKeyframesBySeconds(delta, {
    coalesceKey: `nudge-keyframes:${selectedRefs
      .map((item) => `${item.trackId}:${item.keyframeId}`)
      .sort()
      .join("|")}`,
    type: "nudgeKeyframes",
  });
}

export function installTimelineKeyframeNudgeOwner(ctx: ViewerAppContext): void {
  ctx.nudgeSelectedKeyframesByFrames = nudgeSelectedKeyframesByFrames.bind(
    undefined,
    ctx,
  );
}
