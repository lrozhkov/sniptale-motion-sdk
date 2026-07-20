import { collectAssetIssues } from "./asset-validation.js";
import { createValidationIssue } from "./issues.js";
import {
  collectClipBaseIssues,
  collectLayerIssues,
} from "./layer-validation.js";
import { collectPresetIssues } from "./preset-validation.js";
import { collectRendererContractIssues } from "./renderer-contract-validation.js";
import { isRangeInvalid } from "./ranges.js";
import {
  collectClipSceneIssues,
  collectPhaseIssues,
  collectSceneIssues,
  collectTrackIssues,
} from "./timeline-validation.js";
import type {
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
  template: any,
  options: EditorValidationOptions = {},
): boolean {
  return collectEditorValidationErrors(template, options).some((error) =>
    /range|duration|keyframe|phase|clip/i.test(error),
  );
}

export function collectEditorValidationErrors(
  template: any,
  options: EditorValidationOptions = {},
): string[] {
  return collectEditorValidationIssues(template, options).map(
    (issue) => issue.message,
  );
}

export function collectEditorValidationIssues(
  template: any,
  options: EditorValidationOptions = {},
): EditorValidationIssue[] {
  const knownAssetIds = options.knownAssetIds ?? options.assets ?? new Set();
  if (!template) {
    return [
      createValidationIssue("No template selected", {
        messageKey: "noTemplateSelected",
        targetType: "effect",
      }),
    ];
  }

  const issues: EditorValidationIssue[] = [];
  const addIssue = (message, target = {}) => {
    issues.push(createValidationIssue(message, target));
  };
  const duration = Number(template.duration);
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
