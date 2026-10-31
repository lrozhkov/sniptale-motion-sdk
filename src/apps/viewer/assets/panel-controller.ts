import { bindViewerAction } from "../app/bind-action.js";
import type { AssetPanelActions } from "./contract.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { ViewerAppContext } from "../app/context.js";

function handleAssetDragOver(event: DragEvent): void {
  if (
    event.dataTransfer &&
    Array.from(event.dataTransfer.types).includes(
      "application/x-sniptale-asset",
    )
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }
}

function handleAssetDrop(ctx: ViewerAppContext, event: DragEvent): void {
  const assetId = event.dataTransfer?.getData("application/x-sniptale-asset");
  if (!assetId) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  const asset = ctx.state.assets.get(assetId);
  if (!asset) {
    ctx.logDiagnostic(`Cannot drop missing asset ${assetId}.`, "error");
    return;
  }
  ctx.addAssetLayer(asset, { canvasPoint: ctx.getCanvasPointFromEvent(event) });
}

function renderAssetsPanel(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null = ctx.state.currentTemplate,
) {
  ctx.deps.renderAssetsPanelView({
    assets: ctx.state.assets,
    container: ctx.refs.assetsPanel,
    effectiveTemplate: ctx.getEffectiveTemplate(template),
    onAddAssetLayer: ctx.addAssetLayer,
    onRemoveAsset: (id) => ctx.removeAssetIfUnused(id),
    onRenameAssetPath: (id, path) => ctx.renameAssetPath(id, path),
    onReplaceAsset(assetId) {
      ctx.selectAsset(assetId);
      ctx.state.pendingAssetReplaceId = assetId;
      ctx.refs.replaceAssetInput.click();
    },
    onSelectAsset: (id) => ctx.selectAsset(id),
    selectedItem: ctx.state.selectedItem,
    template,
    translate: ctx.deps.t,
  });
}

function selectAsset(ctx: ViewerAppContext, assetId: string): void {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template?.assets?.includes(assetId)) {
    return;
  }
  ctx.state.selectedClips = [];
  ctx.state.selectedLayers = [];
  ctx.state.selectedPhases = [];
  ctx.state.selectedScenes = [];
  ctx.state.selectedKeyframes = [];
  ctx.state.selectedItem = { assetId, type: "asset" };
  ctx.renderAssetsPanel(ctx.state.currentTemplate);
  ctx.renderInspector();
  ctx.updateCanvasSelectionBox();
}

function renameAssetPath(
  ctx: ViewerAppContext,
  assetId: string,
  path: string,
): void {
  const asset = ctx.state.assets.get(assetId);
  if (!asset) {
    return;
  }
  const nextPath = String(path || assetId).trim() || assetId;
  ctx.applyEditorCommand(
    { payload: { assetId, path: nextPath }, type: "renameAsset" },
    () => {
      ctx.state.assets.set(assetId, { ...asset, path: nextPath });
      ctx.refs.timelineSaveStatus.textContent = `Renamed ${assetId}`;
      ctx.logDiagnostic(`Renamed asset ${assetId} to ${nextPath}.`, "ok");
      ctx.renderAssetsPanel(ctx.state.currentTemplate);
      ctx.renderInspector();
      ctx.renderTimelineEditor(ctx.state.currentTemplate);
    },
  );
}

function removeAssetIfUnused(ctx: ViewerAppContext, assetId: string): void {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template || !ctx.state.assets.has(assetId)) {
    return;
  }
  const usageCount = ctx.deps.getAssetUsageCount(template, assetId);
  if (usageCount > 0) {
    ctx.refs.timelineSaveStatus.textContent = `Remove blocked: ${assetId} is used ${usageCount}x`;
    ctx.logDiagnostic(
      `Remove blocked: asset ${assetId} is used by ${usageCount} layer(s).`,
      "error",
    );
    ctx.renderAssetsPanel(ctx.state.currentTemplate);
    return;
  }
  ctx.applyEditorCommand({ payload: { assetId }, type: "removeAsset" }, () => {
    ctx.state.assets.delete(assetId);
    const assets = (template.assets ?? []).filter((id) => id !== assetId);
    ctx.setEditorOverride({ assets });
    if (
      ctx.state.selectedItem?.type === "asset" &&
      ctx.state.selectedItem.assetId === assetId
    ) {
      ctx.clearTimelineSelection();
    }
    ctx.refs.timelineSaveStatus.textContent = `Removed ${assetId}`;
    ctx.logDiagnostic(`Removed unused asset ${assetId}.`, "ok");
    ctx.renderAssetsPanel(ctx.state.currentTemplate);
    ctx.renderInspector();
    ctx.renderTimelineEditor(ctx.state.currentTemplate);
    void ctx.renderCurrentFrame();
  });
}

export function createAssetPanelActions(
  getContext: () => ViewerAppContext,
): AssetPanelActions {
  return {
    handleAssetDragOver,
    handleAssetDrop: bindViewerAction(handleAssetDrop, getContext),
    renderAssetsPanel: bindViewerAction(renderAssetsPanel, getContext),
    selectAsset: bindViewerAction(selectAsset, getContext),
    renameAssetPath: bindViewerAction(renameAssetPath, getContext),
    removeAssetIfUnused: bindViewerAction(removeAssetIfUnused, getContext),
  };
}
