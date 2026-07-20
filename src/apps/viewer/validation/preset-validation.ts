import { createValidationIssue } from "./issues.js";

export function collectPresetIssues(
  template,
  knownAssetIds,
  options,
  issues,
  collectEditorValidationIssues,
) {
  const presetIds = new Set<string>();
  for (const preset of template.presets ?? []) {
    if (!preset?.id) {
      issues.push(
        createValidationIssue("Preset is missing id", {
          messageKey: "presetMissingId",
          targetType: "preset",
        }),
      );
      continue;
    }
    if (presetIds.has(preset.id)) {
      issues.push(
        createValidationIssue(`Duplicate preset id "${preset.id}"`, {
          messageKey: "duplicatePresetId",
          messageParams: { id: preset.id },
          targetId: preset.id,
          targetType: "preset",
        }),
      );
    }
    presetIds.add(preset.id);
    const presetTemplate = {
      ...template,
      clips: Array.isArray(preset.clips) ? preset.clips : [],
      duration:
        Number(preset.duration ?? template.duration) ||
        Number(template.duration),
      layers: Array.isArray(preset.layers) ? preset.layers : [],
      presets: [],
      scenes: Array.isArray(preset.scenes) ? preset.scenes : [],
      timeline:
        preset.timeline && typeof preset.timeline === "object"
          ? preset.timeline
          : { phases: [], tracks: [] },
    };
    const presetIssues = collectEditorValidationIssues(presetTemplate, {
      ...options,
      knownAssetIds,
      validatePresets: false,
    });
    for (const issue of presetIssues) {
      issues.push({
        ...issue,
        message: `Preset "${preset.id}": ${issue.message}`,
        presetId: preset.id,
      });
    }
  }
}
