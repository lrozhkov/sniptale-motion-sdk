import { formatEffectV1DiagnosticValue } from "./diagnostics.js";
import { hasKnownIdentifier } from "./validation-shared.js";
import { isFiniteNumber } from "./validation-shared.js";
import { isUnknownArray } from "./validation-shared.js";
import type {
  EffectV1ValidationReport,
  EffectV1ValidationErrorReport,
} from "./diagnostics.js";
import { validateControlPresentation } from "./control-presentation.js";
import {
  isRecord,
  rejectUnknownKeys,
  requireIdentifier,
  validateLocaleText,
  validateRange,
} from "./validation-shared.js";

const SCENE_KEYS = new Set([
  "duration",
  "enabled",
  "id",
  "label",
  "locked",
  "start",
  "transition",
]);
const CLIP_KEYS = new Set([
  "duration",
  "enabled",
  "layerId",
  "locked",
  "offset",
  "sceneId",
  "start",
]);
const CONTROL_KEYS = new Set([
  "unit",
  "presentation",
  "icon",
  "group",
  "order",
  "options",
  "defaultValue",
  "localizedDefaultValue",
  "id",
  "kind",
  "label",
  "max",
  "min",
  "step",
]);

export function validateEffectV1Scenes(
  value: unknown,
  duration: number,
  report: EffectV1ValidationErrorReport,
): Map<string, Record<string, unknown>> {
  const scenes = new Map<string, Record<string, unknown>>();
  if (!isUnknownArray(value) || value.length === 0) {
    report.error(
      "SCENES_REQUIRED",
      "$.scenes",
      "Expected at least one scene.",
      "Use one scene spanning the full duration for a single-scene effect.",
    );
    return scenes;
  }
  value.forEach((scene, index) => {
    const path = `$.scenes[${index}]`;
    if (!isRecord(scene)) {
      report.error("SCENE_TYPE", path, "Expected a scene object.");
      return;
    }
    rejectUnknownKeys(scene, SCENE_KEYS, path, report);
    if (requireIdentifier(scene.id, `${path}.id`, report)) {
      if (scenes.has(scene.id)) {
        report.error("SCENE_ID_DUPLICATE", `${path}.id`, "Duplicate scene id.");
      }
      scenes.set(scene.id, scene);
    }
    validateRange(scene.start, scene.duration, duration, path, report);
    validateOptionalBoolean(scene.enabled, `${path}.enabled`, report);
    validateOptionalBoolean(scene.locked, `${path}.locked`, report);
    if (scene.label !== undefined && typeof scene.label !== "string")
      validateLocaleText(scene.label, `${path}.label`, false, report);
    if (scene.transition !== undefined && !isRecord(scene.transition))
      report.error(
        "SCENE_TRANSITION",
        `${path}.transition`,
        "Expected a transition object.",
      );
  });
  return scenes;
}

export function validateEffectV1Clips(
  value: unknown,
  layers: Map<string, Record<string, unknown>>,
  scenes: Map<string, Record<string, unknown>>,
  duration: number,
  report: EffectV1ValidationErrorReport,
): void {
  if (!isUnknownArray(value)) {
    report.error("CLIPS_TYPE", "$.clips", "Expected a clip array.");
    return;
  }
  const clippedLayers = new Set<string>();
  value.forEach((clip, index) => {
    const path = `$.clips[${index}]`;
    if (!isRecord(clip)) {
      report.error("CLIP_TYPE", path, "Expected a clip object.");
      return;
    }
    rejectUnknownKeys(clip, CLIP_KEYS, path, report);
    const layer = hasKnownIdentifier(clip.layerId, layers)
      ? layers.get(clip.layerId)
      : undefined;
    if (!layer) {
      report.error(
        "CLIP_LAYER_UNKNOWN",
        `${path}.layerId`,
        `Unknown layer "${formatEffectV1DiagnosticValue(clip.layerId)}".`,
      );
    } else if (layer.type === "group") {
      report.error(
        "GROUP_CLIP_FORBIDDEN",
        `${path}.layerId`,
        "Structural groups cannot own clips.",
      );
    }
    if (typeof clip.layerId === "string" && clippedLayers.has(clip.layerId)) {
      report.error(
        "CLIP_LAYER_DUPLICATE",
        `${path}.layerId`,
        "A v1 layer owns at most one clip.",
      );
    }
    if (typeof clip.layerId === "string") clippedLayers.add(clip.layerId);
    if (
      clip.sceneId !== undefined &&
      !hasKnownIdentifier(clip.sceneId, scenes)
    ) {
      report.error(
        "CLIP_SCENE_UNKNOWN",
        `${path}.sceneId`,
        `Unknown scene "${formatEffectV1DiagnosticValue(clip.sceneId)}".`,
      );
    }
    validateRange(clip.start, clip.duration, duration, path, report);
    validateOptionalBoolean(clip.enabled, `${path}.enabled`, report);
    validateOptionalBoolean(clip.locked, `${path}.locked`, report);
    if (
      clip.offset !== undefined &&
      (typeof clip.offset !== "number" || !Number.isFinite(clip.offset))
    ) {
      report.error(
        "CLIP_OFFSET",
        `${path}.offset`,
        "Expected a finite number.",
      );
    }
  });
}

