import type { ViewerAppContext } from "../../app/context.js";
export function findAdjacentKeyframes(
  ctx: ViewerAppContext,
  trackId: string,
  fromKeyframeId: string,
  toKeyframeId: string,
) {
  const template = ctx.state.currentTemplate;
  const timeline = ctx.getEffectiveTimeline(template);
  const track = timeline.tracks.find((item) => item.id === trackId);
  const keyframes = [...(track?.keyframes ?? [])].sort(
    (a, b) => a.time - b.time,
  );
  const fromIndex = keyframes.findIndex(
    (keyframe) => keyframe.id === fromKeyframeId,
  );
  const toIndex = keyframes.findIndex(
    (keyframe) => keyframe.id === toKeyframeId,
  );
  if (!template || !track || fromIndex < 0 || toIndex !== fromIndex + 1) {
    return;
  }
  return { template, timeline, track, keyframes, fromIndex, toIndex };
}
