import { bindViewerAction } from "../app/bind-action.js";
import { readPickedJsonHandle, readWritableFile } from "./file-system.js";
import type { JsonBindingActions } from "./contract.js";
import type { ViewerAppContext } from "../app/context.js";

export async function bindTemplateSourceJson(
  ctx: JsonBindContext,
): Promise<void> {
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
  const source = ctx.state.currentTemplate;
  const generation = ctx.state.templateSelectionGeneration;
  const isCurrent = () =>
    ctx.state.currentTemplate === source &&
    ctx.state.templateSelectionGeneration === generation;
  try {
    const picked: unknown = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          accept: { "application/json": [".json"] },
          description: ctx.deps.t(
            "viewer.status.templateJsonFile",
            "Template JSON",
          ),
        },
      ],
    });
    if (!isCurrent()) return;
    const handle = readPickedJsonHandle(picked);
    const file: unknown = await handle.getFile();
    if (!isCurrent()) return;
    if (!(file instanceof File)) throw new Error("Invalid picked file.");
    const text: unknown = await file.text();
    if (!isCurrent()) return;
    if (typeof text !== "string")
      throw new Error("Invalid picked file content.");
    const parsed: unknown = JSON.parse(text);
    if (!ctx.validateBoundTemplateJson(parsed)) {
      return;
    }
    ctx.state.templateFileHandle = handle;
    ctx.refs.saveJsonButton.disabled = false;
    ctx.refs.timelineSaveStatus.textContent = ctx.deps
      .t("viewer.status.sourceFileBound", "Bound {file}")
      .replace("{file}", handle.name);
    ctx.logDiagnostic(`Bound template source ${handle.name}.`, "ok");
  } catch (error) {
    if (!isCurrent()) return;
    ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
      "viewer.status.bindCanceledOrFailed",
      "Bind canceled or failed",
    );
    ctx.logDiagnostic(
      `Bind JSON failed: ${error instanceof Error ? error.message : "Unknown file error"}`,
      "error",
    );
  }
}

function validateBoundTemplateJson(
  ctx: ViewerAppContext,
  parsed: unknown,
): boolean {
  const id =
    parsed !== null &&
    typeof parsed === "object" &&
    "id" in parsed &&
    typeof parsed.id === "string"
      ? parsed.id
      : null;
  if (!ctx.state.currentTemplate || id !== ctx.state.currentTemplate.id) {
    ctx.logDiagnostic(
      `Bound JSON id ${id ?? "(missing)"} does not match ${ctx.state.currentTemplate?.id ?? "(none)"}.`,
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

export async function saveBoundTemplateJson(
  ctx: JsonSaveContext,
): Promise<void> {
  const source = ctx.state.currentTemplate;
  const handle = ctx.state.templateFileHandle;
  if (!source || !handle || !ctx.assertExportable("Save blocked")) return;
  const generation = ctx.state.templateSelectionGeneration;
  const isCurrent = () =>
    ctx.state.currentTemplate === source &&
    ctx.state.templateFileHandle === handle &&
    ctx.state.templateSelectionGeneration === generation;
  let writable: FileSystemWritableFileStream | null = null;
  try {
    const json = ctx.buildCurrentTemplateJson();
    const created: unknown = await handle.createWritable();
    writable = readWritableFile(created);
    if (!isCurrent()) {
      await writable.abort();
      return;
    }
    await writable.write(json);
    if (!isCurrent()) {
      await writable.abort();
      return;
    }
    await writable.close();
    writable = null;
    if (!isCurrent()) return;
    ctx.refs.timelineSaveStatus.textContent = ctx.deps
      .t("viewer.status.sourceFileSaved", "Saved {file}")
      .replace("{file}", handle.name);
    ctx.logDiagnostic(`Saved ${handle.name}.`, "ok");
  } catch (error) {
    if (writable) {
      try {
        await writable.abort();
      } catch {}
    }
    if (!isCurrent()) return;
    ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
      "viewer.status.saveFailed",
      "Save failed",
    );
    ctx.logDiagnostic(
      `Save JSON failed: ${error instanceof Error ? error.message : "Unknown file error"}`,
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

function createUniqueTemplateId(ctx: ViewerAppContext, baseId: string): string {
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

type JsonActionButton = {
  addEventListener(type: "click", handler: () => void): void;
};
type JsonActionContext = Pick<
  JsonBindingActions,
  | "bindTemplateSourceJson"
  | "saveBoundTemplateJson"
  | "exportCurrentTemplateJson"
> & {
  refs: {
    bindJsonButton: JsonActionButton;
    saveJsonButton: JsonActionButton;
    exportJsonButton: JsonActionButton;
  };
};

export function wireEffectFileJsonBindingActions(ctx: JsonActionContext): void {
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

export function createJsonBindingActions(
  getContext: () => ViewerAppContext,
): JsonBindingActions {
  return {
    bindTemplateSourceJson: bindViewerAction(
      bindTemplateSourceJson,
      getContext,
    ),
    validateBoundTemplateJson: bindViewerAction(
      validateBoundTemplateJson,
      getContext,
    ),
    saveBoundTemplateJson: bindViewerAction(saveBoundTemplateJson, getContext),
    exportCurrentTemplateJson: bindViewerAction(
      exportCurrentTemplateJson,
      getContext,
    ),
    createUniqueTemplateId: bindViewerAction(
      createUniqueTemplateId,
      getContext,
    ),
    buildCurrentTemplateJson: bindViewerAction(
      buildCurrentTemplateJson,
      getContext,
    ),
    wireEffectFileJsonBindingActions: bindViewerAction(
      wireEffectFileJsonBindingActions,
      getContext,
    ),
  };
}

type JsonBindingState = Pick<
  ViewerAppContext["state"],
  "currentTemplate" | "templateSelectionGeneration" | "templateFileHandle"
>;
type JsonBindingSupport = {
  state: JsonBindingState;
  refs: {
    timelineSaveStatus: { textContent: string | null; title: string };
    saveJsonButton: { disabled: boolean };
  };
  deps: { t(key: string, fallback?: string): string };
  logDiagnostic(message: string, level?: string): void;
};
type JsonBindContext = JsonBindingSupport & {
  validateBoundTemplateJson(parsed: unknown): boolean;
};
type JsonSaveContext = JsonBindingSupport & {
  assertExportable(prefix: string): boolean;
  buildCurrentTemplateJson(): string;
};
