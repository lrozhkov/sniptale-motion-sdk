import { bindViewerAction } from "../app/bind-action.js";
import type { LayerOperationActions } from "./actions-contract.js";
import type { ViewerAppContext } from "../app/context.js";

function focusLayer(
  ctx: ViewerAppContext,
  layerId: string,
  preferredTab: string | null = null,
) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template?.layers.some((layer) => layer.id === layerId)) {
    return;
  }
  ctx.selectLayer(layerId);
  if (preferredTab) {
    ctx.setInspectorTab(preferredTab);
  }
}

export function createLayerFocusActions(
  getContext: () => ViewerAppContext,
): Pick<LayerOperationActions, "focusLayer"> {
  return { focusLayer: bindViewerAction(focusLayer, getContext) };
}
