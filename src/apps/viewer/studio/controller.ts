import type { ViewerAppContext } from "../app/context.js";
import { getStudioSession } from "../effect-file/local-catalog.js";
import { STUDIO_SESSION_HEADER } from "../../../shared/studio/protocol.js";
import {
  isRecord,
  parseStudioEffectSelection,
  parseStudioRevision,
  STUDIO_REVISIONS_ROUTE,
  STUDIO_SELECTION_ROUTE,
} from "../../../shared/studio/revision-contract.js";

async function requestStudio(
  path: string,
  payload?: unknown,
): Promise<Record<string, unknown>> {
  const token = getStudioSession();
  if (!token) throw new Error("STUDIO_SESSION");
  const response = await fetch(path, {
    method: payload === undefined ? "GET" : "POST",
    cache: "no-store",
    mode: "same-origin",
    headers: {
      [STUDIO_SESSION_HEADER]: token,
      ...(payload === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const result: unknown = await response.json();
  if (!response.ok || !isRecord(result) || result.ok !== true)
    throw new Error(
      isRecord(result) &&
        typeof result.code === "string" &&
        /^[A-Z_]+$/.test(result.code)
        ? result.code
        : "STUDIO_RESPONSE",
    );
  return result;
}
function status(
  ctx: ViewerAppContext,
  key: string,
  fallback: string,
  suffix = "",
): void {
  ctx.refs.timelineSaveStatus.textContent = `${ctx.deps.t(key, fallback)}${suffix}`;
}
function failed(ctx: ViewerAppContext, error: unknown): void {
  const code =
    error instanceof Error && /^[A-Z_]+$/.test(error.message)
      ? error.message
      : "STUDIO_REQUEST";
  status(
    ctx,
    "viewer.studio.failed",
    "Project operation failed. Check saved revisions before retrying.",
    ` (${code})`,
  );
  ctx.logDiagnostic(
    `${ctx.deps.t("viewer.studio.failed", "Project operation failed.")} (${code})`,
    "error",
  );
}
async function saveRevision(ctx: ViewerAppContext): Promise<void> {
  const template = ctx.state.currentTemplate;
  const base = template ? ctx.state.studio.sources.get(template.id) : null;
  if (
    !template ||
    !base ||
    ctx.state.studio.busy ||
    !ctx.assertExportable("Revision save blocked")
  )
    return;
  ctx.state.studio.busy = true;
  syncStudioActions(ctx);
  try {
    const source: unknown = ctx.buildCurrentEffectFile();
    if (typeof source !== "string") throw new Error("DOCUMENT_INVALID");
    const result = await requestStudio(STUDIO_REVISIONS_ROUTE, {
      effectId: base.effectId,
      source,
      baseRevision: base.fingerprint,
    });
    const revision = parseStudioRevision(result.revision);
    if (
      !revision ||
      revision.effectId !== base.effectId ||
      typeof result.sourceChanged !== "boolean"
    )
      throw new Error("STUDIO_RESPONSE");
    ctx.state.studio.saved.set(template.id, revision);
    if (ctx.state.currentTemplate !== template) return;
    status(
      ctx,
      result.sourceChanged
        ? "viewer.studio.savedWithSourceChange"
        : "viewer.studio.saved",
      "Revision saved; the source file was not replaced.",
      ` ${revision.revisionId}`,
    );
  } catch (error) {
    if (ctx.state.currentTemplate === template) failed(ctx, error);
  } finally {
    ctx.state.studio.busy = false;
    syncStudioActions(ctx);
  }
}
async function openRevisions(ctx: ViewerAppContext): Promise<void> {
  const template = ctx.state.currentTemplate;
  const base = template ? ctx.state.studio.sources.get(template.id) : null;
  if (!template || !base || ctx.state.studio.busy) return;
  ctx.state.studio.busy = true;
  try {
    const result = await requestStudio(
      `${STUDIO_REVISIONS_ROUTE}?effectId=${encodeURIComponent(base.effectId)}`,
    );
    if (!Array.isArray(result.revisions)) throw new Error("STUDIO_RESPONSE");
    const values: unknown[] = result.revisions;
    const revisions = values.map(parseStudioRevision);
    if (
      revisions.some(
        (revision) => !revision || revision.effectId !== base.effectId,
      )
    )
      throw new Error("STUDIO_RESPONSE");
    if (ctx.state.currentTemplate !== template) return;
    const select = ctx.refs.studioRevisionSelect;
    select.replaceChildren();
    const source = document.createElement("option");
    source.value = "";
    source.textContent = ctx.deps.t("viewer.studio.source", "Source document");
    select.append(source);
    for (const revision of revisions) {
      if (!revision) continue;
      const option = document.createElement("option");
      option.value = revision.revisionId;
      option.textContent = `${revision.createdAt} · ${revision.revisionId}`;
      select.append(option);
    }
    select.value =
      ctx.state.studio.saved.get(template.id)?.revisionId ??
      base.revisionId ??
      "";
    ctx.refs.studioRevisionsDialog.dataset.templateId = template.id;
    ctx.refs.studioRevisionsDialog.showModal();
  } catch (error) {
    if (ctx.state.currentTemplate === template) failed(ctx, error);
  } finally {
    ctx.state.studio.busy = false;
  }
}
async function adoptRevision(ctx: ViewerAppContext): Promise<void> {
  const template = ctx.state.currentTemplate;
  const base = template ? ctx.state.studio.sources.get(template.id) : null;
  if (
    !template ||
    !base ||
    ctx.state.studio.busy ||
    ctx.refs.studioRevisionsDialog.dataset.templateId !== template.id
  )
    return;
  ctx.state.studio.busy = true;
  ctx.refs.adoptStudioRevisionButton.disabled = true;
  ctx.refs.closeStudioRevisionsButton.disabled = true;
  try {
    const revisionId = ctx.refs.studioRevisionSelect.value || null;
    const result = await requestStudio(STUDIO_SELECTION_ROUTE, {
      effectId: base.effectId,
      revisionId,
    });
    const selection = parseStudioEffectSelection(result.selection);
    if (
      !selection ||
      selection.effectId !== base.effectId ||
      selection.revisionId !== revisionId
    )
      throw new Error("STUDIO_RESPONSE");
    if (ctx.state.currentTemplate !== template) return;
    ctx.refs.studioRevisionsDialog.close();
    status(
      ctx,
      "viewer.studio.adopted",
      "Selection saved for the next opening. Current editor changes were retained.",
    );
  } catch (error) {
    if (ctx.state.currentTemplate === template) failed(ctx, error);
  } finally {
    ctx.state.studio.busy = false;
    ctx.refs.adoptStudioRevisionButton.disabled = false;
    ctx.refs.closeStudioRevisionsButton.disabled = false;
  }
}
export function syncStudioActions(ctx: ViewerAppContext): void {
  if (!getStudioSession()) return;
  const id = ctx.state.currentTemplate?.id;
  const enabled =
    !!id && ctx.state.studio.sources.has(id) && !ctx.state.studio.busy;
  ctx.refs.saveStudioRevisionButton.disabled = !enabled;
  ctx.refs.openStudioRevisionsButton.disabled = !enabled;
}

export function installViewerStudioOwner(ctx: ViewerAppContext): void {
  const available = getStudioSession() !== null;
  if (!available) return;
  ctx.refs.saveStudioRevisionButton.hidden = false;
  ctx.refs.openStudioRevisionsButton.hidden = false;
  syncStudioActions(ctx);
  ctx.refs.studioRevisionsDialog.addEventListener("cancel", (event) => {
    if (ctx.state.studio.busy) event.preventDefault();
  });
  ctx.refs.saveStudioRevisionButton.addEventListener(
    "click",
    () => void saveRevision(ctx),
  );
  ctx.refs.openStudioRevisionsButton.addEventListener(
    "click",
    () => void openRevisions(ctx),
  );
  ctx.refs.adoptStudioRevisionButton.addEventListener(
    "click",
    () => void adoptRevision(ctx),
  );
  ctx.refs.closeStudioRevisionsButton.addEventListener("click", () =>
    ctx.refs.studioRevisionsDialog.close(),
  );
}
