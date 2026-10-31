import { bindViewerAction } from "../app/bind-action.js";
import type { EditorHistoryActions, HistoryCommitOptions } from "./contract.js";
import type { EditorSnapshot } from "./history.js";
import { readViewerAsset, type ViewerAsset } from "../assets/state.js";
import { invalidateCanvasDragPreview } from "../canvas/drag-preview.js";
import type { ViewerAppContext } from "../app/context.js";

function commitHistory(
  ctx: ViewerAppContext,
  label = "edit",
  options: HistoryCommitOptions = {},
) {
  if (!ctx.state.currentTemplate) {
    return false;
  }
  const now = performance.now();
  const coalescing = ctx.state.historyCoalescing;
  if (
    options.coalesceKey &&
    coalescing?.key === options.coalesceKey &&
    coalescing.templateId === ctx.state.currentTemplate.id &&
    coalescing.historyLength === ctx.state.historyPast.length &&
    now - coalescing.lastAt <= (options.coalesceWindowMs ?? 500)
  ) {
    coalescing.lastAt = now;
    ctx.markEditorChanged?.(label);
    return false;
  }
  const snapshot = ctx.captureEditorSnapshot(label);
  const committed = ctx.deps.commitEditorHistory(ctx.state, snapshot);
  if (committed) {
    ctx.state.historyCoalescing = options.coalesceKey
      ? {
          historyLength: ctx.state.historyPast.length,
          key: options.coalesceKey,
          lastAt: now,
          templateId: ctx.state.currentTemplate.id,
        }
      : null;
    ctx.markEditorChanged?.(label);
    ctx.syncEditorWorkflowUi?.();
  }
  return committed;
}

function captureEditorSnapshot(ctx: ViewerAppContext, label = "edit") {
  const assetScopeIds = getEditorAssetScopeIds(ctx);
  return ctx.deps.captureEditorSnapshotState(
    ctx.state,
    label,
    ctx.state.currentTemplate?.id ?? null,
    Number(ctx.refs.timeSlider.value) || 0,
    {
      assetEntries: assetScopeIds
        .filter(
          (assetId) =>
            ctx.state.assets.has(assetId) &&
            ctx.state.assets.get(assetId) !== ctx.state.baseAssets.get(assetId),
        )
        .map((assetId) => [assetId, ctx.state.assets.get(assetId)]),
      assetScopeIds,
    },
  );
}

async function presentEditorSnapshot(
  ctx: ViewerAppContext,
  snapshot: EditorSnapshot,
): Promise<void> {
  ctx.refs.timeSlider.value = String(
    ctx.deps.clamp(
      Number(snapshot.time) || 0,
      0,
      ctx.getEffectiveDuration(ctx.state.currentTemplate),
    ),
  );
  ctx.refs.timeOutput.textContent = ctx.formatSeconds(
    ctx.refs.timeSlider.value,
  );
  ctx.renderTimelineEditor(ctx.state.currentTemplate);
  ctx.renderControls(ctx.state.currentTemplate);
  await ctx.renderCurrentFrame();
}

function restoreEditorSnapshotData(
  ctx: ViewerAppContext,
  snapshot: EditorSnapshot,
): boolean {
  if (
    !snapshot?.templateId ||
    ctx.state.currentTemplate?.id !== snapshot.templateId
  ) {
    return false;
  }
  const snapshotAssets = readSnapshotAssets(snapshot.assetEntries);
  if (!snapshotAssets) return false;
  const previousAssetScopeIds = getEditorAssetScopeIds(ctx);
  ctx.deps.restoreEditorSnapshotState(ctx.state, snapshot, {
    fallbackControls: ctx.deps.buildControlsWithDefaults(
      ctx.state.currentTemplate,
    ),
  });
  invalidateCanvasDragPreview(ctx.state, ctx.refs?.canvasSelectionBox);
  restoreEditorSnapshotAssets(
    ctx,
    snapshot,
    previousAssetScopeIds,
    snapshotAssets,
  );
  return true;
}

