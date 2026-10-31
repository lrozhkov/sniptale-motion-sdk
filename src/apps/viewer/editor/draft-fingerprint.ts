import type { EditorTemplateSource } from "../templates/model.js";
import type { ViewerAsset } from "../assets/state.js";
import type { ViewerAppContext } from "../app/context.js";
import { fingerprintEditorValue } from "./draft-model.js";

export function hasEditorContentChanges(ctx: ViewerAppContext): boolean {
  const templateId = ctx.state.currentTemplate?.id;
  const baseFingerprint = templateId
    ? ctx.state.editorBaseFingerprints.get(templateId)
    : null;
  return Boolean(
    baseFingerprint && baseFingerprint !== getEditorContentFingerprint(ctx),
  );
}

export function getEditorContentFingerprint(ctx: ViewerAppContext): string {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const assetIds = ctx.getEditorAssetScopeIds?.() ?? [];
  return fingerprintEditorValue({
    assets: assetIds.map((assetId) =>
      serializeDraftAsset(assetId, ctx.state.assets.get(assetId)),
    ),
    controls: ctx.state.controls,
    template,
  });
}

export function getEditorSourceFingerprint(
  ctx: ViewerAppContext,
  template: EditorTemplateSource,
): string {
  const assetIds = Array.isArray(template?.assets) ? template.assets : [];
  return fingerprintEditorValue({
    assets: assetIds
      .filter((assetId): assetId is string => typeof assetId === "string")
      .map((assetId) =>
        serializeDraftAsset(assetId, ctx.state.baseAssets.get(assetId)),
      ),
    template,
  });
}

export function ensureDraftRevisionTracksCurrentContent(
  ctx: ViewerAppContext,
): void {
  const draft = ctx.state.editorDraft;
  if (!ctx.state.currentTemplate || !draft.activeKey) {
    return;
  }
  const fingerprint = getEditorContentFingerprint(ctx);
  if (
    fingerprint !== draft.lastPersistedFingerprint &&
    draft.persistedRevision >= draft.revision
  ) {
    draft.revision = draft.persistedRevision + 1;
    draft.status = "pending";
  }
}

function serializeDraftAsset(assetId: string, asset: ViewerAsset | undefined) {
  return asset
    ? {
        dataUrl: asset.dataUrl ?? null,
        height: asset.height ?? null,
        id: assetId,
        kind: asset.kind ?? null,
        mimeType: asset.mimeType ?? null,
        path: asset.path ?? null,
        size: asset.blob?.size ?? null,
        svgText: asset.svgText ?? null,
        width: asset.width ?? null,
      }
    : { id: assetId, missing: true };
}
