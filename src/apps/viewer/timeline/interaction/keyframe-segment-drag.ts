import type { ViewerAppContext } from "../../app/context.js";
import { createTimelineDragPreview } from "./drag-preview.js";

function beginKeyframeSegmentDrag(
  ctx: ViewerAppContext,
  event,
  trackId,
  fromKeyframeId,
  toKeyframeId,
  mode,
) {
  if (event.button !== 0) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
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
  const fromKeyframe = keyframes[fromIndex];
  const toKeyframe = keyframes[toIndex];
  if (!fromKeyframe || !toKeyframe) return;
  const previous = fromIndex > 0 ? keyframes[fromIndex - 1] : null;
  const next = toIndex < keyframes.length - 1 ? keyframes[toIndex + 1] : null;
  const body =
    event.currentTarget.closest(".timeline-lane-body") ??
    event.currentTarget.parentElement;
  const rect = body.getBoundingClientRect();
  const startX = event.clientX;
  const minGap = 1 / Math.max(1, Number(ctx.refs.fpsInput.value) || 30);
  const original = {
    fromTime: fromKeyframe.time,
    toTime: toKeyframe.time,
  };
  const limits = ctx.getSegmentDragLimits(
    original,
    previous,
    next,
    minGap,
    ctx.getEffectiveDuration(template),
    mode,
  );
  ctx.setSelectedKeyframes(
    [
      { keyframeId: toKeyframeId, trackId },
      { keyframeId: fromKeyframeId, trackId },
    ],
    { render: false },
  );
  ctx.setSidebarGroup("inspect");
  const preview = createTimelineDragPreview(ctx, template);
  const onMove = (moveEvent) => {
    const pointerDelta = moveEvent.clientX - startX;
    if (
      !preview.activate(Math.abs(pointerDelta), () =>
        ctx.beginEditorCommand({
          payload: { fromKeyframeId, mode, toKeyframeId, trackId },
          type: "moveKeyframeSegment",
        }),
      )
    ) {
      return;
    }
    const rawDelta = ctx.timelineDeltaFromPixels(pointerDelta, rect, template);
    const delta = ctx.deps.clamp(
      ctx.snapDuration(Math.abs(rawDelta)) * Math.sign(rawDelta || 0),
      limits.min,
      limits.max,
    );
    const from = track.keyframes.find(
      (keyframe) => keyframe.id === fromKeyframeId,
    );
    const to = track.keyframes.find((keyframe) => keyframe.id === toKeyframeId);
    if (!from || !to) {
      return;
    }
    let nextFromTime = from.time;
    let nextToTime = to.time;
    if (mode === "move") {
      nextFromTime = ctx.deps.clamp(
        ctx.snapTime(original.fromTime + delta),
        limits.fromMin,
        limits.fromMax,
      );
      nextToTime = ctx.deps.clamp(
        ctx.snapTime(original.toTime + delta),
        limits.toMin,
        limits.toMax,
      );
    } else if (mode === "start") {
      nextFromTime = ctx.deps.clamp(
        ctx.snapTime(original.fromTime + delta),
        limits.fromMin,
        limits.fromMax,
      );
    } else {
      nextToTime = ctx.deps.clamp(
        ctx.snapTime(original.toTime + delta),
        limits.toMin,
        limits.toMax,
      );
    }
    preview.scheduleUpdate(
      () => {
        from.time = nextFromTime;
        to.time = nextToTime;
        track.keyframes = [...track.keyframes].sort((a, b) => a.time - b.time);
        ctx.state.timelineOverrides.set(
          template.id,
          ctx.deps.normalizeTimeline(
            timeline,
            ctx.getEffectiveDuration(template),
          ),
        );
      },
      () =>
        ctx.showTimelineSnapIndicator(
          mode === "end" ? nextToTime : nextFromTime,
        ),
    );
  };
  ctx.bindPointerDrag(event.pointerId, event.currentTarget, onMove, () =>
    preview.finalize(),
  );
}

function getSegmentDragLimits(
  ctx: ViewerAppContext,
  original,
  previous,
  next,
  minGap,
  duration,
  mode,
) {
  const previousLimit = previous ? previous.time + minGap : 0;
  const nextLimit = next ? next.time - minGap : duration;
  if (mode === "move") {
    const min = previousLimit - original.fromTime;
    const max = nextLimit - original.toTime;
    return {
      fromMax: original.fromTime + max,
      fromMin: original.fromTime + min,
      max,
      min,
      toMax: original.toTime + max,
      toMin: original.toTime + min,
    };
  }
  if (mode === "start") {
    return {
      fromMax: original.toTime - minGap,
      fromMin: previousLimit,
      max: original.toTime - minGap - original.fromTime,
      min: previousLimit - original.fromTime,
      toMax: original.toTime,
      toMin: original.toTime,
    };
  }
  return {
    fromMax: original.fromTime,
    fromMin: original.fromTime,
    max: nextLimit - original.toTime,
    min: original.fromTime + minGap - original.toTime,
    toMax: nextLimit,
    toMin: original.fromTime + minGap,
  };
}

export function installInteractionKeyframeSegmentDragOwner(
  ctx: ViewerAppContext,
): void {
  ctx.beginKeyframeSegmentDrag = beginKeyframeSegmentDrag.bind(undefined, ctx);
  ctx.getSegmentDragLimits = getSegmentDragLimits.bind(undefined, ctx);
}