async function moveEditorHistory(
  ctx: ViewerAppContext,
  direction: "undo" | "redo",
): Promise<boolean> {
  if (ctx.state.editorHistoryBusy) return false;
  ctx.state.pointerDragCleanup?.();
  const source =
    direction === "undo" ? ctx.state.historyPast : ctx.state.historyFuture;
  const snapshot = source.at(-1);
  if (!snapshot) return false;
  const current = ctx.captureEditorSnapshot(
    direction === "undo" ? "redo-base" : "undo-base",
  );
  ctx.state.editorHistoryBusy = true;
  try {
    if (!restoreEditorSnapshotData(ctx, snapshot)) return false;
    source.pop();
    if (direction === "undo")
      ctx.state.historyFuture = [...ctx.state.historyFuture, current].slice(
        -80,
      );
    else ctx.state.historyPast = [...ctx.state.historyPast, current].slice(-80);
    ctx.state.historyCoalescing = null;
    ctx.markEditorChanged(direction, { immediate: true });
    ctx.syncEditorWorkflowUi();
    await presentEditorSnapshot(ctx, snapshot);
    return true;
  } finally {
    ctx.state.editorHistoryBusy = false;
    ctx.syncEditorWorkflowUi();
  }
}

function undoEditorEdit(ctx: ViewerAppContext): Promise<boolean> {
  return moveEditorHistory(ctx, "undo");
}

function redoEditorEdit(ctx: ViewerAppContext): Promise<boolean> {
  return moveEditorHistory(ctx, "redo");
}

function getEditorAssetScopeIds(ctx: ViewerAppContext): string[] {
  const template = ctx.state.currentTemplate;
  if (!template) {
    return [];
  }
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  return [
    ...new Set([
      ...(Array.isArray(template.assets) ? template.assets : []),
      ...(Array.isArray(effectiveTemplate?.assets)
        ? effectiveTemplate.assets
        : []),
    ]),
  ].filter((assetId): assetId is string => typeof assetId === "string");
}

function readSnapshotAssets(value: unknown): Map<string, ViewerAsset> | null {
  const entries = new Map<string, ViewerAsset>();
  if (value === undefined) return entries;
  if (!Array.isArray(value)) return null;
  for (const entry of value) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== "string"
    )
      return null;
    const asset = readViewerAsset(entry[1]);
    if (!asset || asset.id !== entry[0] || entries.has(entry[0])) return null;
    entries.set(entry[0], asset);
  }
  return entries;
}

function restoreEditorSnapshotAssets(
  ctx: ViewerAppContext,
  snapshot: EditorSnapshot,
  previousAssetScopeIds: string[],
  snapshotEntries: ReadonlyMap<string, ViewerAsset>,
): void {
  const scopeIds = new Set([
    ...previousAssetScopeIds,
    ...(Array.isArray(snapshot.assetScopeIds) ? snapshot.assetScopeIds : []),
  ]);
  for (const assetId of scopeIds) {
    if (snapshotEntries.has(assetId)) {
      const asset = snapshotEntries.get(assetId);
      if (asset) ctx.state.assets.set(assetId, asset);
    } else if (ctx.state.baseAssets.has(assetId)) {
      const asset = ctx.state.baseAssets.get(assetId);
      if (asset) ctx.state.assets.set(assetId, asset);
    } else {
      ctx.state.assets.delete(assetId);
    }
  }
}

export function createEditorHistoryActions(
  getContext: () => ViewerAppContext,
): EditorHistoryActions {
  return {
    commitHistory: bindViewerAction(commitHistory, getContext),
    captureEditorSnapshot: bindViewerAction(captureEditorSnapshot, getContext),
    getEditorAssetScopeIds: bindViewerAction(
      getEditorAssetScopeIds,
      getContext,
    ),
    restoreEditorSnapshotData: bindViewerAction(
      restoreEditorSnapshotData,
      getContext,
    ),
    undoEditorEdit: bindViewerAction(undoEditorEdit, getContext),
    redoEditorEdit: bindViewerAction(redoEditorEdit, getContext),
  };
}
