import { bindViewerAction } from "../app/bind-action.js";

import type {
  LayerHierarchyActions,
  LayerHierarchySource,
} from "./hierarchy-contract.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  createLayerHierarchyIndex,
  getLayerLeafIds,
  normalizeLayerSelectionRoots,
} from "./hierarchy.js";

function getLayerHierarchy(
  ctx: ViewerAppContext,
  template: LayerHierarchySource | null = ctx.getEffectiveTemplate(
    ctx.state.currentTemplate,
  ),
) {
  return createLayerHierarchyIndex(template?.layers ?? []);
}

function getSelectedLayerRootIds(
  ctx: ViewerAppContext,
  template: LayerHierarchySource | null = ctx.getEffectiveTemplate(
    ctx.state.currentTemplate,
  ),
) {
  return normalizeLayerSelectionRoots(
    ctx.getLayerHierarchy(template),
    ctx.state.selectedLayers,
  );
}

function getSelectedLayerLeafIds(
  ctx: ViewerAppContext,
  template: LayerHierarchySource | null = ctx.getEffectiveTemplate(
    ctx.state.currentTemplate,
  ),
) {
  const hierarchy = ctx.getLayerHierarchy(template);
  return getLayerLeafIds(hierarchy, ctx.state.selectedLayers);
}

function setSelectedLayers(
  ctx: ViewerAppContext,
  layerIds: string[],
  template: LayerHierarchySource | null = ctx.getEffectiveTemplate(
    ctx.state.currentTemplate,
  ),
) {
  const roots = normalizeLayerSelectionRoots(
    ctx.getLayerHierarchy(template),
    layerIds,
  );
  ctx.state.selectedLayers = roots;
  const primary = roots.at(-1);
  ctx.state.selectedItem = primary
    ? { layerId: primary, type: "layer" }
    : { type: "effect" };
}

export function createLayerHierarchyActions(
  getContext: () => ViewerAppContext,
): LayerHierarchyActions {
  return {
    getLayerHierarchy: bindViewerAction(getLayerHierarchy, getContext),
    getSelectedLayerRootIds: bindViewerAction(
      getSelectedLayerRootIds,
      getContext,
    ),
    getSelectedLayerLeafIds: bindViewerAction(
      getSelectedLayerLeafIds,
      getContext,
    ),
    setSelectedLayers: bindViewerAction(setSelectedLayers, getContext),
  };
}
