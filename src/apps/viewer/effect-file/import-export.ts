import { DOM_MOTION_SCHEMA } from "../../../sdk/dom-motion/model.js";
import type { ViewerAppContext } from "../app/context.js";
import { isEffectV1ExportableTemplate } from "./builder.js";
import { remapImportedAssetIdentity } from "./import-asset-identity.js";
import { remapImportedEffectIdentity } from "./import-identity.js";
import {
  materializeEffectImportFiles,
  verifyMaterializedEffectImportSource,
} from "./import-materialization.js";

function exportCurrentEffectFile(ctx: ViewerAppContext) {
  if (!ctx.state.currentTemplate) {
    return null;
  }
  if (ctx.state.currentTemplate.domMotion) return ctx.exportDomMotionSource();
  if (!isEffectV1ExportableTemplate(ctx.state.currentTemplate)) {
    const message = ctx.deps.t(
      "viewer.status.effectDocumentNotExportable",
      "This effect cannot be exported because it is not a strict Effect v1 graph document.",
    );
    ctx.refs.timelineSaveStatus.textContent = message;
    ctx.refs.timelineSaveStatus.title = message;
    ctx.logDiagnostic(message, "error");
    return null;
  }
  if (!ctx.assertExportable("Effect file export blocked")) {
    return null;
  }
  const source = ctx.buildCurrentEffectFile();
  const validation = ctx.validateCurrentEffectFileSource(source);
  if (!validation.ok) {
    const message = `Effect file export blocked: ${validation.errors[0]}`;
    ctx.refs.timelineSaveStatus.textContent = message;
    ctx.refs.timelineSaveStatus.title = validation.errors.join("\n");
    ctx.logDiagnostic(message, "error");
    return null;
  }
  const blob = new Blob([source], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${ctx.state.currentTemplate.id}.sniptale-effect.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
    "viewer.status.exportedEffectFile",
    "Exported effect file",
  );
  return source;
}

async function importSelectedEffectFile(ctx: ViewerAppContext) {
  const files = Array.from(ctx.refs.effectFileInput.files ?? []) as File[];
  ctx.refs.effectFileInput.value = "";
  if (files.length === 0) {
    return;
  }
  try {
    if (
      files.length === 1 &&
      files[0].name.endsWith(".sniptale-dom-motion.json")
    ) {
      await ctx.importDomMotionSource(JSON.parse(await files[0].text()));
      return;
    }
    const prepared = await materializeEffectImportFiles(files);
    await ctx.importEffectFileSource(prepared.source, prepared.sourceName);
  } catch (error) {
    const message = `Import failed: ${error instanceof Error ? error.message : String(error)}`;
    ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
      "viewer.status.importFailed",
      "Import failed",
    );
    ctx.logDiagnostic(message, "error");
  }
}

async function importEffectFileSource(
  ctx: ViewerAppContext,
  source,
  sourceName = "imported.sniptale-effect.json",
  options: any = {},
) {
  try {
    const value: unknown =
      typeof source === "string" ? JSON.parse(source) : source;
    if (
      value &&
      typeof value === "object" &&
      "schemaVersion" in value &&
      value.schemaVersion === DOM_MOTION_SCHEMA
    )
      return await ctx.importDomMotionSource(value, options.select !== false);
  } catch (error) {
    if (typeof source === "string" && source.includes(DOM_MOTION_SCHEMA))
      return { ok: false, errors: [String(error)], templateId: null };
  }
  let verifiedSource: string;
  try {
    verifiedSource = await verifyMaterializedEffectImportSource(source);
  } catch (error) {
    const errors = [error instanceof Error ? error.message : String(error)];
    ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
      "viewer.status.rejectedEffectFile",
      "Rejected effect file",
    );
    ctx.refs.timelineSaveStatus.title = errors.join("\n");
    ctx.logDiagnostic(`Rejected effect file: ${errors[0]}`, "error");
    return { errors, ok: false, templateId: null };
  }
  const validation = ctx.validateCurrentEffectFileSource(verifiedSource);
  if (!validation.ok || !validation.payload) {
    const message = `Rejected effect file: ${validation.errors[0] ?? "unknown validation error"}`;
    ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
      "viewer.status.rejectedEffectFile",
      "Rejected effect file",
    );
    ctx.refs.timelineSaveStatus.title = validation.errors.join("\n");
    ctx.logDiagnostic(message, "error");
    return { errors: validation.errors, ok: false, templateId: null };
  }
  const originalPayload = validation.payload;
  const originalTemplateId = originalPayload.id;
  const preferredTemplateId = ctx.sanitizeIdentifier(originalTemplateId);
  const uniqueTemplateId =
    options.preferOriginalId === true &&
    !ctx.state.templates.some((template) => template.id === preferredTemplateId)
      ? preferredTemplateId
      : ctx.createUniqueTemplateId(originalTemplateId);
  const payload = remapImportedAssetIdentity(
    originalPayload,
    ctx.state.baseAssets.keys(),
    uniqueTemplateId,
  );
  const normalizedEffectFile = ctx.deps.normalizeEffectFilePayload(
    payload,
    [],
    {
      normalizePresets: ctx.deps.normalizePresets,
      normalizeScenes: ctx.normalizeScenes,
    },
  );
  const importedTemplate = ctx.deps.deepClone(normalizedEffectFile.template);
  const moduleId = ctx.createUniqueModuleId(`${uniqueTemplateId}-document`);
  const remapped = remapImportedEffectIdentity(
    importedTemplate,
    normalizedEffectFile.document,
    uniqueTemplateId,
    moduleId,
  );
  Object.assign(importedTemplate, remapped.template);
  if (options.appendImportedLabel !== false) {
    importedTemplate.label = ctx.appendImportedLabel(importedTemplate.label);
  }
  const importedDocument = remapped.document;
  const importedAssets = ctx.prepareImportedAssets(
    normalizedEffectFile.assets ?? [],
  );
  await ctx.verifyImportedAssets(importedAssets);
  await preflightImportedDocument(ctx, importedDocument);
  const previous = captureImportState(ctx);
  try {
    ctx.state.assets = mergeMaps(ctx.state.assets, importedAssets);
    ctx.state.baseAssets = mergeMaps(ctx.state.baseAssets, importedAssets);
    ctx.state.modules = new Map(ctx.state.modules).set(moduleId, {
      document: importedDocument,
      id: moduleId,
      path: sourceName,
    });
    ctx.state.templates = [...ctx.state.templates, importedTemplate];
    ctx.populateTemplates(ctx.state.templates);
    ctx.logDiagnostic(`Imported ${sourceName} as ${uniqueTemplateId}.`, "ok");
    ctx.refs.timelineSaveStatus.textContent = `Imported ${sourceName}`;
    ctx.refs.timelineSaveStatus.title = `Original template id: ${originalTemplateId}`;
    if (options.select !== false) {
      await ctx.selectTemplate(uniqueTemplateId);
    }
  } catch (error) {
    restoreImportState(ctx, previous);
    throw error;
  }
  return { errors: [], ok: true, templateId: uniqueTemplateId };
}

