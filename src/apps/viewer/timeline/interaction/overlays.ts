import type { TimelineContentMetrics } from "../view/model.js";
import { bindViewerAction } from "../../app/bind-action.js";
import type { ViewerAppContext } from "../../app/context.js";

function showTimelineSnapIndicator(ctx: ViewerAppContext, time: number): void {
  if (!ctx.state.currentTemplate) {
    return;
  }
  const duration = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  for (const root of [ctx.refs.timelineRuler, ctx.refs.timelineTracks]) {
    root.querySelectorAll(".timeline-snap-indicator").forEach((indicator) => {
      if (!(indicator instanceof HTMLElement)) return;
      indicator.style.left = `${ctx.timelineContentPixel(time, duration, root)}px`;
      indicator.classList.add("visible");
    });
  }
  if (ctx.state.snapIndicatorTimer !== null)
    window.clearTimeout(ctx.state.snapIndicatorTimer);
  ctx.state.snapIndicatorTimer = window.setTimeout(() => {
    for (const root of [ctx.refs.timelineRuler, ctx.refs.timelineTracks]) {
      root
        .querySelectorAll(".timeline-snap-indicator")
        .forEach((indicator) => indicator.classList.remove("visible"));
    }
  }, 850);
}

function updateTimelinePlayhead(ctx: ViewerAppContext): void {
  const template = ctx.state.currentTemplate;
  if (!template) {
    return;
  }
  const duration = ctx.getEffectiveDuration(template);
  const time = Number(ctx.refs.timeSlider.value) || 0;
  const rulerPlayhead = ctx.refs.timelineRulerPlayhead;
  const tracksPlayhead = ctx.refs.timelineTracksPlayhead;
  if (rulerPlayhead) {
    applyPlayheadTransform(
      rulerPlayhead,
      ctx.timelineContentPixel(time, duration, ctx.refs.timelineRuler),
    );
  }
  if (tracksPlayhead) {
    applyPlayheadTransform(
      tracksPlayhead,
      ctx.timelineContentPixel(time, duration, ctx.refs.timelineTracks),
    );
  }
  ctx.updateGraphEditorPlayhead?.(time);
}

function applyPlayheadTransform(element: HTMLElement, offset: number): void {
  const transform = `translate3d(${offset}px, 0, 0)`;
  if (element.style.transform !== transform) {
    element.style.transform = transform;
  }
}

function updateTimelineTrackOverlayHeights(ctx: ViewerAppContext): void {
  const height = ctx.getTimelineTrackOverlayHeight();
  if (ctx.state.timelineAppliedOverlayHeight === height) {
    return;
  }
  ctx.state.timelineAppliedOverlayHeight = height;
  ctx.refs.timelineTracks.style.setProperty(
    "--timeline-overlay-height",
    `${height}px`,
  );
}

function updateTimelineHorizontalScrollSpacer(
  ctx: ViewerAppContext,
  duration: number,
  contentRect: TimelineContentMetrics | null = null,
): void {
  const viewport = ctx.getTimelineViewport(duration);
  const rect =
    contentRect ?? ctx.getTimelineContentRect(ctx.refs.timelineTracks);
  const visibleWidth = Math.max(1, rect.visibleWidth ?? rect.width);
  const scrollableWidth = visibleWidth * viewport.zoom;
  const maxScrollLeft = Math.max(0, scrollableWidth - visibleWidth);
  const fitHorizontal = maxScrollLeft <= 1 || viewport.zoom <= 1.001;
  const spacer = ctx.refs.timelineTracks.querySelector(
    ".timeline-horizontal-spacer",
  );
  ctx.refs.timelineTracks.classList.toggle("fit-horizontal", fitHorizontal);
  ctx.refs.timelineTracks.style.setProperty(
    "--timeline-content-width",
    `${scrollableWidth}px`,
  );
  if (!(spacer instanceof HTMLElement)) {
    return;
  }
  spacer.style.left = `${rect.offsetLeft}px`;
  spacer.style.width = `${scrollableWidth}px`;
  if (fitHorizontal) {
    ctx.refs.timelineTracks.scrollLeft = 0;
    return;
  }
  const targetScrollLeft =
    viewport.maxStart > 0
      ? (viewport.start / viewport.maxStart) * maxScrollLeft
      : 0;
  if (Math.abs(ctx.refs.timelineTracks.scrollLeft - targetScrollLeft) > 1) {
    ctx.refs.timelineTracks.scrollLeft = targetScrollLeft;
  }
}

function handleTimelineTracksScroll(ctx: ViewerAppContext): void {
  ctx.scheduleTimelineVirtualRender?.();
  const template = ctx.state.currentTemplate;
  if (!template) {
    return;
  }
  const duration = ctx.getEffectiveDuration(template);
  const viewport = ctx.getTimelineViewport(duration);
  const maxScrollLeft = ctx.getTimelineHorizontalOverflowWidth(duration);
  if (maxScrollLeft <= 0 || viewport.maxStart <= 0) {
    return;
  }
  const nextOffset =
    (ctx.refs.timelineTracks.scrollLeft / maxScrollLeft) * viewport.maxStart;
  if (Math.abs(nextOffset - ctx.state.timelineOffset) < 0.01) {
    return;
  }
  ctx.state.timelineOffset = ctx.deps.clamp(nextOffset, 0, viewport.maxStart);
  ctx.renderTimelineRuler(template, ctx.getEffectiveTimeline(template));
  ctx.updateTimelineViewportLabel(duration);
}

export function createTimelineOverlayActions(
  getContext: () => ViewerAppContext,
) {
  return {
    handleTimelineTracksScroll: bindViewerAction(
      handleTimelineTracksScroll,
      getContext,
    ),
    showTimelineSnapIndicator: bindViewerAction(
      showTimelineSnapIndicator,
      getContext,
    ),
    updateTimelineHorizontalScrollSpacer: bindViewerAction(
      updateTimelineHorizontalScrollSpacer,
      getContext,
    ),
    updateTimelinePlayhead: bindViewerAction(
      updateTimelinePlayhead,
      getContext,
    ),
    updateTimelineTrackOverlayHeights: bindViewerAction(
      updateTimelineTrackOverlayHeights,
      getContext,
    ),
  };
}
