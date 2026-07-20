import type { ViewerAppContext } from "../app/context.js";
import {
  createLayerHierarchyIndex,
  getLayerLeafIds,
  normalizeLayerSelectionRoots,
} from "./hierarchy.js";

function getLayerHierarchy(
  ctx: ViewerAppContext,
  template = ctx.getEffectiveTemplate(ctx.state.currentTemplate),
) {
  return createLayerHierarchyIndex(template?.layers ?? []);
}

function getSelectedLayerRootIds(
  ctx: ViewerAppContext,
  template = ctx.getEffectiveTemplate(ctx.state.currentTemplate),
) {
  return normalizeLayerSelectionRoots(
    ctx.getLayerHierarchy(template),
    ctx.state.selectedLayers,
  );
}

function getSelectedLayerLeafIds(
  ctx: ViewerAppContext,
  template = ctx.getEffectiveTemplate(ctx.state.currentTemplate),
) {
  const hierarchy = ctx.getLayerHierarchy(template);
  return getLayerLeafIds(hierarchy, ctx.state.selectedLayers);
}

function setSelectedLayers(
  ctx: ViewerAppContext,
  layerIds: string[],
  template = ctx.getEffectiveTemplate(ctx.state.currentTemplate),
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

export function installLayersHierarchyControllerOwner(
  ctx: ViewerAppContext,
): void {
  ctx.getLayerHierarchy = (...args: any[]) =>
    (getLayerHierarchy as any)(ctx, ...args);
  ctx.getSelectedLayerRootIds = (...args: any[]) =>
    (getSelectedLayerRootIds as any)(ctx, ...args);
  ctx.getSelectedLayerLeafIds = (...args: any[]) =>
    (getSelectedLayerLeafIds as any)(ctx, ...args);
  ctx.setSelectedLayers = (...args: any[]) =>
    (setSelectedLayers as any)(ctx, ...args);
}
