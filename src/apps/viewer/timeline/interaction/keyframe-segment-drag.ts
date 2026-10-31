import type { TimelineRangeEditMode } from "../model/move-plan-model.js";
import { getSegmentDragLimits } from "../model/keyframe-segment-limits.js";
import { bindViewerAction } from "../../app/bind-action.js";
import type { TimelinePointerActions } from "./pointer-contract.js";
import type { ViewerAppContext } from "../../app/context.js";
import { createTimelineDragPreview } from "./drag-preview.js";

function beginKeyframeSegmentDrag(
  ctx: ViewerAppContext,
  event: PointerEvent,
  trackId: string,
  fromKeyframeId: string,
  toKeyframeId: string,
  mode: TimelineRangeEditMode,
) {
  if (event.button !== 0) {
    return;
  }
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  ctx.state.pointerDragCleanup?.();
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
    target.closest<HTMLElement>(".timeline-lane-body") ?? target.parentElement;
  if (!body) return;
  const rect = body.getBoundingClientRect();
  const startX = event.clientX;
  const minGap = 1 / Math.max(1, Number(ctx.refs.fpsInput.value) || 30);
  const original = {
    fromTime: fromKeyframe.time,
    toTime: toKeyframe.time,
  };
  const limits = getSegmentDragLimits(
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
  const onMove = (moveEvent: MouseEvent) => {
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
  ctx.bindPointerDrag(event.pointerId, target, onMove, () =>
    preview.finalize(),
  );
}

export function createKeyframeSegmentDragActions(
  getContext: () => ViewerAppContext,
): Pick<TimelinePointerActions, "beginKeyframeSegmentDrag"> {
  return {
    beginKeyframeSegmentDrag: bindViewerAction(
      beginKeyframeSegmentDrag,
      getContext,
    ),
  };
}
