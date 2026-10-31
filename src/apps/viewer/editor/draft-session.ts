import type { ViewerAppContext } from "../app/context.js";
import type { EditorTemplateSource } from "../templates/model.js";
import { createEditorDraftKey } from "./draft-model.js";
import { getDraftPackId, persistActiveTemplate } from "./draft-lifecycle.js";
import {
  getEditorContentFingerprint,
  getEditorSourceFingerprint,
} from "./draft-fingerprint.js";

export function beginEditorDraftSession(
  ctx: ViewerAppContext,
  template: EditorTemplateSource,
) {
  if (ctx.state.editorDraft.saveTimer !== null) {
    window.clearTimeout(ctx.state.editorDraft.saveTimer);
    ctx.state.editorDraft.saveTimer = null;
  }
  const packId = getDraftPackId(ctx);
  const sourceFingerprint = getEditorSourceFingerprint(ctx, template);
  const key = createEditorDraftKey(packId, template.id, sourceFingerprint);
  const draft = ctx.state.editorDraft;
  draft.activeKey = key;
  draft.lastLoadedUpdatedAt = 0;
  draft.lastPersistedFingerprint = getEditorContentFingerprint(ctx);
  draft.lastSavedAt = 0;
  draft.persistedRevision = 0;
  draft.revision = 0;
  draft.status = "clean";
  ctx.state.editorBaseSnapshots.set(
    template.id,
    ctx.captureEditorSnapshot("source-base"),
  );
  ctx.state.editorBaseFingerprints.set(
    template.id,
    getEditorContentFingerprint(ctx),
  );
  persistActiveTemplate(ctx, template.id);
  return { packId, sourceFingerprint, key, draft };
}
