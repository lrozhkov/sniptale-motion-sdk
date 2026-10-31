import { readEditorTemplateSource } from "./source.js";
import type { ViewerAppContext } from "../app/context.js";
import { shouldReportSandboxRequestFailure } from "../transport/sandbox-client.js";
import {
  getTemplateArtifactTypeDescription,
  getTemplateArtifactTypeLabel,
  resolveTemplateArtifactType,
} from "./artifact-type.js";
import {
  getTemplateBundleKindDescription,
  getTemplateBundleKindGroupLabel,
  getTemplateBundleKindLabel,
  resolveTemplateBundleKind,
  TEMPLATE_BUNDLE_KINDS,
} from "./bundle-kind.js";
import { resetTemplateSelectionState } from "./selection-state.js";
import { renderTemplateWorkspace } from "./workspace-render.js";

export function getInitialTemplateId(templates: any[]): string | null {
  const explicitDefault = templates.find(
    (template) => template?.default === true,
  );
  const standalone = templates.find(
    (template) => template?.effectV1?.kind === "standalone",
  );
  return explicitDefault?.id ?? standalone?.id ?? templates[0]?.id ?? null;
}

async function bootstrap(ctx: ViewerAppContext) {
  ctx.applyPreviewRasterSize();
  ctx.deps.drawSampleScene(ctx.previewContext, {
    height: ctx.refs.canvas.height,
    phase: "base",
    progress: 0,
    width: ctx.refs.canvas.width,
  });
  if (await ctx.bootstrapDomMotion?.()) return;
  if (await ctx.bootstrapLocalEffects()) {
    return;
  }
  const loaded = await ctx.deps.loadDemoPack();
  if (loaded.errors.length > 0) {
    ctx.setPackStatus(
      ctx.deps.t("viewer.status.packValidationFailed", "Validation failed"),
      "failed",
    );
    loaded.errors.forEach((error) =>
      ctx.logDiagnostic(`${error.path}: ${error.message}`, "error"),
    );
    return;
  }
  ctx.state.pack = loaded.pack;
  ctx.state.templates = loaded.templates.map(readEditorTemplateSource);
  ctx.state.modules = loaded.modules;
  ctx.state.assets = loaded.assets;
  ctx.state.baseAssets = new Map(loaded.assets);
  ctx.populateTemplates(loaded.templates);
  if (loaded.templates.length === 0) {
    const readyForImport = ctx.deps.t(
      "viewer.status.readyForImport",
      "Ready to import an effect package",
    );
    ctx.setPackStatus(readyForImport, "ready");
    ctx.logDiagnostic(readyForImport, "ok");
    return;
  }
  if (!loaded.pack) throw new Error("Loaded templates require pack metadata.");
  ctx.setPackStatus(
    ctx.deps
      .t("viewer.status.loadedPack", "Loaded {pack}")
      .replace("{pack}", loaded.pack.packId),
    "ready",
  );
  ctx.logDiagnostic(
    `Loaded ${loaded.templates.length} templates, ${loaded.modules.size} modules, and ${loaded.assets.size} assets.`,
    "ok",
  );
  void ctx.selectInitialTemplateWhenReady();
}

function getTemplateTypeLabel(ctx: ViewerAppContext, template) {
  return getTemplateBundleKindLabel(ctx.deps.t, template);
}

function populateTemplates(ctx: ViewerAppContext, templates) {
  const selectedId =
    ctx.state.currentTemplate?.id || ctx.refs.templateSelect.value;
  ctx.refs.templateSelect.innerHTML = "";
  if (templates.length === 0) {
    const option = document.createElement("option");
    option.disabled = true;
    option.selected = true;
    option.textContent = ctx.deps.t(
      "viewer.templates.importPrompt",
      "Import an effect package",
    );
    ctx.refs.templateSelect.append(option);
    ctx.syncTemplateCombobox();
    return;
  }
  const groups = new Map(
    TEMPLATE_BUNDLE_KINDS.map((bundleKind) => {
      const group = document.createElement("optgroup");
      const artifactType =
        bundleKind === "transition" ? "transition" : "animation";
      group.dataset.artifactType = artifactType;
      group.dataset.bundleKind = bundleKind;
      group.label = getTemplateBundleKindGroupLabel(ctx.deps.t, bundleKind);
      return [bundleKind, group];
    }),
  );
  for (const template of templates) {
    const artifactType = resolveTemplateArtifactType(template);
    const bundleKind = resolveTemplateBundleKind(template);
    const option = document.createElement("option");
    option.value = template.id;
    option.textContent = ctx.deps.translateText(template.label, template.id);
    option.dataset.artifactType = artifactType;
    option.dataset.bundleKind = bundleKind;
    option.title = `${getTemplateTypeLabel(ctx, template)} · ${template.id}`;
    groups.get(bundleKind)?.append(option);
  }
  for (const group of groups.values()) {
    if (group.children.length > 0) {
      ctx.refs.templateSelect.append(group);
    }
  }
  if (selectedId && templates.some((template) => template.id === selectedId)) {
    ctx.refs.templateSelect.value = selectedId;
  }
  ctx.syncTemplateCombobox();
}

