import type { ViewerAppContext } from "../../app/context.js";

function renderGlobalTimelineGroup(
  ctx: ViewerAppContext,
  template,
  effectiveTemplate,
  timeline,
  globalScene,
  layerRows,
  ownershipLinks,
  duration,
) {
  if (!globalScene || layerRows.length === 0) {
    return;
  }
  const group = document.createElement("div");
  group.className = "timeline-global-group";
  group.dataset.timelineScope = "global";
  ctx.renderTimelineLayerTree(
    template,
    effectiveTemplate,
    timeline,
    group,
    globalScene,
    layerRows,
    ownershipLinks,
    duration,
  );
  if (group.childElementCount > 0) {
    ctx.refs.timelineTracks.append(group);
  }
}

export function installTimelineGlobalGroupViewOwner(
  ctx: ViewerAppContext,
): void {
  ctx.renderGlobalTimelineGroup = (...args: any[]) =>
    (renderGlobalTimelineGroup as any)(ctx, ...args);
}
