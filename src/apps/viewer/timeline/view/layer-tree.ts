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

function renderTimelineLayerTree(
  ctx: ViewerAppContext,
  template: TimelineViewSource,
  effectiveTemplate: EditorTemplate,
  timeline: EditorTimeline,
  sceneGroup: HTMLElement,
  scene: TimelineScene,
  layerRows: TimelineLayerRow[],
  ownershipLinks: OwnershipLinks,
  duration: number,
): void {
  for (const layerRow of layerRows) {
    if (layerRow.kind === "group") {
      ctx.renderStructuralLayerGroup(
        template,
        effectiveTemplate,
        timeline,
        sceneGroup,
        scene,
        layerRow,
        ownershipLinks,
        duration,
      );
    } else {
      ctx.renderLayerGroup(
        template,
        effectiveTemplate,
        timeline,
        sceneGroup,
        scene,
        layerRow,
        ownershipLinks,
        duration,
      );
    }
  }
}

export function createTimelineLayerTreeActions(
  getContext: () => ViewerAppContext,
) {
  return {
    renderTimelineLayerTree: bindViewerAction(
      renderTimelineLayerTree,
      getContext,
    ),
  };
}
