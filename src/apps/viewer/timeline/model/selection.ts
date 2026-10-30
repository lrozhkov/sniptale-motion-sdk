import type { ViewerAppContext } from "../../app/context.js";

function navigateSelectedKeyframe(
  ctx: ViewerAppContext,
  direction,
  options: { extend?: boolean } = {},
) {
  const selected = ctx.getPrimaryKeyframeSelection();
  const timeline = ctx.getEffectiveTimeline(ctx.state.currentTemplate);
  const track = timeline.tracks.find((item) => item.id === selected?.trackId);
  if (!track || !selected?.keyframeId) {
    return;
  }
  const keyframes = [...(track.keyframes ?? [])].sort(
    (a, b) => a.time - b.time,
  );
  const currentIndex = keyframes.findIndex(
    (keyframe) => keyframe.id === selected.keyframeId,
  );
  const next = keyframes[currentIndex + direction];
  if (!next) {
    return;
  }
  if (options.extend) {
    ctx.setSelectedKeyframes(
      [
        ...ctx.getSelectedKeyframeRefs(),
        { keyframeId: next.id, trackId: track.id },
      ],
      { render: false },
    );
    ctx.syncTimelineSelection(ctx.state.currentTemplate);
  } else {
    ctx.selectKeyframe(track.id, next.id);
  }
  ctx.seekToTime(next.time);
  ctx.scrollSelectedTimelineItemIntoView();
}

export function installModelSelectionOwner(ctx: ViewerAppContext): void {
  ctx.navigateSelectedKeyframe = navigateSelectedKeyframe.bind(undefined, ctx);
}
