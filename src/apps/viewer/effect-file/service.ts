import type { ViewerAppContext } from "../app/context.js";
import { isEffectV1ExportableTemplate } from "./builder.js";

function sanitizeIdentifier(ctx: ViewerAppContext, value) {
  return (
    String(value)
      .trim()
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "imported-effect"
  );
}
function appendImportedLabel(ctx: ViewerAppContext, label) {
  // Import provenance belongs to UI state, not portable display metadata.
  return label && typeof label === "object" ? { ...label } : {};
}
function assertExportable(ctx: ViewerAppContext, prefix) {
  if (
    ctx.isRendererContractCoveragePending?.(ctx.state.currentTemplate) === true
  ) {
    const message = ctx.deps.t(
      "viewer.status.rendererContractCheckPending",
      "Waiting for renderer contract check.",
    );
    ctx.refs.timelineSaveStatus.textContent = message;
    ctx.updateExportAvailability(null, { preserveStatus: true });
    return false;
  }
  const errors = ctx.collectEditorValidationErrors(
    ctx.getEffectiveTemplate(ctx.state.currentTemplate),
  );
  if (errors.length === 0) {
    return true;
  }
  const message = `${prefix}: ${errors[0]}`;
  ctx.refs.timelineSaveStatus.textContent = message;
  ctx.logDiagnostic(message, "error");
  ctx.updateExportAvailability(errors, { preserveStatus: true });
  return false;
}
function updateExportAvailability(
  ctx: ViewerAppContext,
  existingErrors = null,
  options: any = {},
) {
  if (!ctx.state.currentTemplate) {
    ctx.refs.exportJsonButton.disabled = true;
    ctx.refs.exportEffectFileButton.disabled = true;
    ctx.refs.exportMp4Button.disabled = true;
    ctx.refs.saveJsonButton.disabled = true;
    return;
  }
  if (ctx.state.currentTemplate.domMotion) {
    ctx.refs.exportJsonButton.disabled = true;
    ctx.refs.exportEffectFileButton.disabled = false;
    ctx.refs.exportMp4Button.disabled = true;
    ctx.refs.exportMp4Button.title = ctx.deps.t(
      "viewer.domMotion.exportUnavailable",
      "Live HTML scenes do not support Canvas video export",
    );
    ctx.refs.saveJsonButton.disabled = true;
    return;
  }
  ctx.refs.exportMp4Button.title = "";
  const previousValidation = ctx.refs.timelineSaveStatus.dataset.validation;
  const contractCheckPending =
    ctx.isRendererContractCoveragePending?.(ctx.state.currentTemplate) === true;
  if (contractCheckPending) {
    const message = ctx.deps.t(
      "viewer.status.rendererContractCheckPending",
      "Waiting for renderer contract check.",
    );
    ctx.refs.exportJsonButton.disabled = true;
    ctx.refs.exportEffectFileButton.disabled = true;
    ctx.refs.exportMp4Button.disabled = true;
    ctx.refs.saveJsonButton.disabled = true;
    ctx.refs.timelineSaveStatus.dataset.validation = "pending";
    ctx.refs.timelineSaveStatus.title = message;
    if (!options.preserveStatus) {
      ctx.refs.timelineSaveStatus.textContent = message;
    }
    return;
  }
  const errors =
    existingErrors ??
    ctx.collectEditorValidationErrors(
      ctx.getEffectiveTemplate(ctx.state.currentTemplate),
    );
  const invalid = errors.length > 0;
  ctx.refs.exportJsonButton.disabled = invalid;
  ctx.refs.exportEffectFileButton.disabled =
    invalid || !isEffectV1ExportableTemplate(ctx.state.currentTemplate);
  ctx.refs.exportMp4Button.disabled = invalid;
  ctx.refs.saveJsonButton.disabled = invalid || !ctx.state.templateFileHandle;
  ctx.refs.timelineSaveStatus.dataset.validation = invalid
    ? "invalid"
    : "valid";
  if (invalid) {
    ctx.refs.timelineSaveStatus.title = errors.join("\n");
    if (!options.preserveStatus) {
      ctx.refs.timelineSaveStatus.textContent = ctx.deps
        .t("viewer.status.validationIssueCount", "Validation issues: {count}")
        .replace("{count}", String(errors.length));
    }
  } else {
    ctx.refs.timelineSaveStatus.title = ctx.deps.t(
      "viewer.status.currentJsonValidForExport",
      "Current effect JSON is valid for export.",
    );
    if (previousValidation === "invalid" || previousValidation === "pending") {
      ctx.refs.timelineSaveStatus.textContent = ctx.state.templateFileHandle
        ? ctx.deps
            .t("viewer.status.sourceFileBound", "Bound {file}")
            .replace("{file}", ctx.state.templateFileHandle.name)
        : ctx.deps.t("viewer.status.noFileBound", "No source file open");
    }
  }
}

export function installEffectFileServiceOwner(ctx: ViewerAppContext): void {
  ctx.sanitizeIdentifier = (...args: any[]) =>
    (sanitizeIdentifier as any)(ctx, ...args);
  ctx.appendImportedLabel = (...args: any[]) =>
    (appendImportedLabel as any)(ctx, ...args);
  ctx.assertExportable = (...args: any[]) =>
    (assertExportable as any)(ctx, ...args);
  ctx.updateExportAvailability = (...args: any[]) =>
    (updateExportAvailability as any)(ctx, ...args);
}
