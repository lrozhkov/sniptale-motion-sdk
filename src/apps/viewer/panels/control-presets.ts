import type { ViewerAppContext } from "../app/context.js";
import type { EditorTemplateSource } from "../templates/model.js";
import { readControlPresetOptions } from "./control-preset-model.js";
import { validateEffectV1Document } from "../../../sdk/effect-v1/validation.js";
import { applyEffectV1ControlPreset } from "../../../sdk/effect-v1/control-presets.js";

export function renderControlPresetSelector(
  ctx: ViewerAppContext,
  template: EditorTemplateSource,
): void {
  const presets = readControlPresetOptions(template.controlPresets);
  if (!presets.length || !template.effectV1) return;
  const row = document.createElement("label");
  row.className = "control-row";
  const label = document.createElement("span");
  label.className = "control-row-label";
  label.textContent = ctx.deps.t("viewer.controls.visualPreset");
  const select = document.createElement("select");
  select.dataset.visualPreset = "true";
  select.setAttribute("aria-label", label.textContent);
  const custom = document.createElement("option");
  custom.value = "";
  custom.textContent = ctx.deps.t("viewer.controls.customVisualPreset");
  select.append(custom);
  for (const preset of presets) {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = `${ctx.deps.translateText(preset.theme.label, preset.theme.id)} · ${ctx.deps.translateText(preset.label, preset.id)}`;
    select.append(option);
  }
  select.addEventListener("change", () => {
    if (!select.value) return;
    const validated = validateEffectV1Document(template.effectV1, {
      presentationPolicy: "retained",
    });
    if (!validated.ok || !validated.document) {
      ctx.logDiagnostic(
        validated.diagnostics
          .map((issue) => `${issue.code}: ${issue.path}`)
          .join("\n"),
        "error",
      );
      return;
    }
    const next = applyEffectV1ControlPreset(
      validated.document,
      ctx.state.controls,
      select.value,
    );
    ctx.beginEditorCommand({
      type: "updateControl",
      payload: { presetId: select.value },
    });
    ctx.state.controls = next;
    ctx.markEditorChanged?.("control-preset", { immediate: true });
    ctx.renderControls(template);
    void ctx.renderCurrentFrame();
  });
  row.append(label, select);
  ctx.refs.controlsPanel.append(row);
  syncControlPresetSelection(ctx, template);
}

export function syncControlPresetSelection(
  ctx: ViewerAppContext,
  template: EditorTemplateSource,
): void {
  const select = ctx.refs.controlsPanel.querySelector("[data-visual-preset]");
  if (select instanceof HTMLSelectElement)
    select.value =
      readControlPresetOptions(template.controlPresets).find((preset) =>
        Object.entries(preset.values).every(([id, value]) =>
          Object.is(ctx.state.controls[id], value),
        ),
      )?.id ?? "";
}
