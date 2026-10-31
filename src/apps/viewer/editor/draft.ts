import { beginEditorDraftSession } from "./draft-session.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  EDITOR_DRAFT_HISTORY_LIMIT,
  EDITOR_DRAFT_SCHEMA_VERSION,
  hasEditorDraftWriteConflict,
  normalizeEditorDraftRecord,
  type EditorDraftRecord,
} from "./draft-model.js";
import { editorDraftStorage } from "./draft-storage.js";
import {
  ensureDraftRevisionTracksCurrentContent,
  getEditorContentFingerprint,
  getEditorSourceFingerprint,
  hasEditorContentChanges,
} from "./draft-fingerprint.js";
import {
  getDraftPackId,
  getPreferredDraftTemplateId,
  handleDraftStorageError,
  handleEditorBeforeUnload,
  handleEditorPageHide,
} from "./draft-lifecycle.js";
import {
  closeResetDraftDialog,
  confirmResetEditorDraft,
  openResetDraftDialog,
  syncEditorWorkflowUi,
} from "./draft-ui.js";
import { deleteActiveEditorDraft, resetEditorToSource } from "./draft-reset.js";

const DRAFT_SAVE_DELAY_MS = 240;
const draftStorage = editorDraftStorage;

async function prepareEditorDraftForTemplate(
  ctx: ViewerAppContext,
  template,
): Promise<boolean> {
  const { packId, sourceFingerprint, key, draft } = beginEditorDraftSession(
    ctx,
    template,
  );
  const initialContent = getEditorContentFingerprint(ctx);
  try {
    const raw = await draftStorage.get(key);
    if (
      ctx.state.currentTemplate !== template ||
      draft.activeKey !== key ||
      draft.revision !== 0 ||
      getEditorContentFingerprint(ctx) !== initialContent
    ) {
      return false;
    }
    if (raw === null) {
      ctx.syncEditorWorkflowUi?.();
      return false;
    }
    const record = normalizeEditorDraftRecord(raw, {
      key,
      packId,
      sourceFingerprint,
      templateId: template.id,
    });
    if (!record) {
      await draftStorage.delete(key);
      ctx.logDiagnostic(
        `${template.id}: ignored an invalid local editor draft.`,
        "error",
      );
      ctx.syncEditorWorkflowUi?.();
      return false;
    }
    if (!ctx.restoreEditorSnapshotData(record.current)) {
      return false;
    }
    ctx.state.historyPast = record.historyPast.slice(
      -EDITOR_DRAFT_HISTORY_LIMIT,
    );
    ctx.state.historyFuture = record.historyFuture.slice(
      -EDITOR_DRAFT_HISTORY_LIMIT,
    );
    draft.lastLoadedUpdatedAt = record.updatedAt;
    draft.lastPersistedFingerprint = getEditorContentFingerprint(ctx);
    draft.lastSavedAt = record.updatedAt;
    draft.status = "restored";
    syncSnapshotTime(ctx, record.current.time);
    ctx.logDiagnostic(`${template.id}: restored local editor draft.`, "ok");
    ctx.syncEditorWorkflowUi?.();
    return true;
  } catch (error) {
    handleDraftStorageError(ctx, "load", error);
    return false;
  }
}

function markEditorChanged(
  ctx: ViewerAppContext,
  _reason = "edit",
  options: { immediate?: boolean } = {},
): void {
  const draft = ctx.state.editorDraft;
  if (!ctx.state.currentTemplate || !draft.activeKey) {
    return;
  }
  draft.revision += 1;
  draft.status = "pending";
  scheduleEditorDraftSave(ctx, options.immediate === true ? 0 : undefined);
  queueMicrotask(() => ctx.syncEditorWorkflowUi?.());
}

function scheduleEditorDraftSave(
  ctx: ViewerAppContext,
  delay = DRAFT_SAVE_DELAY_MS,
): void {
  const draft = ctx.state.editorDraft;
  if (draft.saveTimer !== null) {
    window.clearTimeout(draft.saveTimer);
  }
  draft.saveTimer = window.setTimeout(() => {
    draft.saveTimer = null;
    void saveEditorDraftNow(ctx);
  }, delay);
}

