import type { ViewerAppContext } from "../../app/context.js";

function showTimelineSnapIndicator(ctx: ViewerAppContext, time) {
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
  window.clearTimeout(ctx.state.snapIndicatorTimer);
  ctx.state.snapIndicatorTimer = window.setTimeout(() => {
    for (const root of [ctx.refs.timelineRuler, ctx.refs.timelineTracks]) {
      root
        .querySelectorAll(".timeline-snap-indicator")
        .forEach((indicator) => indicator.classList.remove("visible"));
    }
  }, 850);
}

function updateTimelinePlayhead(ctx: ViewerAppContext) {
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

function getTimelineContentMetrics(ctx: ViewerAppContext, element) {
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
) {
  if (Number.isFinite(ctx.state.timelineContentVisibleWidth)) {
    return ctx.state.timelineContentVisibleWidth;
  }
  const width = Math.max(1, ctx.refs.timelineTracks.clientWidth - offsetLeft);
  ctx.state.timelineContentVisibleWidth = width;
  return width;
}

function observeTimelineContentMetrics(ctx: ViewerAppContext) {
  const observer = new ResizeObserver(() => {
    ctx.state.timelineContentVisibleWidth = null;
    ctx.state.timelineLabelWidth = null;
  });
  observer.observe(ctx.refs.timelineTracks);
}

function getTimelineContentRect(ctx: ViewerAppContext, element) {
  const rootRect = element.getBoundingClientRect();
  const metrics = getTimelineContentMetrics(ctx, element);
  return {
    ...metrics,
    left: rootRect.left + metrics.offsetLeft,
  };
}

function getTimelineTrackOverlayHeight(ctx: ViewerAppContext) {
  if (Number.isFinite(ctx.state.timelineTrackOverlayHeight)) {
    return ctx.state.timelineTrackOverlayHeight;
  }
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

function updateTimelineTrackOverlayHeights(ctx: ViewerAppContext) {
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
  duration,
  contentRect = null,
) {
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

function handleTimelineTracksScroll(ctx: ViewerAppContext) {
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

function getTimelineVisibleContentWidth(ctx: ViewerAppContext) {
  return Math.max(
    1,
    ctx.refs.timelineTracks.clientWidth - getTimelineLabelWidth(ctx),
  );
}

function getTimelineScrollableContentWidth(
  ctx: ViewerAppContext,
  duration = ctx.getEffectiveDuration(ctx.state.currentTemplate),
) {
  return (
    ctx.getTimelineVisibleContentWidth() *
    ctx.getTimelineViewport(duration).zoom
  );
}

function getTimelineHorizontalOverflowWidth(
  ctx: ViewerAppContext,
  duration = ctx.getEffectiveDuration(ctx.state.currentTemplate),
) {
  return Math.max(
    0,
    ctx.getTimelineScrollableContentWidth(duration) -
      ctx.getTimelineVisibleContentWidth(),
  );
}

function getTimelineLabelWidth(ctx: ViewerAppContext) {
  if (Number.isFinite(ctx.state.timelineLabelWidth)) {
    return ctx.state.timelineLabelWidth;
  }
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

export function installInteractionTimelineOverlaysOwner(
  ctx: ViewerAppContext,
): void {
  Object.assign(ctx, {
    getTimelineContentMetrics: (...args: any[]) =>
      (getTimelineContentMetrics as any)(ctx, ...args),
    getTimelineContentRect: (...args: any[]) =>
      (getTimelineContentRect as any)(ctx, ...args),
    getTimelineHorizontalOverflowWidth: (...args: any[]) =>
      (getTimelineHorizontalOverflowWidth as any)(ctx, ...args),
    getTimelineScrollableContentWidth: (...args: any[]) =>
      (getTimelineScrollableContentWidth as any)(ctx, ...args),
    getTimelineTrackOverlayHeight: (...args: any[]) =>
      (getTimelineTrackOverlayHeight as any)(ctx, ...args),
    getTimelineVisibleContentWidth: (...args: any[]) =>
      (getTimelineVisibleContentWidth as any)(ctx, ...args),
    handleTimelineTracksScroll: (...args: any[]) =>
      (handleTimelineTracksScroll as any)(ctx, ...args),
    observeTimelineContentMetrics: (...args: any[]) =>
      (observeTimelineContentMetrics as any)(ctx, ...args),
    showTimelineSnapIndicator: (...args: any[]) =>
      (showTimelineSnapIndicator as any)(ctx, ...args),
    updateTimelineHorizontalScrollSpacer: (...args: any[]) =>
      (updateTimelineHorizontalScrollSpacer as any)(ctx, ...args),
    updateTimelinePlayhead: (...args: any[]) =>
      (updateTimelinePlayhead as any)(ctx, ...args),
    updateTimelineTrackOverlayHeights: (...args: any[]) =>
      (updateTimelineTrackOverlayHeights as any)(ctx, ...args),
  });
}
