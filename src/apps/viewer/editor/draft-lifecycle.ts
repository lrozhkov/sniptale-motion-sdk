import type { ViewerAppContext } from "../app/context.js";
import { ensureDraftRevisionTracksCurrentContent } from "./draft-fingerprint.js";

const ACTIVE_TEMPLATE_STORAGE_KEY = "sniptale.viewer.active-template.v1";

export function getPreferredDraftTemplateId(
  ctx: ViewerAppContext,
  templates: readonly { id: string }[],
): string | null {
  try {
    const value: unknown = JSON.parse(
      window.localStorage?.getItem(ACTIVE_TEMPLATE_STORAGE_KEY) ?? "null",
    );
    if (
      value !== null &&
      typeof value === "object" &&
      "packId" in value &&
      value.packId === getDraftPackId(ctx) &&
      "templateId" in value &&
      typeof value.templateId === "string" &&
      templates.some((template) => template.id === value.templateId)
    ) {
      return value.templateId;
    }
  } catch {}
  return null;
}

export function persistActiveTemplate(
  ctx: ViewerAppContext,
  templateId: string,
): void {
  try {
    window.localStorage?.setItem(
      ACTIVE_TEMPLATE_STORAGE_KEY,
      JSON.stringify({ packId: getDraftPackId(ctx), templateId }),
    );
  } catch {}
}

export function getDraftPackId(ctx: ViewerAppContext): string {
  return String(ctx.state.pack?.packId ?? "local-pack");
}

export function handleDraftStorageError(
  ctx: ViewerAppContext,
  operation: string,
  error: unknown,
): void {
  ctx.state.editorDraft.status = "error";
  ctx.syncEditorWorkflowUi?.();
  ctx.logDiagnostic(
    `Local draft ${operation} failed: ${error instanceof Error ? error.message : String(error)}`,
    "error",
  );
}

export function handleEditorPageHide(ctx: ViewerAppContext): void {
  void ctx.flushEditorDraft();
}

export function handleEditorBeforeUnload(
  ctx: ViewerAppContext,
  event: BeforeUnloadEvent,
): void {
  ensureDraftRevisionTracksCurrentContent(ctx);
  if (
    ctx.state.editorDraft.persistedRevision >= ctx.state.editorDraft.revision
  ) {
    return;
  }
  event.preventDefault();
  event.returnValue = "";
}
