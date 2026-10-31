import { isValidationRecord } from "./input.js";
import type { ValidationTemplate } from "./input.js";
import type {
  EditorValidationIssue,
  EditorValidationOptions,
  KnownValidationAssets,
} from "./types.js";
import { createValidationIssue } from "./issues.js";

export function collectPresetIssues(
  template: ValidationTemplate,
  knownAssetIds: KnownValidationAssets,
  options: EditorValidationOptions,
  issues: EditorValidationIssue[],
  collectEditorValidationIssues: (
    template: unknown,
    options: EditorValidationOptions,
  ) => EditorValidationIssue[],
) {
  const presetIds = new Set<string>();
  for (const preset of template.presets ?? []) {
    if (
      !isValidationRecord(preset) ||
      typeof preset.id !== "string" ||
      !preset.id
    ) {
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
      clips: preset.clips === undefined ? [] : preset.clips,
      duration:
        preset.duration === undefined ? template.duration : preset.duration,
      layers: preset.layers === undefined ? [] : preset.layers,
      presets: [],
      scenes: preset.scenes === undefined ? [] : preset.scenes,
      timeline:
        preset.timeline === undefined
          ? { phases: [], tracks: [] }
          : preset.timeline,
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
