import { bindViewerAction } from "../app/bind-action.js";
import type { PresetPanelActions } from "./contract.js";
import type { EditorPreset, EditorTemplate } from "../templates/model.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
import { readEditorTimeline } from "../editor/timeline-source.js";
import { readEditorTemplate } from "../templates/source.js";
import { readEditorPresets } from "../templates/source.js";
import type { ViewerAppContext } from "../app/context.js";
import { createPresetRow } from "./preset-row.js";

function renderPresetsPanel(
  ctx: ViewerAppContext,
  template: EditorTimelineSource | null = ctx.state.currentTemplate,
) {
  ctx.refs.presetsPanel.innerHTML = "";
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  if (!template || !effectiveTemplate) {
    updatePresetActionState(ctx, null);
    ctx.refs.presetsPanel.textContent = ctx.deps.t(
      "common.empty.presets",
      "No presets",
    );
    return;
  }
  const presets = readEditorPresets(effectiveTemplate.presets);
  if (
    ctx.state.selectedPresetId &&
    !presets.some((preset) => preset.id === ctx.state.selectedPresetId)
  ) {
    ctx.state.selectedPresetId = null;
  }
  updatePresetActionState(ctx, effectiveTemplate);
  if (presets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "presets-hint";
    empty.textContent = hasPresetParameters(effectiveTemplate)
      ? ctx.deps.t(
          "viewer.presets.empty",
          "Save current editor state as a reusable preset.",
        )
      : ctx.deps.t(
          "viewer.presets.unavailableWithoutControls",
          "Presets become available when the composition has adjustable parameters.",
        );
    ctx.refs.presetsPanel.append(empty);
    return;
  }
  const hint = document.createElement("div");
  hint.className = "presets-hint";
  hint.textContent = hasPresetParameters(effectiveTemplate)
    ? ctx.deps.t(
        "viewer.presets.hint",
        "Presets store controls, duration, layers, clips, and timeline.",
      )
    : ctx.deps.t(
        "viewer.presets.unavailableWithoutControls",
        "Presets become available when the composition has adjustable parameters.",
      );
  ctx.refs.presetsPanel.append(hint);
  for (const preset of presets) {
    ctx.refs.presetsPanel.append(
      createPresetRow(ctx, {
        effectiveTemplate,
        enabled: hasPresetParameters(effectiveTemplate),
        preset,
        template,
      }),
    );
  }
}

function hasPresetParameters(
  template: Pick<EditorTemplate, "controls"> | null,
) {
  return Array.isArray(template?.controls) && template.controls.length > 0;
}

function updatePresetActionState(
  ctx: ViewerAppContext,
  template: EditorTemplate | null,
) {
  const enabled = hasPresetParameters(template);
  const presets = readEditorPresets(template?.presets);
  const selected = presets.some(
    (preset) => preset.id === ctx.state.selectedPresetId,
  );
  const unavailable = ctx.deps.t(
    "viewer.presets.unavailableWithoutControls",
    "Presets become available when the composition has adjustable parameters.",
  );
  const selectToDuplicate = ctx.deps.t(
    "viewer.presets.selectToDuplicate",
    "Select a preset to duplicate it.",
  );
  ctx.refs.savePresetButton.disabled = !enabled;
  ctx.refs.savePresetButton.title = enabled ? "" : unavailable;
  ctx.refs.duplicatePresetButton.disabled = !enabled || !selected;
  ctx.refs.duplicatePresetButton.title = !enabled
    ? unavailable
    : selected
      ? ""
      : selectToDuplicate;
}

function formatPresetStatus(
  ctx: ViewerAppContext,
  key: string,
  fallback: string,
  preset: EditorPreset,
): string {
  return ctx.deps
    .t(key, fallback)
    .replace("{preset}", ctx.deps.translateText(preset.label, preset.id));
}

