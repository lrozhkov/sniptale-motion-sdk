import type { ViewerAppContext } from "../app/context.js";
import { hasEditorContentChanges } from "./draft-fingerprint.js";

export function syncEditorWorkflowUi(ctx: ViewerAppContext): void {
  const draft = ctx.state.editorDraft;
  const busy = ctx.state.editorHistoryBusy;
  const hasTemplate = Boolean(ctx.state.currentTemplate);
  if (ctx.refs.undoEditorButton) {
    ctx.refs.undoEditorButton.disabled =
      !hasTemplate || busy || ctx.state.historyPast.length === 0;
  }
  if (ctx.refs.redoEditorButton) {
    ctx.refs.redoEditorButton.disabled =
      !hasTemplate || busy || ctx.state.historyFuture.length === 0;
  }
  for (const button of [
    ctx.refs.saveDraftButton,
    ctx.refs.saveDraftMenuButton,
  ]) {
    if (button) {
      button.disabled = !hasTemplate || busy || draft.status === "saving";
      button.dataset.draftStatus = draft.status;
    }
  }
  if (ctx.refs.resetDraftButton) {
    ctx.refs.resetDraftButton.disabled =
      !hasTemplate || busy || !hasEditorContentChanges(ctx);
  }
  const status = getDraftStatusPresentation(ctx);
  for (const output of [
    ctx.refs.timelineDraftStatus,
    ctx.refs.menuDraftStatus,
  ]) {
    if (!output) {
      continue;
    }
    output.textContent = status;
    output.dataset.draftStatus = draft.status;
    output.title = status;
  }
}

export function openResetDraftDialog(ctx: ViewerAppContext): void {
  if (!hasEditorContentChanges(ctx) || ctx.refs.resetDraftDialog.open) {
    return;
  }
  ctx.refs.resetDraftDialog.showModal();
  ctx.refs.resetDraftCancelButton.focus();
}

export function closeResetDraftDialog(ctx: ViewerAppContext): void {
  if (ctx.refs.resetDraftDialog.open) {
    ctx.refs.resetDraftDialog.close();
  }
}

export async function confirmResetEditorDraft(
  ctx: ViewerAppContext,
): Promise<void> {
  closeResetDraftDialog(ctx);
  await ctx.resetEditorToSource();
  ctx.refs.undoEditorButton?.focus();
}

function getDraftStatusPresentation(ctx: ViewerAppContext): string {
  const status = ctx.state.editorDraft.status;
  const values = {
    clean: ["viewer.editor.status.clean", "No temporary changes"],
    conflict: [
      "viewer.editor.status.conflict",
      "Draft changed in another tab — reload the page",
    ],
    error: ["viewer.editor.status.error", "Draft could not be saved"],
    pending: ["viewer.editor.status.pending", "Unsaved temporary changes"],
    restored: ["viewer.editor.status.restored", "Draft restored"],
    saved: ["viewer.editor.status.saved", "Draft saved"],
    saving: ["viewer.editor.status.saving", "Saving draft…"],
  }[status] ?? ["viewer.editor.status.clean", "No temporary changes"];
  return ctx.deps.t(values[0], values[1]);
}
