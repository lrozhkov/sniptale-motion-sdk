import { bindViewerAction } from "../../app/bind-action.js";
import type { ViewerAppContext } from "../../app/context.js";
import type {
  TimelineContentMetrics,
  TimelineContentRect,
} from "../view/model.js";

function getTimelineContentMetrics(
  ctx: ViewerAppContext,
  element: HTMLElement,
): TimelineContentMetrics {
  if (
    element !== ctx.refs.timelineTracks &&
    element !== ctx.refs.timelineRuler
  ) {
    return {
      offsetLeft: 0,
      width: Math.max(1, element.scrollWidth || element.clientWidth),
    };
  }
  const offsetLeft = getTimelineLabelWidth(ctx);
  const visibleWidth = getCachedTimelineVisibleWidth(ctx, offsetLeft);
  if (element === ctx.refs.timelineRuler) {
    return {
      offsetLeft,
      visibleWidth,
      width: visibleWidth,
    };
  }
  const viewport = ctx.getTimelineViewport(
    ctx.getEffectiveDuration(ctx.state.currentTemplate),
  );
  return {
    offsetLeft,
    visibleWidth,
    width: visibleWidth * viewport.zoom,
  };
}

function getCachedTimelineVisibleWidth(
  ctx: ViewerAppContext,
  offsetLeft: number,
): number {
  const cached = ctx.state.timelineContentVisibleWidth;
  if (cached !== null && Number.isFinite(cached)) return cached;
  const width = Math.max(1, ctx.refs.timelineTracks.clientWidth - offsetLeft);
  ctx.state.timelineContentVisibleWidth = width;
  return width;
}

function observeTimelineContentMetrics(ctx: ViewerAppContext): void {
  const observer = new ResizeObserver(() => {
    ctx.state.timelineContentVisibleWidth = null;
    ctx.state.timelineLabelWidth = null;
  });
  observer.observe(ctx.refs.timelineTracks);
}

function getTimelineContentRect(
  ctx: ViewerAppContext,
  element: HTMLElement,
): TimelineContentRect {
  const rootRect = element.getBoundingClientRect();
  const metrics = getTimelineContentMetrics(ctx, element);
  return {
    ...metrics,
    left: rootRect.left + metrics.offsetLeft,
  };
}

function getTimelineTrackOverlayHeight(ctx: ViewerAppContext): number {
  const cached = ctx.state.timelineTrackOverlayHeight;
  if (cached !== null && Number.isFinite(cached)) return cached;
  if (Number.isFinite(ctx.state.timelineVirtualTotalHeight)) {
    const height = Math.max(
      ctx.refs.timelineTracks.clientHeight,
      ctx.state.timelineVirtualTotalHeight,
    );
    ctx.state.timelineTrackOverlayHeight = height;
    return height;
  }
  let contentHeight = 0;
  for (const group of ctx.refs.timelineTracks.querySelectorAll(
    ".timeline-scene-group",
  )) {
    if (!(group instanceof HTMLElement)) {
      continue;
    }
    contentHeight = Math.max(
      contentHeight,
      group.offsetTop + group.offsetHeight,
    );
  }
  const height = Math.max(ctx.refs.timelineTracks.clientHeight, contentHeight);
  ctx.state.timelineTrackOverlayHeight = height;
  return height;
}

function getTimelineVisibleContentWidth(ctx: ViewerAppContext): number {
  return Math.max(
    1,
    ctx.refs.timelineTracks.clientWidth - getTimelineLabelWidth(ctx),
  );
}

function getTimelineScrollableContentWidth(
  ctx: ViewerAppContext,
  duration: number = ctx.getEffectiveDuration(ctx.state.currentTemplate),
): number {
  return (
    ctx.getTimelineVisibleContentWidth() *
    ctx.getTimelineViewport(duration).zoom
  );
}

function getTimelineHorizontalOverflowWidth(
  ctx: ViewerAppContext,
  duration: number = ctx.getEffectiveDuration(ctx.state.currentTemplate),
): number {
  return Math.max(
    0,
    ctx.getTimelineScrollableContentWidth(duration) -
      ctx.getTimelineVisibleContentWidth(),
  );
}

function getTimelineLabelWidth(ctx: ViewerAppContext): number {
  const cached = ctx.state.timelineLabelWidth;
  if (cached !== null && Number.isFinite(cached)) return cached;
  const width = Number.parseFloat(
    getComputedStyle(ctx.refs.timelineTracks).getPropertyValue(
      "--timeline-label-width",
    ),
  );
  ctx.state.timelineLabelWidth = Number.isFinite(width)
    ? width
    : ctx.deps.TIMELINE_LABEL_WIDTH;
  return ctx.state.timelineLabelWidth;
}

export function createTimelineContentMetricActions(
  getContext: () => ViewerAppContext,
) {
  return {
    getTimelineContentMetrics: bindViewerAction(
      getTimelineContentMetrics,
      getContext,
    ),
    observeTimelineContentMetrics: bindViewerAction(
      observeTimelineContentMetrics,
      getContext,
    ),
    getTimelineContentRect: bindViewerAction(
      getTimelineContentRect,
      getContext,
    ),
    getTimelineTrackOverlayHeight: bindViewerAction(
      getTimelineTrackOverlayHeight,
      getContext,
    ),
    getTimelineVisibleContentWidth: bindViewerAction(
      getTimelineVisibleContentWidth,
      getContext,
    ),
    getTimelineScrollableContentWidth: bindViewerAction(
      getTimelineScrollableContentWidth,
      getContext,
    ),
    getTimelineHorizontalOverflowWidth: bindViewerAction(
      getTimelineHorizontalOverflowWidth,
      getContext,
    ),
  };
}
