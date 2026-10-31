import type { EffectLayer } from "../../../sdk/types.js";
import type { ViewerAppContext } from "../app/context.js";
import { getLayerAncestorIds, isLayerGroup } from "../layers/hierarchy.js";

export function resolveCanvasHitSelectionLayerId(
  ctx: ViewerAppContext,
  leafLayerId: string,
  template: {
    layers: readonly EffectLayer[];
  } | null = ctx.getEffectiveTemplate(ctx.state.currentTemplate),
): string | null {
  if (!template) {
    return null;
  }
  const hierarchy = ctx.getLayerHierarchy(template);
  if (!hierarchy.byId.has(leafLayerId)) {
    return null;
  }
  const isolationId = getValidCanvasIsolationGroupId(ctx, hierarchy);
  if (!isolationId) {
    const topAncestorId = getLayerAncestorIds(hierarchy, leafLayerId).at(-1);
    return topAncestorId ?? leafLayerId;
  }
  let currentId = leafLayerId;
  let parent = hierarchy.parentById.get(currentId) ?? null;
  while (parent && parent.id !== isolationId) {
    currentId = parent.id;
    parent = hierarchy.parentById.get(currentId) ?? null;
  }
  return parent?.id === isolationId ? currentId : null;
}

export function getCanvasSelectionLevelLayerIds(
  ctx: ViewerAppContext,
  template: {
    layers: readonly EffectLayer[];
  } | null = ctx.getEffectiveTemplate(ctx.state.currentTemplate),
): string[] {
  if (!template) {
    return [];
  }
  const hierarchy = ctx.getLayerHierarchy(template);
  const isolationId = getValidCanvasIsolationGroupId(ctx, hierarchy);
  return (hierarchy.childrenByParentId.get(isolationId) ?? []).map(
    (layer) => layer.id,
  );
}

export function selectCanvasLayers(
  ctx: ViewerAppContext,
  layerIds: string[],
  primaryLayerId: string | null = layerIds.at(-1) ?? null,
  options: { sync?: boolean } = {},
): void {
  const ordered = layerIds.filter((layerId) => layerId !== primaryLayerId);
  if (primaryLayerId && layerIds.includes(primaryLayerId)) {
    ordered.push(primaryLayerId);
  }
  ctx.clearSelectionCollections("layer");
  ctx.setSelectedLayers(ordered);
  ctx.setSidebarGroup("inspect");
  if (options.sync !== false) {
    ctx.syncTimelineSelection(ctx.state.currentTemplate);
  }
}

export function enterCanvasGroup(
  ctx: ViewerAppContext,
  groupId: string,
  leafLayerId: string | null = null,
): boolean {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const hierarchy = template ? ctx.getLayerHierarchy(template) : null;
  const group = hierarchy?.byId.get(groupId);
  if (!template || !hierarchy || !isLayerGroup(group)) {
    return false;
  }
  ctx.state.canvasIsolationGroupId = groupId;
  const hitChildId = leafLayerId
    ? resolveCanvasHitSelectionLayerId(ctx, leafLayerId, template)
    : null;
  const childId =
    hitChildId ?? hierarchy.childrenByParentId.get(groupId)?.at(-1)?.id ?? null;
  selectCanvasLayers(ctx, childId ? [childId] : [], childId, {
    sync: false,
  });
  ctx.renderCanvasIsolationBreadcrumb?.();
  if (
    !childId ||
    !ctx.revealTimelineLayerById?.(childId, {
      focus: false,
      select: false,
    })
  ) {
    ctx.syncTimelineSelection(ctx.state.currentTemplate);
  }
  return true;
}

export function enterSelectedCanvasGroup(ctx: ViewerAppContext): boolean {
  const item = ctx.state.selectedItem;
  return item?.type === "layer" ? enterCanvasGroup(ctx, item.layerId) : false;
}

export function exitCanvasGroupIsolation(ctx: ViewerAppContext): boolean {
  const groupId = ctx.state.canvasIsolationGroupId;
  if (!groupId) {
    return false;
  }
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const hierarchy = template ? ctx.getLayerHierarchy(template) : null;
  const group = hierarchy?.byId.get(groupId);
  if (!hierarchy || !isLayerGroup(group)) {
    ctx.state.canvasIsolationGroupId = null;
    return false;
  }
  const parent = hierarchy.parentById.get(groupId) ?? null;
  ctx.state.canvasIsolationGroupId = isLayerGroup(parent) ? parent.id : null;
  selectCanvasLayers(ctx, [groupId], groupId, { sync: false });
  ctx.renderCanvasIsolationBreadcrumb?.();
  if (
    !ctx.revealTimelineLayerById?.(groupId, {
      focus: false,
      select: false,
    })
  ) {
    ctx.syncTimelineSelection(ctx.state.currentTemplate);
  }
  return true;
}

function getValidCanvasIsolationGroupId(ctx, hierarchy): string | null {
  const isolationId = ctx.state.canvasIsolationGroupId;
  const isolation = isolationId ? hierarchy.byId.get(isolationId) : null;
  if (isLayerGroup(isolation)) {
    return isolation.id;
  }
  ctx.state.canvasIsolationGroupId = null;
  return null;
}

export function installCanvasSelectionLevelOwner(ctx: ViewerAppContext): void {
  ctx.resolveCanvasHitSelectionLayerId = resolveCanvasHitSelectionLayerId.bind(
    undefined,
    ctx,
  );
  ctx.getCanvasSelectionLevelLayerIds = getCanvasSelectionLevelLayerIds.bind(
    undefined,
    ctx,
  );
  ctx.selectCanvasLayers = selectCanvasLayers.bind(undefined, ctx);
  ctx.enterCanvasGroup = enterCanvasGroup.bind(undefined, ctx);
  ctx.enterSelectedCanvasGroup = enterSelectedCanvasGroup.bind(undefined, ctx);
  ctx.exitCanvasGroupIsolation = exitCanvasGroupIsolation.bind(undefined, ctx);
}