async function preflightImportedDocument(
  ctx: ViewerAppContext,
  document: unknown,
): Promise<void> {
  if (!ctx.state.sandboxReady) return;
  const result = await ctx.requestSandbox(
    {
      document,
      kind: "validateEffectDocument",
      requestId: ctx.deps.createRequestId("import-preflight"),
    },
    ctx.deps.DEFAULT_LOAD_TIMEOUT_MS,
  );
  if (!result.ok) {
    throw new Error(result.error ?? "Sandbox rejected the Effect document.");
  }
}

function captureImportState(ctx: ViewerAppContext) {
  return {
    assets: ctx.state.assets,
    baseAssets: ctx.state.baseAssets,
    modules: ctx.state.modules,
    templates: ctx.state.templates,
  };
}

function restoreImportState(ctx: ViewerAppContext, previous: any): void {
  ctx.state.assets = previous.assets;
  ctx.state.baseAssets = previous.baseAssets;
  ctx.state.modules = previous.modules;
  ctx.state.templates = previous.templates;
  ctx.populateTemplates(ctx.state.templates);
}

function mergeMaps<T>(
  base: Map<string, T>,
  added: Map<string, T>,
): Map<string, T> {
  return new Map([...base, ...added]);
}

function validateCurrentEffectFileSource(ctx: ViewerAppContext, source) {
  return ctx.deps.validateSniptaleEffectFileSource(source, {
    collectTemplateErrors: (template, knownAssetIds) =>
      ctx.collectEditorValidationErrors(template, knownAssetIds, {
        rendererCoverage: null,
      }),
    existingAssetIds: ctx.state.assets.keys(),
    isSafeSvgAssetText: ctx.deps.isSafeSvgAssetText,
    normalizePresets: ctx.deps.normalizePresets,
    normalizeScenes: ctx.normalizeScenes,
  });
}

function buildCurrentEffectFile(ctx: ViewerAppContext) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const module = ctx.state.modules.get(template?.moduleId);
  return ctx.deps.buildEffectFileSource({
    assets: ctx.state.assets,
    controlValues: ctx.state.controls,
    module,
    template,
  });
}

export function installEffectFileImportExportOwner(
  ctx: ViewerAppContext,
): void {
  ctx.exportCurrentEffectFile = (...args: any[]) =>
    (exportCurrentEffectFile as any)(ctx, ...args);
  ctx.importSelectedEffectFile = (...args: any[]) =>
    (importSelectedEffectFile as any)(ctx, ...args);
  ctx.importEffectFileSource = (...args: any[]) =>
    (importEffectFileSource as any)(ctx, ...args);
  ctx.validateCurrentEffectFileSource = (...args: any[]) =>
    (validateCurrentEffectFileSource as any)(ctx, ...args);
  ctx.buildCurrentEffectFile = (...args: any[]) =>
    (buildCurrentEffectFile as any)(ctx, ...args);
}
