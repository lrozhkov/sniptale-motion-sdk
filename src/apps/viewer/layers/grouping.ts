import type { ViewerAppContext } from "../app/context.js";
import { isLayerGroup } from "./hierarchy.js";
import {
  canGroupLayerSelection,
  createUniqueLayerGroupId,
  groupLayerSelection,
  ungroupLayerSelection,
} from "./hierarchy-operations.js";

function getLayerGroupingState(ctx: ViewerAppContext) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return { canGroup: false, canUngroup: false, groupReason: "no-template" };
  }
  const rootIds = ctx.getSelectedLayerRootIds(template);
  const grouping = canGroupLayerSelection(template.layers, rootIds);
  return {
    canGroup: grouping.ok,
    canUngroup: rootIds.some((id) =>
      isLayerGroup(ctx.getLayerHierarchy(template).byId.get(id)),
    ),
    groupReason: "reason" in grouping ? grouping.reason : null,
  };
}

function groupSelectedLayers(ctx: ViewerAppContext) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return false;
  }
  const rootIds = ctx.getSelectedLayerRootIds(template);
  const check = canGroupLayerSelection(template.layers, rootIds);
  if (!check.ok) {
    ctx.logDiagnostic(
      getGroupingFailureMessage(
        ctx,
        "reason" in check ? check.reason : "invalid-hierarchy",
      ),
      "error",
    );
    return false;
  }
  const groupId = createUniqueLayerGroupId(template.layers);
  const groupNumber = groupId.match(/(\d+)$/)?.[1] ?? "";
  const groupName = ctx.deps
    .t("viewer.layers.groupName", "Group {number}")
    .replace("{number}", groupNumber);
  const layers = groupLayerSelection(template.layers, rootIds, {
    id: groupId,
    name: groupName,
    type: "group",
  });
  ctx.beginEditorCommand({
    payload: { groupId, layerIds: rootIds },
    type: "groupLayers",
  });
  ctx.setEditorOverride({ layers });
  ctx.setSelectedLayers([groupId], { ...template, layers });
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  void ctx.renderCurrentFrame();
  return true;
}

function ungroupSelectedLayers(ctx: ViewerAppContext) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template) {
    return false;
  }
  const hierarchy = ctx.getLayerHierarchy(template);
  const groupIds = ctx
    .getSelectedLayerRootIds(template)
    .filter((id) => isLayerGroup(hierarchy.byId.get(id)));
  if (groupIds.length === 0) {
    return false;
  }
  const childIds = groupIds.flatMap((groupId) =>
    (hierarchy.childrenByParentId.get(groupId) ?? []).map((layer) => layer.id),
  );
  const layers = ungroupLayerSelection(template.layers, groupIds);
  ctx.beginEditorCommand({
    payload: { groupIds },
    type: "ungroupLayers",
  });
  ctx.setEditorOverride({ layers });
  ctx.setSelectedLayers(childIds, { ...template, layers });
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  void ctx.renderCurrentFrame();
  return true;
}

function getGroupingFailureMessage(ctx: ViewerAppContext, reason: string) {
  const key = `viewer.layers.groupingErrors.${reason}`;
  const fallbacks = {
    "different-parents": "Selected layers must have the same parent.",
    "invalid-hierarchy": "Repair the layer hierarchy before grouping.",
    "non-contiguous": "Selected layers must be adjacent in stacking order.",
    "selection-too-small": "Select at least two layers.",
    "too-deep": "The resulting group would be nested too deeply.",
  };
  return ctx.deps.t(key, fallbacks[reason] ?? "Layers cannot be grouped.");
}

export function installLayersGroupingOwner(ctx: ViewerAppContext): void {
  ctx.getLayerGroupingState = getLayerGroupingState.bind(undefined, ctx);
  ctx.groupSelectedLayers = groupSelectedLayers.bind(undefined, ctx);
  ctx.ungroupSelectedLayers = ungroupSelectedLayers.bind(undefined, ctx);
}
