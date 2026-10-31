import { bindViewerAction } from "../../app/bind-action.js";
import type { TimelineSelectionGestureActions } from "./pointer-contract.js";
import type { TimelinePlaybackRange } from "../viewport.js";
import type { ViewerAppContext } from "../../app/context.js";
import { invalidatePlaybackCacheRangeCoverage } from "../../playback/cache-warm-controller.js";
import { normalizeTimelinePlaybackRange } from "../viewport.js";

function beginRulerScrub(ctx: ViewerAppContext, event: PointerEvent) {
  if (event.button !== 0) {
    return;
  }
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  ctx.state.pointerDragCleanup?.();
  event.preventDefault();
  if (ctx.state.playing) {
    ctx.togglePlayback();
  }
  const startX = event.clientX;
  const startTime = ctx.timelineTimeFromEvent(event, target);
  let moved = false;
  const onMove = (moveEvent: MouseEvent) => {
    const nextTime = ctx.timelineTimeFromEvent(moveEvent, target);
    moved = moved || Math.abs(moveEvent.clientX - startX) > 3;
    if (!moved) {
      return;
    }
    ctx.state.dragMoved = true;
    ctx.state.playbackRangeDraft = {
      end: Math.max(startTime, nextTime),
      start: Math.min(startTime, nextTime),
    };
    ctx.updateTimelinePlaybackRangeOverlay();
  };
  const stop = (upEvent: MouseEvent) => {
    if (upEvent?.type === "pointercancel") {
      ctx.state.playbackRangeDraft = null;
      ctx.updateTimelinePlaybackRangeOverlay();
      return;
    }
    if (moved && ctx.state.playbackRangeDraft) {
      ctx.setPlaybackRange(ctx.state.playbackRangeDraft);
    } else {
      ctx.clearPlaybackRange();
      const nextTime = ctx.timelineTimeFromEvent(upEvent, target);
      ctx.showTimelineSnapIndicator(nextTime);
      ctx.seekToTime(nextTime);
    }
    ctx.state.playbackRangeDraft = null;
  };
  ctx.bindPointerDrag(event.pointerId, target, onMove, stop);
}

function getActivePlaybackRange(ctx: ViewerAppContext) {
  return ctx.state.playbackRangeDraft ?? ctx.state.playbackRange;
}

function setPlaybackRange(
  ctx: ViewerAppContext,
  range: Partial<TimelinePlaybackRange> | null | undefined,
) {
  const duration = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  const previousRange = ctx.state.playbackRange;
  const nextRange = normalizeTimelinePlaybackRange(range, duration);
  ctx.state.playbackRange = nextRange;
  if (!playbackRangesMatch(previousRange, nextRange)) {
    invalidatePlaybackCacheRangeCoverage(ctx);
  }
  ctx.updateTimelinePlaybackRangeOverlay();
}

function clearPlaybackRange(ctx: ViewerAppContext) {
  const rangeChanged = ctx.state.playbackRange !== null;
  ctx.state.playbackRange = null;
  ctx.state.playbackRangeDraft = null;
  if (rangeChanged) {
    invalidatePlaybackCacheRangeCoverage(ctx);
  }
  ctx.updateTimelinePlaybackRangeOverlay();
}

function playbackRangesMatch(
  left: TimelinePlaybackRange | null,
  right: TimelinePlaybackRange | null,
): boolean {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.start === right.start &&
      left.end === right.end)
  );
}

function updateTimelinePlaybackRangeOverlay(ctx: ViewerAppContext) {
  if (!ctx.state.currentTemplate) {
    return;
  }
  const duration = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  const range = ctx.getActivePlaybackRange();
  ctx.updateTimelineTrackOverlayHeights();
  for (const root of [ctx.refs.timelineRuler, ctx.refs.timelineTracks]) {
    root.querySelectorAll(".timeline-playback-range").forEach((item) => {
      if (!(item instanceof HTMLElement)) return;
      if (!range) {
        item.hidden = true;
        return;
      }
      const left = ctx.timelineContentPixel(range.start, duration, root);
      const right = ctx.timelineContentPixel(range.end, duration, root);
      item.hidden = false;
      item.style.left = `${left}px`;
      item.style.width = `${Math.max(1, right - left)}px`;
      if (root !== ctx.refs.timelineTracks) {
        item.style.height = "";
      }
    });
  }
}

export function createTimelinePlaybackRangeActions(
  getContext: () => ViewerAppContext,
): Pick<
  TimelineSelectionGestureActions,
  | "beginRulerScrub"
  | "getActivePlaybackRange"
  | "setPlaybackRange"
  | "clearPlaybackRange"
  | "updateTimelinePlaybackRangeOverlay"
> {
  return {
    beginRulerScrub: bindViewerAction(beginRulerScrub, getContext),
    clearPlaybackRange: bindViewerAction(clearPlaybackRange, getContext),
    getActivePlaybackRange: bindViewerAction(
      getActivePlaybackRange,
      getContext,
    ),
    setPlaybackRange: bindViewerAction(setPlaybackRange, getContext),
    updateTimelinePlaybackRangeOverlay: bindViewerAction(
      updateTimelinePlaybackRangeOverlay,
      getContext,
    ),
  };
}