async function selectTemplate(ctx: ViewerAppContext, templateId) {
  const template = ctx.state.templates.find((item) => item.id === templateId);
  if (!template) {
    return;
  }
  if (ctx.state.currentTemplate) {
    ctx.captureCompositionWorkspaceView?.();
    await ctx.flushEditorDraft?.();
  }
  ctx.stopPreviewAudio?.();
  resetTemplateSelectionState(ctx, template);
  ctx.state.assets = new Map(ctx.state.baseAssets);
  ctx.state.editorOverrides.delete(template.id);
  ctx.state.timelineOverrides.delete(template.id);
  ctx.syncPreviewQualityBadge(1);
  ctx.refs.saveJsonButton.disabled = true;
  ctx.refs.timelineSaveStatus.textContent = ctx.deps.t(
    "viewer.status.noFileBound",
    "No file bound",
  );
  ctx.refs.templateSelect.value = template.id;
  ctx.refs.templateSelect.title = `${ctx.deps.translateText(template.label, template.id)}\n${getTemplateTypeLabel(ctx, template)} · ${template.id}`;
  ctx.syncTemplateCombobox();
  ctx.updateTemplateContext(template);
  ctx.syncPreviewMediaUi?.(template);
  const duration = ctx.getEffectiveDuration(template);
  ctx.refs.durationInput.value = String(duration);
  ctx.refs.timeSlider.max = String(duration);
  ctx.refs.timeSlider.value = "0";
  if (ctx.refs.fullscreenTimeSlider) {
    ctx.refs.fullscreenTimeSlider.max = String(duration);
    ctx.refs.fullscreenTimeSlider.value = "0";
  }
  ctx.refs.timeOutput.textContent = ctx.deps.t(
    "viewer.time.zeroSeconds",
    "0.000s",
  );
  if (ctx.refs.fullscreenTimeOutput) {
    ctx.refs.fullscreenTimeOutput.textContent = ctx.deps.t(
      "viewer.time.zeroSeconds",
      "0.000s",
    );
  }
  ctx.state.controls = ctx.deps.buildControlsWithDefaults(template);
  await ctx.prepareEditorDraftForTemplate?.(template);
  ctx.restoreCompositionWorkspaceView?.(template);
  ctx.refs.timelineZoomInput.value = String(ctx.state.timelineZoom);
  renderTemplateWorkspace(ctx, template);
  if (await ctx.prepareDomMotionTemplate?.(template)) return;
  ctx.refs.previewCacheButton.disabled = false;
  if (!(await ctx.ensureModuleLoaded(template.moduleId))) {
    return;
  }
  ctx.syncPlaybackButtons();
  await ctx.renderCurrentFrame({ forceFull: true });
  void ctx.refreshRendererContractCoverage(template).catch((error) => {
    if (shouldReportSandboxRequestFailure(error)) {
      ctx.logDiagnostic(
        `${template.id}: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  });
}

function updateTemplateContext(
  ctx: ViewerAppContext,
  template = ctx.state.currentTemplate,
) {
  if (!template) {
    ctx.refs.templateContext.textContent = "";
    ctx.refs.templateContext.title = "";
    return;
  }
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const layers = effectiveTemplate?.layers?.length ?? 0;
  const tracks = effectiveTemplate?.timeline?.tracks?.length ?? 0;
  const duration = ctx.formatSeconds(
    effectiveTemplate?.duration ?? template.duration ?? 0,
  );
  const summary = ctx.deps
    .t(
      "viewer.templates.summary",
      "{layers} layers · {tracks} tracks · {duration}",
    )
    .replace("{layers}", String(layers))
    .replace("{tracks}", String(tracks))
    .replace("{duration}", duration);
  ctx.refs.templateContext.textContent = "";
  const artifactType = resolveTemplateArtifactType(effectiveTemplate);
  const bundleKind = resolveTemplateBundleKind(effectiveTemplate);
  const artifactLabel = getTemplateArtifactTypeLabel(
    ctx.deps.t,
    effectiveTemplate,
  );
  const typeLabel = getTemplateTypeLabel(ctx, effectiveTemplate);
  const type = document.createElement("strong");
  type.className = "template-artifact-type";
  type.dataset.artifactType = artifactType;
  type.dataset.bundleKind = bundleKind;
  type.dataset.compactLabel = artifactLabel;
  type.setAttribute("aria-label", typeLabel);
  type.textContent = typeLabel;
  const details = document.createElement("span");
  details.className = "template-context-summary";
  details.textContent = summary;
  ctx.refs.templateContext.append(type, details);
  ctx.refs.templateContext.hidden = false;
  ctx.refs.templateContext.title = `${ctx.deps.translateText(template.label, template.id)}\n${getTemplateBundleKindLabel(ctx.deps.t, effectiveTemplate)}: ${getTemplateBundleKindDescription(ctx.deps.t, effectiveTemplate)}\n${summary}`;
}

async function selectInitialTemplateWhenReady(ctx: ViewerAppContext) {
  if (
    !ctx.state.sandboxReady ||
    ctx.state.currentTemplate ||
    ctx.state.templates.length === 0
  ) {
    return;
  }
  const templateId =
    (ctx.state.templates.some(
      (template) => template.id === ctx.state.startupTemplateId,
    )
      ? ctx.state.startupTemplateId
      : null) ??
    ctx.getPreferredDraftTemplateId?.(ctx.state.templates) ??
    getInitialTemplateId(ctx.state.templates);
  if (templateId) {
    await ctx.selectTemplate(templateId);
  }
}

export function installTemplatesSelectionOwner(ctx: ViewerAppContext): void {
  ctx.bootstrap = bootstrap.bind(undefined, ctx);
  ctx.populateTemplates = populateTemplates.bind(undefined, ctx);
  ctx.selectTemplate = selectTemplate.bind(undefined, ctx);
  ctx.updateTemplateContext = updateTemplateContext.bind(undefined, ctx);
  ctx.selectInitialTemplateWhenReady = selectInitialTemplateWhenReady.bind(
    undefined,
    ctx,
  );
}
