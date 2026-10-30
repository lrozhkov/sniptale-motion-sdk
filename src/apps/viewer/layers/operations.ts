import type { ViewerAppContext } from "../app/context.js";

function focusLayer(ctx: ViewerAppContext, layerId, preferredTab = null) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template?.layers.some((layer) => layer.id === layerId)) {
    return;
  }
  ctx.selectLayer(layerId);
  if (preferredTab) {
    ctx.setInspectorTab(preferredTab);
  }
}

export function installLayersOperationsOwner(ctx: ViewerAppContext): void {
  ctx.focusLayer = focusLayer.bind(undefined, ctx);
}
