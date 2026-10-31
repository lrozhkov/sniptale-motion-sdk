import type { TimelineContentMetrics } from "../view/model.js";
import type { TimelineViewport } from "../viewport.js";
import { bindViewerAction } from "../../app/bind-action.js";
import type { ViewerAppContext } from "../../app/context.js";

function seekFromTimelineEvent(ctx: ViewerAppContext, event: MouseEvent): void {
  if (!ctx.state.currentTemplate || ctx.shouldSuppressDragClick(event)) {
    return;
  }
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  const nextTime = ctx.timelineTimeFromEvent(event, target);
  ctx.showTimelineSnapIndicator(nextTime);
  ctx.seekToTime(nextTime);
}
function timelineTimeFromEvent(
  ctx: ViewerAppContext,
  event: Pick<MouseEvent, "clientX">,
  element: HTMLElement,
): number {
  const rawTime = ctx.timelineRawTimeFromEvent(event, element);
  return ctx.snapTime(rawTime);
}
function timelineRawTimeFromEvent(
  ctx: ViewerAppContext,
  event: Pick<MouseEvent, "clientX">,
  element: HTMLElement,
): number {
  const duration = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  const rect = ctx.getTimelineContentRect(element);
  const visibleX = ctx.deps.clamp(
    event.clientX - rect.left,
    0,
    rect.visibleWidth ?? rect.width,
  );
  if (element === ctx.refs.timelineRuler) {
    const viewport = ctx.getTimelineViewport(duration);
    return (
      viewport.start + (visibleX / Math.max(1, rect.width)) * viewport.span
    );
  }
  if (element !== ctx.refs.timelineTracks) {
    return (visibleX / Math.max(1, rect.width)) * duration;
  }
  const x = ctx.deps.clamp(
    visibleX + ctx.refs.timelineTracks.scrollLeft,
    0,
    rect.width,
  );
  return (x / Math.max(1, rect.width)) * duration;
}
function seekToTime(ctx: ViewerAppContext, time: number): void {
  if (!ctx.state.currentTemplate) {
    return;
  }
  const duration = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  const nextTime = ctx.snapTime(ctx.deps.clamp(time, 0, duration));
  ctx.refs.timeSlider.value = String(nextTime);
  ctx.refs.timeOutput.textContent = ctx.formatSeconds(nextTime);
  if (ctx.refs.fullscreenTimeSlider) {
    ctx.refs.fullscreenTimeSlider.value = String(nextTime);
  }
  if (ctx.refs.fullscreenTimeOutput) {
    ctx.refs.fullscreenTimeOutput.textContent = ctx.formatSeconds(nextTime);
  }
  ctx.updateTimelinePlayhead();
  void ctx.renderCurrentFrame();
}
function timelineContentPixel(
  ctx: ViewerAppContext,
  time: number,
  duration: number,
  element: HTMLElement,
  contentRect: TimelineContentMetrics | null = null,
): number {
  if (element === ctx.refs.timelineRuler) {
    const rect = contentRect ?? ctx.getTimelineContentMetrics(element);
    return (
      rect.offsetLeft +
      rect.width *
        (ctx.deps.timelinePercentForViewport(
          time,
          ctx.getTimelineViewport(duration),
        ) /
          100)
    );
  }
  const rect = contentRect ?? ctx.getTimelineContentMetrics(element);
  return (
    rect.offsetLeft + rect.width * (ctx.timelinePercent(time, duration) / 100)
  );
}
function getVisibleTimelineTicks(
  ctx: ViewerAppContext,
  duration: number,
): number[] {
  const viewport = ctx.getTimelineViewport(duration);
  const step = ctx.deps.getTimelineTickStep(viewport.span);
  const ticks: number[] = [];
  for (
    let time = Math.ceil(viewport.start / step) * step;
    time <= viewport.end + 0.001;
    time += step
  ) {
    ticks.push(Number(time.toFixed(4)));
  }
  return ticks;
}
function timelinePercent(
  ctx: ViewerAppContext,
  time: number,
  duration: number,
): number {
  return (
    (ctx.deps.clamp(Number(time) || 0, 0, Math.max(0.001, duration)) /
      Math.max(0.001, Number(duration) || 1)) *
    100
  );
}
function getTimelineViewport(
  ctx: ViewerAppContext,
  duration: number = ctx.getEffectiveDuration(),
): TimelineViewport {
  const viewport = ctx.deps.calculateTimelineViewport(
    duration,
    ctx.state.timelineZoom,
    ctx.state.timelineOffset,
  );
  ctx.state.timelineOffset = viewport.start;
  ctx.state.timelineZoom = viewport.zoom;
  return viewport;
}
function updateTimelineViewportLabel(
  ctx: ViewerAppContext,
  duration: number = ctx.getEffectiveDuration(),
): void {
  const viewport = ctx.getTimelineViewport(duration);
  ctx.refs.timelineZoomInput.value = String(viewport.zoom);
  ctx.refs.timelineViewportLabel.textContent = ctx.formatSecondsRange(
    viewport.start,
    viewport.end,
    2,
  );
}
function snapTime(ctx: ViewerAppContext, time: number): number {
  return ctx.deps.snapTimelineTime(time, {
    duration: ctx.getEffectiveDuration(),
    fps: Number(ctx.refs.fpsInput.value) || 30,
    snapMode: ctx.state.snapMode,
  });
}
function setTimelineZoom(
  ctx: ViewerAppContext,
  nextZoom: number,
  anchorTime: number | null = null,
): void {
  if (!ctx.state.currentTemplate) {
    return;
  }
  const nextState = ctx.deps.calculateTimelineZoomState({
    anchorTime,
    currentOffset: ctx.state.timelineOffset,
    currentZoom: ctx.state.timelineZoom,
    duration: ctx.getEffectiveDuration(ctx.state.currentTemplate),
    nextZoom,
  });
  ctx.state.timelineZoom = nextState.zoom;
  ctx.state.timelineOffset = nextState.offset;
  ctx.renderTimelineViewport(ctx.state.currentTemplate);
}
function panTimeline(ctx: ViewerAppContext, deltaSeconds: number): void {
  if (!ctx.state.currentTemplate) {
    return;
  }
  ctx.state.timelineOffset = ctx.deps.calculatePannedTimelineOffset({
    currentOffset: ctx.state.timelineOffset,
    currentZoom: ctx.state.timelineZoom,
    deltaSeconds,
    duration: ctx.getEffectiveDuration(ctx.state.currentTemplate),
  });
  ctx.renderTimelineViewport(ctx.state.currentTemplate);
}
function handleTimelineWheel(ctx: ViewerAppContext, event: WheelEvent): void {
  if (!ctx.state.currentTemplate) {
    return;
  }
  const duration = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  const viewport = ctx.getTimelineViewport(duration);
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  const anchor = ctx.timelineRawTimeFromEvent(event, target);
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    ctx.setTimelineZoom(
      ctx.state.timelineZoom * (event.deltaY < 0 ? 1.18 : 0.84),
      anchor,
    );
    return;
  }
  if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    event.preventDefault();
    const scrollDelta = event.deltaX || event.deltaY;
    const maxScrollLeft = ctx.getTimelineHorizontalOverflowWidth(duration);
    if (maxScrollLeft > 1) {
      ctx.refs.timelineTracks.scrollLeft = ctx.deps.clamp(
        ctx.refs.timelineTracks.scrollLeft + scrollDelta,
        0,
        maxScrollLeft,
      );
      ctx.handleTimelineTracksScroll();
      return;
    }
    const delta = (scrollDelta / 500) * viewport.span;
    ctx.panTimeline(delta);
  }
}
export function createTimelineViewportActions(
  getContext: () => ViewerAppContext,
) {
  return {
    getTimelineViewport: bindViewerAction(getTimelineViewport, getContext),
    getVisibleTimelineTicks: bindViewerAction(
      getVisibleTimelineTicks,
      getContext,
    ),
    handleTimelineWheel: bindViewerAction(handleTimelineWheel, getContext),
    panTimeline: bindViewerAction(panTimeline, getContext),
    seekFromTimelineEvent: bindViewerAction(seekFromTimelineEvent, getContext),
    seekToTime: bindViewerAction(seekToTime, getContext),
    setTimelineZoom: bindViewerAction(setTimelineZoom, getContext),
    snapTime: bindViewerAction(snapTime, getContext),
    timelineContentPixel: bindViewerAction(timelineContentPixel, getContext),
    timelinePercent: bindViewerAction(timelinePercent, getContext),
    timelineTimeFromEvent: bindViewerAction(timelineTimeFromEvent, getContext),
    timelineRawTimeFromEvent: bindViewerAction(
      timelineRawTimeFromEvent,
      getContext,
    ),
    updateTimelineViewportLabel: bindViewerAction(
      updateTimelineViewportLabel,
      getContext,
    ),
  };
}
