import type { ViewerAppContext } from "../app/context.js";

async function bindTemplateSourceJson(ctx: ViewerAppContext) {
  if (!ctx.state.currentTemplate || !window.showOpenFilePicker) {
    ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
      "viewer.status.fileSystemAccessUnavailable",
      "File System Access API unavailable; use Export JSON.",
    );
    ctx.logDiagnostic(
      "File binding unavailable in this browser. Use Export JSON.",
      "error",
    );
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          accept: { "application/json": [".json"] },
          description: "Template JSON",
        },
      ],
    });
    const text = await (await handle.getFile()).text();
    const parsed = JSON.parse(text);
    if (!ctx.validateBoundTemplateJson(parsed)) {
      return;
    }
    ctx.state.templateFileHandle = handle;
    ctx.refs.saveJsonButton.disabled = false;
    ctx.refs.timelineSaveStatus.textContent = `Bound ${handle.name}`;
    ctx.logDiagnostic(`Bound template source ${handle.name}.`, "ok");
  } catch (error) {
    ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
      "viewer.status.bindCanceledOrFailed",
      "Bind canceled or failed",
    );
    ctx.logDiagnostic(
      `Bind JSON failed: ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
  }
}

function validateBoundTemplateJson(ctx: ViewerAppContext, parsed) {
  if (
    !ctx.state.currentTemplate ||
    parsed?.id !== ctx.state.currentTemplate.id
  ) {
    ctx.logDiagnostic(
      `Bound JSON id ${parsed?.id ?? "(missing)"} does not match ${ctx.state.currentTemplate?.id ?? "(none)"}.`,
      "error",
    );
    ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
      "viewer.status.rejectedMismatchedJson",
      "Rejected mismatched JSON",
    );
    return false;
  }
  const errors = ctx.collectEditorValidationErrors(parsed);
  if (errors.length > 0) {
    ctx.logDiagnostic(`Bound JSON is invalid: ${errors[0]}`, "error");
    ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
      "viewer.status.rejectedInvalidJson",
      "Rejected invalid JSON",
    );
    ctx.refs.timelineSaveStatus.title = errors.join("\n");
    return false;
  }
  return true;
}

async function saveBoundTemplateJson(ctx: ViewerAppContext) {
  if (!ctx.state.currentTemplate || !ctx.state.templateFileHandle) {
    return;
  }
  if (!ctx.assertExportable("Save blocked")) {
    return;
  }
  try {
    const writable = await ctx.state.templateFileHandle.createWritable();
    await writable.write(ctx.buildCurrentTemplateJson());
    await writable.close();
    ctx.refs.timelineSaveStatus.textContent = `Saved ${ctx.state.templateFileHandle.name}`;
    ctx.logDiagnostic(`Saved ${ctx.state.templateFileHandle.name}.`, "ok");
  } catch (error) {
    ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
      "viewer.status.saveFailed",
      "Save failed",
    );
    ctx.logDiagnostic(
      `Save JSON failed: ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
  }
}

function exportCurrentTemplateJson(ctx: ViewerAppContext) {
  if (!ctx.state.currentTemplate) {
    return null;
  }
  if (!ctx.assertExportable("Export blocked")) {
    return null;
  }
  const json = ctx.buildCurrentTemplateJson();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${ctx.state.currentTemplate.id}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
    "viewer.status.exportedJsonDownload",
    "Exported JSON download",
  );
  return json;
}

function createUniqueTemplateId(ctx: ViewerAppContext, baseId) {
  const safeBase = ctx.sanitizeIdentifier(baseId || "imported-effect");
  let candidate = `${safeBase}-import`;
  let suffix = 2;
  while (ctx.state.templates.some((template) => template.id === candidate)) {
    candidate = `${safeBase}-import-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function buildCurrentTemplateJson(ctx: ViewerAppContext) {
  return ctx.deps.buildTemplateJson(
    ctx.getEffectiveTemplate(ctx.state.currentTemplate),
  );
}

export function wireEffectFileJsonBindingActions(ctx: ViewerAppContext): void {
  ctx.refs.bindJsonButton.addEventListener("click", () => {
    void ctx.bindTemplateSourceJson();
  });
  ctx.refs.saveJsonButton.addEventListener("click", () => {
    void ctx.saveBoundTemplateJson();
  });
  ctx.refs.exportJsonButton.addEventListener("click", () => {
    ctx.exportCurrentTemplateJson();
  });
}

export function installEffectFileJsonBindingOwner(ctx: ViewerAppContext): void {
  ctx.bindTemplateSourceJson = bindTemplateSourceJson.bind(undefined, ctx);
  ctx.validateBoundTemplateJson = validateBoundTemplateJson.bind(
    undefined,
    ctx,
  );
  ctx.saveBoundTemplateJson = saveBoundTemplateJson.bind(undefined, ctx);
  ctx.exportCurrentTemplateJson = exportCurrentTemplateJson.bind(
    undefined,
    ctx,
  );
  ctx.createUniqueTemplateId = createUniqueTemplateId.bind(undefined, ctx);
  ctx.buildCurrentTemplateJson = buildCurrentTemplateJson.bind(undefined, ctx);
  ctx.wireEffectFileJsonBindingActions = wireEffectFileJsonBindingActions.bind(
    undefined,
    ctx,
  );
}
