import type { ViewerAppContext } from "../app/context.js";

export function wireEditorDraftEvents(ctx: ViewerAppContext): void {
  ctx.refs.saveDraftButton.addEventListener(
    "click",
    () => void ctx.saveEditorDraftNow({ manual: true }),
  );
  ctx.refs.saveDraftMenuButton.addEventListener(
    "click",
    () => void ctx.saveEditorDraftNow({ manual: true }),
  );
  ctx.refs.undoEditorButton.addEventListener(
    "click",
    () => void ctx.undoEditorEdit(),
  );
  ctx.refs.redoEditorButton.addEventListener(
    "click",
    () => void ctx.redoEditorEdit(),
  );
  ctx.refs.resetDraftButton.addEventListener("click", () =>
    ctx.openResetDraftDialog(),
  );
  ctx.refs.resetDraftCancelButton.addEventListener("click", () =>
    ctx.closeResetDraftDialog(),
  );
  ctx.refs.resetDraftConfirmButton.addEventListener(
    "click",
    () => void ctx.confirmResetEditorDraft(),
  );
  ctx.refs.resetDraftDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    ctx.closeResetDraftDialog();
  });
  window.addEventListener("pagehide", ctx.handleEditorPageHide);
  window.addEventListener("beforeunload", ctx.handleEditorBeforeUnload);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      ctx.handleEditorPageHide();
    }
  });
}