function saveCurrentAsPreset(ctx: ViewerAppContext) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  if (!template || !hasPresetParameters(template)) {
    return null;
  }
  const preset = ctx.createPresetFromTemplate(
    template,
    ctx.deps.createUniquePresetId(
      readEditorPresets(template.presets),
      "preset",
    ),
  );
  ctx.applyEditorCommand(
    { payload: { presetId: preset.id }, type: "savePreset" },
    () => {
      ctx.setPresets([...(template.presets ?? []), preset]);
      ctx.state.selectedPresetId = preset.id;
      const status = formatPresetStatus(
        ctx,
        "viewer.presets.saved",
        "Saved preset {preset}",
        preset,
      );
      ctx.refs.timelineSaveStatus.textContent = status;
      ctx.logDiagnostic(status, "ok");
      ctx.renderPresetsPanel(ctx.state.currentTemplate);
      ctx.updateExportAvailability();
    },
  );
  return preset;
}
function duplicateSelectedPreset(ctx: ViewerAppContext) {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const presetId = ctx.state.selectedPresetId;
  if (!template || !hasPresetParameters(template) || !presetId) {
    return null;
  }
  return ctx.duplicatePreset(presetId);
}
function duplicatePreset(
  ctx: ViewerAppContext,
  presetId: string,
): EditorPreset | null {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const presets = readEditorPresets(template?.presets);
  const source = presets.find((preset) => preset.id === presetId);
  if (!template || !hasPresetParameters(template) || !source) {
    return null;
  }
  const nextId = ctx.deps.createUniquePresetId(presets, `${source.id}-copy`);
  const duplicate = {
    ...ctx.deps.deepClone(source),
    id: nextId,
    label: ctx.deps.appendCopyLabel(source.label ?? { en: source.id }),
  };
  ctx.applyEditorCommand(
    {
      payload: { fromPresetId: presetId, presetId: nextId },
      type: "duplicatePreset",
    },
    () => {
      ctx.setPresets([...(template.presets ?? []), duplicate]);
      ctx.state.selectedPresetId = duplicate.id;
      const status = formatPresetStatus(
        ctx,
        "viewer.presets.duplicated",
        "Duplicated preset {preset}",
        duplicate,
      );
      ctx.refs.timelineSaveStatus.textContent = status;
      ctx.logDiagnostic(status, "ok");
      ctx.renderPresetsPanel(ctx.state.currentTemplate);
      ctx.updateExportAvailability();
    },
  );
  return duplicate;
}
function deletePreset(ctx: ViewerAppContext, presetId: string): boolean {
  const template = ctx.getEffectiveTemplate(ctx.state.currentTemplate);
  const presets = readEditorPresets(template?.presets);
  const preset = presets.find((item) => item.id === presetId);
  if (!template || !preset) {
    return false;
  }
  const remaining = presets.filter((item) => item.id !== presetId);
  ctx.applyEditorCommand(
    { payload: { presetId }, type: "deletePreset" },
    () => {
      ctx.setPresets(remaining);
      if (ctx.state.selectedPresetId === presetId) {
        ctx.state.selectedPresetId = null;
      }
      const status = formatPresetStatus(
        ctx,
        "viewer.presets.deleted",
        "Deleted preset {preset}",
        preset,
      );
      ctx.refs.timelineSaveStatus.textContent = status;
      ctx.logDiagnostic(status, "ok");
      ctx.renderPresetsPanel(ctx.state.currentTemplate);
      ctx.updateExportAvailability();
    },
  );
  return true;
}
async function applyPreset(
  ctx: ViewerAppContext,
  presetId: string,
): Promise<boolean> {
  const template = ctx.state.currentTemplate;
  const effectiveTemplate = ctx.getEffectiveTemplate(template);
  const preset = readEditorPresets(effectiveTemplate?.presets).find(
    (item) => item.id === presetId,
  );
  if (!template || !effectiveTemplate || !preset) {
    return false;
  }
  const duration = Object.hasOwn(preset, "duration")
    ? preset.duration
    : effectiveTemplate.duration;
  if (
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration <= 0
  )
    throw new Error("Invalid editor preset duration.");
  const timeline = readEditorTimeline(
    ctx.deps.deepClone(preset.timeline ?? effectiveTemplate.timeline),
    duration,
  );
  const next = readEditorTemplate(
    {
      ...effectiveTemplate,
      clips: ctx.deps.deepClone(preset.clips ?? effectiveTemplate.clips),
      duration,
      layers: ctx.deps.deepClone(preset.layers ?? effectiveTemplate.layers),
      scenes: ctx.deps.deepClone(preset.scenes ?? effectiveTemplate.scenes),
    },
    timeline,
  );
  const controls = ctx.deps.buildControlsWithDefaults(
    effectiveTemplate,
    preset.controls,
  );
  ctx.applyEditorCommand({ payload: { presetId }, type: "applyPreset" }, () => {
    ctx.state.controls = controls;
    ctx.setEditorOverride({
      clips: next.clips,
      duration,
      layers: next.layers,
      presets: ctx.deps.deepClone(effectiveTemplate.presets ?? []),
      scenes: next.scenes,
    });
    ctx.state.timelineOverrides.set(template.id, timeline);
    ctx.state.selectedPresetId = preset.id;
    ctx.clearTimelineSelection();
    ctx.refs.durationInput.value = String(duration);
    ctx.refs.timeSlider.max = String(duration);
    ctx.refs.timeSlider.value = String(
      ctx.deps.clamp(Number(ctx.refs.timeSlider.value) || 0, 0, duration),
    );
    ctx.refs.timeOutput.textContent = ctx.formatSeconds(
      ctx.refs.timeSlider.value,
    );
    const status = formatPresetStatus(
      ctx,
      "viewer.presets.applied",
      "Applied preset {preset}",
      preset,
    );
    ctx.refs.timelineSaveStatus.textContent = status;
    ctx.logDiagnostic(status, "ok");
    ctx.renderControls(template);
    ctx.renderTimelineEditor(template);
  });
  await ctx.renderCurrentFrame();
  return true;
}
function setPresets(ctx: ViewerAppContext, presets: unknown): void {
  ctx.setEditorOverride({ presets: ctx.deps.normalizePresets(presets) });
}

export function createPresetPanelActions(
  getContext: () => ViewerAppContext,
): PresetPanelActions {
  return {
    renderPresetsPanel: bindViewerAction(renderPresetsPanel, getContext),
    saveCurrentAsPreset: bindViewerAction(saveCurrentAsPreset, getContext),
    duplicateSelectedPreset: bindViewerAction(
      duplicateSelectedPreset,
      getContext,
    ),
    duplicatePreset: bindViewerAction(duplicatePreset, getContext),
    deletePreset: bindViewerAction(deletePreset, getContext),
    applyPreset: bindViewerAction(applyPreset, getContext),
    setPresets: bindViewerAction(setPresets, getContext),
  };
}