async function saveEditorDraftNow(
  ctx: ViewerAppContext,
  options: { manual?: boolean } = {},
): Promise<boolean> {
  const template = ctx.state.currentTemplate;
  const draft = ctx.state.editorDraft;
  const key = draft.activeKey;
  if (!template || !key) {
    return false;
  }
  if (draft.saveTimer !== null) {
    window.clearTimeout(draft.saveTimer);
    draft.saveTimer = null;
  }
  if (draft.savePromise) {
    await draft.savePromise;
    ensureDraftRevisionTracksCurrentContent(ctx);
    if (
      draft.persistedRevision === draft.revision &&
      draft.lastPersistedFingerprint === getEditorContentFingerprint(ctx)
    ) {
      return true;
    }
  }
  ensureDraftRevisionTracksCurrentContent(ctx);
  const revision = draft.revision;
  const packId = getDraftPackId(ctx);
  const sourceFingerprint = getEditorSourceFingerprint(ctx, template);
  const contentFingerprint = getEditorContentFingerprint(ctx);
  const expected = {
    key,
    packId,
    sourceFingerprint,
    templateId: template.id,
  };
  const record: EditorDraftRecord = {
    current: ctx.captureEditorSnapshot("draft-current"),
    historyFuture: ctx.state.historyFuture.slice(-EDITOR_DRAFT_HISTORY_LIMIT),
    historyPast: ctx.state.historyPast.slice(-EDITOR_DRAFT_HISTORY_LIMIT),
    key,
    packId,
    schemaVersion: EDITOR_DRAFT_SCHEMA_VERSION,
    sessionId: draft.sessionId,
    sourceFingerprint,
    templateId: template.id,
    updatedAt: Math.max(Date.now(), draft.lastLoadedUpdatedAt + 1),
  };
  draft.status = "saving";
  ctx.syncEditorWorkflowUi?.();
  const savePromise = (async () => {
    const existing = normalizeEditorDraftRecord(
      await draftStorage.get(key),
      expected,
    );
    if (
      hasEditorDraftWriteConflict(existing, {
        loadedUpdatedAt: draft.lastLoadedUpdatedAt,
        sessionId: draft.sessionId,
      })
    ) {
      draft.status = "conflict";
      ctx.logDiagnostic(
        `${template.id}: local draft changed in another tab; this tab did not overwrite it.`,
        "error",
      );
      return false;
    }
    await draftStorage.put(record);
    if (
      ctx.state.currentTemplate?.id !== template.id ||
      draft.activeKey !== key
    ) {
      return true;
    }
    draft.lastLoadedUpdatedAt = record.updatedAt;
    draft.lastPersistedFingerprint = contentFingerprint;
    draft.lastSavedAt = record.updatedAt;
    draft.persistedRevision = Math.max(draft.persistedRevision, revision);
    draft.status = "saved";
    if (options.manual) {
      ctx.logDiagnostic(`${template.id}: local draft saved.`, "ok");
    }
    return true;
  })()
    .catch((error) => {
      handleDraftStorageError(ctx, "save", error);
      return false;
    })
    .finally(() => {
      if (draft.savePromise === savePromise) {
        draft.savePromise = null;
      }
      ctx.syncEditorWorkflowUi?.();
      if (
        ctx.state.currentTemplate?.id === template.id &&
        draft.activeKey === key &&
        (draft.persistedRevision < draft.revision ||
          draft.lastPersistedFingerprint !==
            getEditorContentFingerprint(ctx)) &&
        draft.status !== "conflict" &&
        draft.status !== "error"
      ) {
        scheduleEditorDraftSave(ctx, 0);
      }
    });
  draft.savePromise = savePromise;
  return await savePromise;
}

async function flushEditorDraft(ctx: ViewerAppContext): Promise<boolean> {
  const draft = ctx.state.editorDraft;
  ensureDraftRevisionTracksCurrentContent(ctx);
  if (draft.saveTimer !== null || draft.persistedRevision < draft.revision) {
    return await saveEditorDraftNow(ctx);
  }
  if (draft.savePromise) {
    return await draft.savePromise;
  }
  return true;
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

export function installEditorDraftOwner(ctx: ViewerAppContext): void {
  ctx.prepareEditorDraftForTemplate = prepareEditorDraftForTemplate.bind(
    undefined,
    ctx,
  );
  ctx.markEditorChanged = markEditorChanged.bind(undefined, ctx);
  ctx.saveEditorDraftNow = saveEditorDraftNow.bind(undefined, ctx);
  ctx.flushEditorDraft = flushEditorDraft.bind(undefined, ctx);
  ctx.resetEditorToSource = resetEditorToSource.bind(undefined, ctx);
  ctx.deleteActiveEditorDraft = deleteActiveEditorDraft.bind(undefined, ctx);
  ctx.hasEditorContentChanges = hasEditorContentChanges.bind(undefined, ctx);
  ctx.getEditorContentFingerprint = getEditorContentFingerprint.bind(
    undefined,
    ctx,
  );
  ctx.getEditorSourceFingerprint = getEditorSourceFingerprint.bind(
    undefined,
    ctx,
  );
  ctx.syncEditorWorkflowUi = syncEditorWorkflowUi.bind(undefined, ctx);
  ctx.getPreferredDraftTemplateId = getPreferredDraftTemplateId.bind(
    undefined,
    ctx,
  );
  ctx.handleEditorPageHide = handleEditorPageHide.bind(undefined, ctx);
  ctx.handleEditorBeforeUnload = handleEditorBeforeUnload.bind(undefined, ctx);
  ctx.openResetDraftDialog = openResetDraftDialog.bind(undefined, ctx);
  ctx.closeResetDraftDialog = closeResetDraftDialog.bind(undefined, ctx);
  ctx.confirmResetEditorDraft = confirmResetEditorDraft.bind(undefined, ctx);
  void draftStorage.cleanup().catch(() => {});
}
