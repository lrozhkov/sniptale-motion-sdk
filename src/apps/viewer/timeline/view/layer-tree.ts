import type { ViewerAppContext } from "../../app/context.js";

function renderTimelineLayerTree(
  ctx: ViewerAppContext,
  template,
  effectiveTemplate,
  timeline,
  sceneGroup,
  scene,
  layerRows,
  ownershipLinks,
  duration,
) {
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

export function installTimelineLayerTreeViewOwner(ctx: ViewerAppContext): void {
  ctx.renderTimelineLayerTree = renderTimelineLayerTree.bind(undefined, ctx);
}
