import type { ViewerAppContext } from "../app/context.js";

function commitHistory(
  ctx: ViewerAppContext,
  label = "edit",
  options: { coalesceKey?: string; coalesceWindowMs?: number } = {},
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

async function restoreEditorSnapshot(ctx: ViewerAppContext, snapshot) {
  if (!restoreEditorSnapshotData(ctx, snapshot)) {
    return false;
  }
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
  return true;
}

function restoreEditorSnapshotData(ctx: ViewerAppContext, snapshot): boolean {
  if (
    !snapshot?.templateId ||
    ctx.state.currentTemplate?.id !== snapshot.templateId
  ) {
    return false;
  }
  const previousAssetScopeIds = getEditorAssetScopeIds(ctx);
  ctx.deps.restoreEditorSnapshotState(ctx.state, snapshot, {
    fallbackControls: ctx.deps.buildControlsWithDefaults(
      ctx.state.currentTemplate,
    ),
  });
  restoreEditorSnapshotAssets(ctx, snapshot, previousAssetScopeIds);
  return true;
}

async function undoEditorEdit(ctx: ViewerAppContext) {
  if (ctx.state.editorHistoryBusy || ctx.state.historyPast.length === 0) {
    return false;
  }
  const current = ctx.captureEditorSnapshot("redo-base");
  const snapshot = ctx.state.historyPast.pop();
  ctx.state.editorHistoryBusy = true;
  ctx.syncEditorWorkflowUi?.();
  try {
    if (!(await ctx.restoreEditorSnapshot(snapshot))) {
      ctx.state.historyPast.push(snapshot);
      return false;
    }
    ctx.state.historyFuture.push(current);
    ctx.state.historyFuture = ctx.state.historyFuture.slice(-80);
    ctx.state.historyCoalescing = null;
    ctx.markEditorChanged?.("undo", { immediate: true });
    return true;
  } finally {
    ctx.state.editorHistoryBusy = false;
    ctx.syncEditorWorkflowUi?.();
  }
}

async function redoEditorEdit(ctx: ViewerAppContext) {
  if (ctx.state.editorHistoryBusy || ctx.state.historyFuture.length === 0) {
    return false;
  }
  const current = ctx.captureEditorSnapshot("undo-base");
  const snapshot = ctx.state.historyFuture.pop();
  ctx.state.editorHistoryBusy = true;
  ctx.syncEditorWorkflowUi?.();
  try {
    if (!(await ctx.restoreEditorSnapshot(snapshot))) {
      ctx.state.historyFuture.push(snapshot);
      return false;
    }
    ctx.state.historyPast.push(current);
    ctx.state.historyPast = ctx.state.historyPast.slice(-80);
    ctx.state.historyCoalescing = null;
    ctx.markEditorChanged?.("redo", { immediate: true });
    return true;
  } finally {
    ctx.state.editorHistoryBusy = false;
    ctx.syncEditorWorkflowUi?.();
  }
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

function restoreEditorSnapshotAssets(
  ctx: ViewerAppContext,
  snapshot,
  previousAssetScopeIds: string[],
): void {
  const snapshotEntries = new Map(
    Array.isArray(snapshot.assetEntries) ? snapshot.assetEntries : [],
  );
  const scopeIds = new Set([
    ...previousAssetScopeIds,
    ...(Array.isArray(snapshot.assetScopeIds) ? snapshot.assetScopeIds : []),
  ]);
  for (const assetId of scopeIds) {
    if (snapshotEntries.has(assetId)) {
      ctx.state.assets.set(assetId, snapshotEntries.get(assetId));
    } else if (ctx.state.baseAssets.has(assetId)) {
      ctx.state.assets.set(assetId, ctx.state.baseAssets.get(assetId));
    } else {
      ctx.state.assets.delete(assetId);
    }
  }
}

export function installEditorHistoryControllerOwner(
  ctx: ViewerAppContext,
): void {
  ctx.commitHistory = (...args: any[]) => (commitHistory as any)(ctx, ...args);
  ctx.captureEditorSnapshot = (...args: any[]) =>
    (captureEditorSnapshot as any)(ctx, ...args);
  ctx.getEditorAssetScopeIds = (...args: any[]) =>
    (getEditorAssetScopeIds as any)(ctx, ...args);
  ctx.restoreEditorSnapshot = (...args: any[]) =>
    (restoreEditorSnapshot as any)(ctx, ...args);
  ctx.restoreEditorSnapshotData = (...args: any[]) =>
    (restoreEditorSnapshotData as any)(ctx, ...args);
  ctx.undoEditorEdit = (...args: any[]) =>
    (undoEditorEdit as any)(ctx, ...args);
  ctx.redoEditorEdit = (...args: any[]) =>
    (redoEditorEdit as any)(ctx, ...args);
}