export function validateEffectV1Controls(
  value: unknown,
  report: EffectV1ValidationReport,
  controlGroups?: unknown,
): Set<string> {
  const ids = new Set<string>();
  if (!isUnknownArray(value)) {
    report.error("CONTROLS_TYPE", "$.controls", "Expected a control array.");
    return ids;
  }
  value.forEach((control, index) => {
    const path = `$.controls[${index}]`;
    if (!isRecord(control)) {
      report.error("CONTROL_TYPE", path, "Expected a control object.");
      return;
    }
    rejectUnknownKeys(control, CONTROL_KEYS, path, report);
    if (requireIdentifier(control.id, `${path}.id`, report)) {
      if (ids.has(control.id)) {
        report.error(
          "CONTROL_ID_DUPLICATE",
          `${path}.id`,
          "Duplicate control id.",
        );
      }
      ids.add(control.id);
    }
    if (
      typeof control.kind !== "string" ||
      !["color", "number", "text"].includes(control.kind)
    ) {
      report.error(
        "CONTROL_KIND",
        `${path}.kind`,
        "Expected color, number, or text.",
      );
    }
    if (control.label !== undefined) {
      validateLocaleText(control.label, `${path}.label`, false, report);
    }
    validateControlValue(control, path, report);
    validateControlPresentation(control, path, report, controlGroups);
  });
  return ids;
}

function validateControlValue(
  control: Record<string, unknown>,
  path: string,
  report: EffectV1ValidationErrorReport,
): void {
  for (const key of ["defaultValue", "max", "min", "step"]) {
    const required = key === "defaultValue" && control.kind === "number";
    const optional = key !== "defaultValue" && control[key] !== undefined;
    if ((required || optional) && !isFiniteNumber(control[key])) {
      report.error(
        "CONTROL_NUMBER",
        `${path}.${key}`,
        "Expected a finite number.",
      );
    }
  }
  if (
    control.kind === "number" &&
    isFiniteNumber(control.min) &&
    isFiniteNumber(control.max) &&
    control.min >= control.max
  ) {
    report.error(
      "CONTROL_RANGE",
      path,
      "Control min must be lower than max so the parameter can change.",
    );
  }
  if (isFiniteNumber(control.step) && control.step <= 0) {
    report.error(
      "CONTROL_STEP",
      `${path}.step`,
      "Control step must be greater than zero.",
    );
  }
  if (control.kind === "number") {
    if (
      isFiniteNumber(control.defaultValue) &&
      ((isFiniteNumber(control.min) && control.defaultValue < control.min) ||
        (isFiniteNumber(control.max) && control.defaultValue > control.max))
    ) {
      report.error(
        "CONTROL_DEFAULT_RANGE",
        `${path}.defaultValue`,
        "Control defaultValue must be inside its min/max range.",
      );
    }
  } else if (
    (control.kind === "color" || control.kind === "text") &&
    typeof control.defaultValue !== "string"
  ) {
    report.error(
      "CONTROL_STRING",
      `${path}.defaultValue`,
      "Expected a string default value.",
    );
  }
}

function validateOptionalBoolean(
  value: unknown,
  path: string,
  report: EffectV1ValidationErrorReport,
): void {
  if (value !== undefined && typeof value !== "boolean") {
    report.error("BOOLEAN", path, "Expected a boolean.");
  }
}
