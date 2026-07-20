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
  "defaultValue",
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
  report: any,
): Map<string, any> {
  const scenes = new Map<string, any>();
  if (!Array.isArray(value) || value.length === 0) {
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
  });
  return scenes;
}

export function validateEffectV1Clips(
  value: unknown,
  layers: Map<string, any>,
  scenes: Map<string, any>,
  duration: number,
  report: any,
): void {
  if (!Array.isArray(value)) {
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
    const layer = layers.get(String(clip.layerId));
    if (!layer) {
      report.error(
        "CLIP_LAYER_UNKNOWN",
        `${path}.layerId`,
        `Unknown layer "${String(clip.layerId)}".`,
      );
    } else if (layer.type === "group") {
      report.error(
        "GROUP_CLIP_FORBIDDEN",
        `${path}.layerId`,
        "Structural groups cannot own clips.",
      );
    }
    if (clippedLayers.has(String(clip.layerId))) {
      report.error(
        "CLIP_LAYER_DUPLICATE",
        `${path}.layerId`,
        "A v1 layer owns at most one clip.",
      );
    }
    clippedLayers.add(String(clip.layerId));
    if (clip.sceneId != null && !scenes.has(String(clip.sceneId))) {
      report.error(
        "CLIP_SCENE_UNKNOWN",
        `${path}.sceneId`,
        `Unknown scene "${String(clip.sceneId)}".`,
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
  report: any,
): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(value)) {
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
    if (!["color", "number", "text"].includes(String(control.kind))) {
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
  });
  return ids;
}

function validateControlValue(
  control: Record<string, any>,
  path: string,
  report: any,
): void {
  if (control.kind === "number") {
    for (const key of ["defaultValue", "max", "min", "step"]) {
      if (
        (key === "defaultValue" || control[key] !== undefined) &&
        (typeof control[key] !== "number" || !Number.isFinite(control[key]))
      ) {
        report.error(
          "CONTROL_NUMBER",
          `${path}.${key}`,
          "Expected a finite number.",
        );
      }
    }
    if (
      Number.isFinite(control.min) &&
      Number.isFinite(control.max) &&
      control.min >= control.max
    ) {
      report.error(
        "CONTROL_RANGE",
        path,
        "Control min must be lower than max so the parameter can change.",
      );
    }
    if (Number.isFinite(control.step) && control.step <= 0) {
      report.error(
        "CONTROL_STEP",
        `${path}.step`,
        "Control step must be greater than zero.",
      );
    }
    if (
      Number.isFinite(control.defaultValue) &&
      ((Number.isFinite(control.min) && control.defaultValue < control.min) ||
        (Number.isFinite(control.max) && control.defaultValue > control.max))
    ) {
      report.error(
        "CONTROL_DEFAULT_RANGE",
        `${path}.defaultValue`,
        "Control defaultValue must be inside its min/max range.",
      );
    }
  } else if (
    ["color", "text"].includes(String(control.kind)) &&
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
  report: any,
): void {
  if (value !== undefined && typeof value !== "boolean") {
    report.error("BOOLEAN", path, "Expected a boolean.");
  }
}
