import type { ViewerAppContext } from "../app/context.js";
import { getEditorContentFingerprint } from "./draft-fingerprint.js";
import { handleDraftStorageError } from "./draft-lifecycle.js";
import { editorDraftStorage } from "./draft-storage.js";

export async function resetEditorToSource(
  ctx: ViewerAppContext,
  options: { discardHistory?: boolean; deleteDraft?: boolean } = {},
): Promise<boolean> {
  const template = ctx.state.currentTemplate;
  const base = template ? ctx.state.editorBaseSnapshots.get(template.id) : null;
  if (!template || !base) {
    return false;
  }
  ctx.state.pointerDragCleanup?.();
  if (!options.discardHistory && !ctx.hasEditorContentChanges()) {
    return false;
  }
  if (!options.discardHistory) {
    ctx.commitHistory("reset-to-source");
  }
  const past = ctx.state.historyPast;
  ctx.restoreEditorSnapshotData(base);
  if (options.discardHistory) {
    ctx.state.historyPast = [];
    ctx.state.historyFuture = [];
  } else {
    ctx.state.historyPast = past;
    ctx.state.historyFuture = [];
  }
  ctx.state.historyCoalescing = null;
  syncSnapshotTime(ctx, base.time);
  ctx.renderControls(template);
  ctx.renderTimelineEditor(template);
  await ctx.renderCurrentFrame({ forceFull: true });
  if (options.deleteDraft && (await deleteActiveEditorDraft(ctx))) {
    ctx.state.editorDraft.revision = 0;
    ctx.state.editorDraft.persistedRevision = 0;
    ctx.state.editorDraft.lastPersistedFingerprint =
      getEditorContentFingerprint(ctx);
    ctx.state.editorDraft.status = "clean";
  }
  ctx.syncEditorWorkflowUi?.();
  return true;
}

export async function deleteActiveEditorDraft(
  ctx: ViewerAppContext,
): Promise<boolean> {
  const draft = ctx.state.editorDraft;
  if (draft.saveTimer !== null) {
    window.clearTimeout(draft.saveTimer);
    draft.saveTimer = null;
  }
  if (draft.savePromise) {
    await draft.savePromise;
  }
  if (!draft.activeKey) {
    return true;
  }
  try {
    await editorDraftStorage.delete(draft.activeKey);
    draft.lastLoadedUpdatedAt = 0;
    draft.lastPersistedFingerprint = null;
    draft.lastSavedAt = 0;
    return true;
  } catch (error) {
    handleDraftStorageError(ctx, "delete", error);
    return false;
  }
}

function syncSnapshotTime(ctx: ViewerAppContext, time: unknown): void {
  const duration = ctx.getEffectiveDuration(ctx.state.currentTemplate);
  const nextTime = ctx.deps.clamp(Number(time) || 0, 0, duration);
  ctx.refs.timeSlider.value = String(nextTime);
  ctx.refs.timeOutput.textContent = ctx.formatSeconds(nextTime);
  if (ctx.refs.fullscreenTimeSlider) {
    ctx.refs.fullscreenTimeSlider.value = String(nextTime);
  }
  if (ctx.refs.fullscreenTimeOutput) {
    ctx.refs.fullscreenTimeOutput.textContent = ctx.formatSeconds(nextTime);
  }
}
