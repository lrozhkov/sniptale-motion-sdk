import { bindViewerAction } from "../../app/bind-action.js";
import type { EditorTemplate } from "../../templates/model.js";

import type { EditorTimeline } from "../../editor/model-types.js";

import type {
  TimelineScene,
  TimelineLayerRow,
} from "../model/row-tree-model.js";
import type { OwnershipLinks } from "../model/ownership-model.js";
import type { TimelineViewSource } from "./model.js";
import type { ViewerAppContext } from "../../app/context.js";

function renderGlobalTimelineGroup(
  ctx: ViewerAppContext,
  template: TimelineViewSource,
  effectiveTemplate: EditorTemplate,
  timeline: EditorTimeline,
  globalScene: TimelineScene | null,
  layerRows: TimelineLayerRow[],
  ownershipLinks: OwnershipLinks,
  duration: number,
): void {
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

export function createTimelineGlobalGroupActions(
  getContext: () => ViewerAppContext,
) {
  return {
    renderGlobalTimelineGroup: bindViewerAction(
      renderGlobalTimelineGroup,
      getContext,
    ),
  };
}
