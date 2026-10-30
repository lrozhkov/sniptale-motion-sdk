import type { ViewerAppContext } from "../../app/context.js";

function renderTimelineTracks(
  ctx: ViewerAppContext,
  template,
  timeline,
  options: { reuseModel?: boolean } = {},
) {
  const startedAt = performance.now();
  const scrollTop = ctx.refs.timelineTracks.scrollTop;
  const contentRect = ctx.getTimelineContentMetrics(ctx.refs.timelineTracks);
  ctx.state.timelineTrackOverlayHeight = null;
  ctx.refs.timelineTracks.innerHTML = "";
  ctx.refs.timelineTracks.setAttribute("role", "tree");
  const spacer = document.createElement("span");
  spacer.className = "timeline-horizontal-spacer";
  spacer.setAttribute("aria-hidden", "true");
  ctx.refs.timelineTracks.append(spacer);
  const range = document.createElement("span");
  range.className = "timeline-playback-range";
  range.dataset.playbackRange = "tracks";
  range.hidden = true;
  ctx.refs.timelineTracks.append(range);
  const cached =
    options.reuseModel &&
    ctx.state.timelineRenderSnapshot?.templateId === template.id
      ? ctx.state.timelineRenderSnapshot
      : null;
  const effectiveTemplate =
    cached?.effectiveTemplate ?? ctx.getEffectiveTemplate(template);
  const duration = cached?.duration ?? effectiveTemplate.duration ?? 1;
  const ownershipLinks = ctx.buildSelectedOwnershipLinks(effectiveTemplate);
  const tree = cached?.tree ?? ctx.createTimelineRowTree(template);
  if (!cached) {
    ctx.state.timelineModelBuildCount += 1;
    ctx.state.timelineRenderSnapshot = {
      duration,
      effectiveTemplate,
      templateId: template.id,
      timeline,
      tree,
    };
  }
  ctx.beginTimelineVirtualRender(tree, scrollTop);
  ctx.renderGlobalTimelineGroup(
    template,
    effectiveTemplate,
    timeline,
    tree.globalScene,
    tree.globalLayers,
    ownershipLinks,
    duration,
  );
  for (const scene of tree.scenes) {
    ctx.renderSceneTimelineGroup(
      template,
      effectiveTemplate,
      timeline,
      scene,
      ownershipLinks,
      duration,
    );
  }
  ctx.endTimelineVirtualRender();
  renderTimelineGridLines(ctx, template, timeline, contentRect);
  const playhead = document.createElement("span");
  playhead.className = "timeline-playhead";
  playhead.dataset.playhead = "tracks";
  ctx.refs.timelineTracks.append(playhead);
  ctx.refs.timelineTracksPlayhead = playhead;
  const snapIndicator = document.createElement("span");
  snapIndicator.className = "timeline-snap-indicator";
  snapIndicator.dataset.snapIndicator = "tracks";
  ctx.refs.timelineTracks.append(snapIndicator);
  ctx.updateTimelineTrackOverlayHeights();
  ctx.updateTimelineHorizontalScrollSpacer(duration, contentRect);
  ctx.updateTimelinePlaybackRangeOverlay();
  ctx.refs.timelineTracks.scrollTop = scrollTop;
  ctx.state.lastTimelineTrackRenderMs = performance.now() - startedAt;
}

function renderTimelineGridLines(
  ctx: ViewerAppContext,
  template,
  timeline,
  contentRect = null,
) {
  const duration = timeline.duration || template.duration || 1;
  for (const time of ctx.getVisibleTimelineTicks(duration)) {
    const line = document.createElement("span");
    line.className = "timeline-grid-line";
    line.style.left = `${ctx.timelineContentPixel(
      time,
      duration,
      ctx.refs.timelineTracks,
      contentRect,
    )}px`;
    ctx.refs.timelineTracks.append(line);
  }
}

export function installTimelineTracksViewOwner(ctx: ViewerAppContext): void {
  ctx.renderTimelineTracks = renderTimelineTracks.bind(undefined, ctx);
  ctx.renderTimelineGridLines = renderTimelineGridLines.bind(undefined, ctx);
}
