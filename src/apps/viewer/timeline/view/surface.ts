import { readTimelineRenderSnapshot } from "../snapshot.js";
import type { ViewerAppContext } from "../../app/context.js";

function renderTimelineStructure(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
): void {
  renderTimelineSurface(ctx, template, { reuseModel: true, tracks: true });
}

function renderTimelineViewport(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
): void {
  renderTimelineSurface(ctx, template, {
    reuseModel: true,
    ruler: true,
    tracks: true,
  });
}

function renderTimelineModel(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
): void {
  renderTimelineSurface(ctx, template, {
    curve: true,
    selectionCrumb: true,
    tracks: true,
  });
}

function renderTimelineSurface(
  ctx: ViewerAppContext,
  template,
  options: {
    curve?: boolean;
    reuseModel?: boolean;
    ruler?: boolean;
    selectionCrumb?: boolean;
    tracks?: boolean;
  },
): void {
  if (!template) {
    return;
  }
  const startedAt = performance.now();
  const scrollLeft = ctx.refs.timelineTracks.scrollLeft;
  const scrollTop = ctx.refs.timelineTracks.scrollTop;
  ctx.reconcileTimelineSelection(template);
  const snapshot = options.reuseModel
    ? readTimelineRenderSnapshot(ctx.state, template)
    : null;
  const timeline = snapshot?.timeline ?? ctx.getEffectiveTimeline(template);
  if (options.ruler) {
    ctx.renderTimelineRuler(template, timeline);
  }
  if (options.tracks) {
    ctx.renderTimelineTracks(template, timeline, {
      reuseModel: Boolean(snapshot),
    });
  }
  if (options.curve) {
    ctx.renderCurveEditor(timeline);
  }
  if (options.selectionCrumb) {
    ctx.renderSelectionCrumb(template);
  }
  ctx.refs.timelineTracks.scrollLeft = scrollLeft;
  ctx.refs.timelineTracks.scrollTop = scrollTop;
  ctx.updateTimelinePlayhead();
  ctx.state.timelineIncrementalRenderCount += 1;
  ctx.state.lastTimelineSurfaceRenderMs = performance.now() - startedAt;
}

export function installTimelineSurfaceViewOwner(ctx: ViewerAppContext): void {
  ctx.renderTimelineModel = renderTimelineModel.bind(undefined, ctx);
  ctx.renderTimelineStructure = renderTimelineStructure.bind(undefined, ctx);
  ctx.renderTimelineViewport = renderTimelineViewport.bind(undefined, ctx);
}
