import type { CompositionWorkspaceView } from "./state.js";
import type { ViewerAppContext } from "../app/context.js";
import { isLayerGroup } from "../layers/hierarchy.js";

export function captureCompositionWorkspaceView(ctx: ViewerAppContext): void {
  const templateId = ctx.state.currentTemplate?.id;
  if (!templateId) {
    return;
  }
  const view: CompositionWorkspaceView = {
    canvasIsolationGroupId: ctx.state.canvasIsolationGroupId,
    expandedSceneIds: [...ctx.state.expandedSceneIds],
    expandedTimelineRowIds: [...ctx.state.expandedTimelineRowIds],
    graphEditorEnabled: Boolean(ctx.state.graphEditorEnabled),
    graphEditorViewport: ctx.deps.deepClone(ctx.state.graphEditorViewport),
    previewScrollLeft: ctx.refs.stageWrap.scrollLeft,
    previewScrollTop: ctx.refs.stageWrap.scrollTop,
    previewZoom: ctx.state.previewZoom,
    timelineOffset: ctx.state.timelineOffset,
    timelineScrollTop: ctx.refs.timelineTracks.scrollTop,
    timelineZoom: ctx.state.timelineZoom,
  };
  ctx.state.compositionWorkspaceViews.set(templateId, view);
}

export function restoreCompositionWorkspaceView(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
): boolean {
  if (!template) {
    return false;
  }
  const view = ctx.state.compositionWorkspaceViews.get(template.id);
  if (!view) {
    ctx.setPreviewZoom("fit");
    ctx.refs.timelineZoomInput.value = "1";
    return false;
  }
  ctx.state.expandedSceneIds = new Set(view.expandedSceneIds);
  ctx.state.expandedTimelineRowIds = new Set(view.expandedTimelineRowIds);
  ctx.state.timelineZoom = view.timelineZoom;
  ctx.state.timelineOffset = view.timelineOffset;
  ctx.state.graphEditorEnabled = view.graphEditorEnabled;
  ctx.state.graphEditorViewport = ctx.deps.deepClone(view.graphEditorViewport);
  ctx.state.canvasIsolationGroupId = resolveStoredIsolationId(
    ctx,
    template,
    view.canvasIsolationGroupId,
  );
  ctx.refs.timelineZoomInput.value = String(view.timelineZoom);
  ctx.setPreviewZoom(view.previewZoom);
  requestAnimationFrame(() => {
    ctx.refs.timelineTracks.scrollTop = view.timelineScrollTop;
    if (view.previewZoom !== "fit") {
      ctx.refs.stageWrap.scrollLeft = view.previewScrollLeft;
      ctx.refs.stageWrap.scrollTop = view.previewScrollTop;
    }
    ctx.renderCanvasIsolationBreadcrumb?.();
    ctx.updateCanvasSelectionBox();
  });
  return true;
}

function resolveStoredIsolationId(
  ctx: ViewerAppContext,
  template: unknown,
  isolationId: string | null,
): string | null {
  if (!isolationId) {
    return null;
  }
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const hierarchy = effectiveTemplate
    ? ctx.getLayerHierarchy(effectiveTemplate)
    : null;
  const layer = hierarchy?.byId.get(isolationId);
  return isLayerGroup(layer) ? layer.id : null;
}

function clearCompositionWorkspaceView(
  ctx: ViewerAppContext,
  templateId = ctx.state.currentTemplate?.id,
): void {
  if (templateId) {
    ctx.state.compositionWorkspaceViews.delete(templateId);
  }
}

export function installCompositionWorkspaceViewOwner(
  ctx: ViewerAppContext,
): void {
  ctx.captureCompositionWorkspaceView = captureCompositionWorkspaceView.bind(
    undefined,
    ctx,
  );
  ctx.clearCompositionWorkspaceView = clearCompositionWorkspaceView.bind(
    undefined,
    ctx,
  );
  ctx.restoreCompositionWorkspaceView = restoreCompositionWorkspaceView.bind(
    undefined,
    ctx,
  );
}
