import { collectAssetIssues } from "./asset-validation.js";
import { createValidationIssue } from "./issues.js";
import {
  collectClipBaseIssues,
  collectLayerIssues,
} from "./layer-validation.js";
import { collectPresetIssues } from "./preset-validation.js";
import { collectRendererContractIssues } from "./renderer-contract-validation.js";
import { readValidationTemplate } from "./input.js";
import {
  collectClipSceneIssues,
  collectPhaseIssues,
  collectSceneIssues,
  collectTrackIssues,
} from "./timeline-validation.js";
import type {
  AddValidationIssue,
  EditorValidationIssue,
  EditorValidationOptions,
} from "./types.js";

export { categorizeValidationIssue, createValidationIssue } from "./issues.js";
export { isRangeInvalid } from "./ranges.js";
export type {
  EditorValidationIssue,
  EditorValidationOptions,
} from "./types.js";

export function hasInvalidTiming(
  template: unknown,
  options: EditorValidationOptions = {},
): boolean {
  return collectEditorValidationErrors(template, options).some((error) =>
    /range|duration|keyframe|phase|clip/i.test(error),
  );
}

export function collectEditorValidationErrors(
  template: unknown,
  options: EditorValidationOptions = {},
): string[] {
  return collectEditorValidationIssues(template, options).map(
    (issue) => issue.message,
  );
}

export function collectEditorValidationIssues(
  value: unknown,
  options: EditorValidationOptions = {},
): EditorValidationIssue[] {
  const knownAssetIds = options.knownAssetIds ?? options.assets ?? new Set();
  if (value === null || value === undefined) {
    return [
      createValidationIssue("No template selected", {
        messageKey: "noTemplateSelected",
        targetType: "effect",
      }),
    ];
  }

  const { template, errorPath } = readValidationTemplate(value);
  if (!template) {
    return [
      createValidationIssue(`Invalid editor document field at ${errorPath}`, {
        category: "Schema",
        messageKey: "invalidEditorStructure",
        messageParams: { path: errorPath },
        targetType: "effect",
      }),
    ];
  }

  const issues: EditorValidationIssue[] = [];
  const addIssue: AddValidationIssue = (message, target = {}) => {
    issues.push(createValidationIssue(message, target));
  };
  const duration = template.duration ?? NaN;
  if (!Number.isFinite(duration) || duration <= 0) {
    addIssue("Effect duration must be a positive number", {
      messageKey: "effectDurationPositive",
      targetType: "effect",
    });
  }

  const layerIds = collectLayerIssues(template, knownAssetIds, addIssue);
  collectClipBaseIssues(template, duration, layerIds, addIssue);
  const { sceneIds, scenesById } = collectSceneIssues(
    template,
    duration,
    addIssue,
  );
  collectClipSceneIssues(template, sceneIds, scenesById, addIssue);
  const phaseIds = collectPhaseIssues(
    template,
    duration,
    sceneIds,
    scenesById,
    addIssue,
  );
  collectTrackIssues({
    addIssue,
    duration,
    layerIds,
    phaseIds,
    sceneIds,
    scenesById,
    template,
  });

  collectAssetIssues(template, knownAssetIds, options, addIssue);
  collectRendererContractIssues(template, options.rendererCoverage, addIssue);
  if (options.validatePresets !== false) {
    collectPresetIssues(
      template,
      knownAssetIds,
      options,
      issues,
      collectEditorValidationIssues,
    );
  }

  return issues;
}
