import type { EditorPreset, EditorTemplate } from "../templates/model.js";
import type { EditorTimelineSource } from "../editor/timeline-source.js";
import type { ViewerAppContext } from "../app/context.js";

export function createPresetRow(
  ctx: ViewerAppContext,
  {
    enabled,
    effectiveTemplate,
    preset,
    template,
  }: {
    enabled: boolean;
    effectiveTemplate: EditorTemplate;
    preset: EditorPreset;
    template: EditorTimelineSource;
  },
): HTMLElement {
  const selected = preset.id === ctx.state.selectedPresetId;
  const row = document.createElement("div");
  row.className = `preset-row${selected ? " selected" : ""}`;
  row.dataset.presetId = preset.id;

  const summary = document.createElement("button");
  summary.type = "button";
  summary.className = "preset-summary preset-select-button";
  summary.setAttribute("aria-pressed", String(selected));
  const title = document.createElement("strong");
  title.textContent = ctx.deps.translateText(preset.label, preset.id);
  const meta = document.createElement("span");
  meta.textContent = ctx.deps
    .t("viewer.presets.meta", "{duration}s · {tracks} tracks")
    .replace(
      "{duration}",
      (typeof preset.duration === "number" && Number.isFinite(preset.duration)
        ? preset.duration
        : effectiveTemplate.duration
      ).toFixed(1),
    )
    .replace("{tracks}", String(presetTrackCount(preset.timeline)));
  summary.append(title, meta);
  summary.title = `${title.textContent}\n${meta.textContent}`;
  summary.setAttribute(
    "aria-label",
    ctx.deps
      .t("viewer.presets.select", "Select preset {preset}")
      .replace("{preset}", title.textContent),
  );
  summary.addEventListener("click", () => {
    ctx.state.selectedPresetId = preset.id;
    ctx.renderPresetsPanel(template);
  });

  const applyButton = document.createElement("button");
  applyButton.type = "button";
  applyButton.textContent = ctx.deps.t("common.actions.apply", "Apply");
  applyButton.addEventListener("click", () => {
    void ctx.applyPreset(preset.id);
  });
  const duplicateButton = document.createElement("button");
  duplicateButton.type = "button";
  duplicateButton.textContent = ctx.deps.t("common.actions.copy", "Copy");
  duplicateButton.disabled = !enabled;
  duplicateButton.addEventListener("click", () => {
    ctx.duplicatePreset(preset.id);
  });
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "preset-delete-button";
  deleteButton.textContent = ctx.deps.t("viewer.presets.delete", "Delete");
  deleteButton.addEventListener("click", () => {
    ctx.deletePreset(preset.id);
  });
  row.append(summary, applyButton, duplicateButton, deleteButton);
  return row;
}

function presetTrackCount(value: unknown): number {
  if (value === null || typeof value !== "object" || !("tracks" in value))
    return 0;
  return Array.isArray(value.tracks) ? value.tracks.length : 0;
}
