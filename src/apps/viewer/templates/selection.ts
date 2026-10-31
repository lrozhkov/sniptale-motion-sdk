import { bindViewerAction } from "../app/bind-action.js";
import type { TemplateSelectionActions } from "./contract.js";
import type { EditorTemplateSource } from "./model.js";
import { beginEditorDraftSession } from "../editor/draft-session.js";
import { readEditorTemplateSource } from "./source.js";
import type { ViewerAppContext } from "../app/context.js";
import { shouldReportSandboxRequestFailure } from "../transport/sandbox-client.js";
import { resolveTemplateArtifactType } from "./artifact-type.js";
import {
  getTemplateBundleKindGroupLabel,
  getTemplateBundleKindLabel,
  resolveTemplateBundleKind,
  TEMPLATE_BUNDLE_KINDS,
} from "./bundle-kind.js";
import { resetTemplateSelectionState } from "./selection-state.js";
import { renderTemplateWorkspace } from "./workspace-render.js";

export function getInitialTemplateId(
  templates: readonly { id: string; default?: boolean; effectV1?: unknown }[],
): string | null {
  const explicitDefault = templates.find(
    (template) => template?.default === true,
  );
  const standalone = templates.find(
    (template) =>
      template.effectV1 !== null &&
      typeof template.effectV1 === "object" &&
      "kind" in template.effectV1 &&
      template.effectV1.kind === "standalone",
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
  ctx.populateTemplates(ctx.state.templates);
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

function getTemplateTypeLabel(
  ctx: ViewerAppContext,
  template: unknown,
): string {
  return getTemplateBundleKindLabel(ctx.deps.t, template);
}

function populateTemplates(
  ctx: ViewerAppContext,
  templates: readonly EditorTemplateSource[],
): void {
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

export async function selectTemplate(
  ctx: ViewerAppContext,
  templateId: string,
  options: {
    canSelect?: () => boolean;
    beforeReset?: () => void;
    restoreDraft?: boolean;
  } = {},
): Promise<boolean> {
  let template = ctx.state.templates.find((item) => item.id === templateId);
  if (!template) {
    return false;
  }
  const generation = (ctx.state.templateSelectionGeneration ?? 0) + 1;
  ctx.state.templateSelectionGeneration = generation;
  ctx.state.templateSelectionPending = true;
  try {
    ctx.state.pointerDragCleanup?.();
    if (ctx.state.currentTemplate) {
      ctx.captureCompositionWorkspaceView?.();
      await ctx.flushEditorDraft?.();
    }
    if (
      generation !== ctx.state.templateSelectionGeneration ||
      options.canSelect?.() === false
    )
      return false;
    options.beforeReset?.();
    template = ctx.state.templates.find((item) => item.id === templateId);
    if (!template) return false;
    const isCurrent = () =>
      generation === ctx.state.templateSelectionGeneration &&
      ctx.state.currentTemplate === template;
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
    if (options.restoreDraft === false) {
      ctx.state.historyPast = [];
      ctx.state.historyFuture = [];
      ctx.state.historyCoalescing = null;
      beginEditorDraftSession(ctx, template);
    } else await ctx.prepareEditorDraftForTemplate?.(template);
    if (!isCurrent()) return false;
    ctx.restoreCompositionWorkspaceView?.(template);
    ctx.refs.timelineZoomInput.value = String(ctx.state.timelineZoom);
    renderTemplateWorkspace(ctx, template);
    if (await ctx.prepareDomMotionTemplate?.(template)) return isCurrent();
    if (!isCurrent()) return false;
    ctx.refs.previewCacheButton.disabled = false;
    if (!(await ctx.ensureModuleLoaded(template.moduleId))) {
      return false;
    }
    if (!isCurrent()) return false;
    ctx.syncPlaybackButtons();
    await ctx.renderCurrentFrame({ forceFull: true });
    void ctx.refreshRendererContractCoverage(template).catch((error) => {
      if (shouldReportSandboxRequestFailure(error)) {
        ctx.logDiagnostic(
          `${templateId}: ${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      }
    });
    return isCurrent();
  } finally {
    if (generation === ctx.state.templateSelectionGeneration)
      ctx.state.templateSelectionPending = false;
  }
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

export function createTemplateSelectionActions(
  getContext: () => ViewerAppContext,
): TemplateSelectionActions {
  return {
    bootstrap: bindViewerAction(bootstrap, getContext),
    populateTemplates: bindViewerAction(populateTemplates, getContext),
    selectTemplate: bindViewerAction(selectTemplate, getContext),
    selectInitialTemplateWhenReady: bindViewerAction(
      selectInitialTemplateWhenReady,
      getContext,
    ),
  };
}
