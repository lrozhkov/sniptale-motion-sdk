import { hasKnownIdentifier } from "./validation-shared.js";
import { isUnknownArray } from "./validation-shared.js";
import type { EffectV1ValidationErrorReport } from "./diagnostics.js";
import {
  isRecord,
  rejectUnknownKeys,
  requireIdentifier,
  validateRange,
} from "./validation-shared.js";
import { validateEffectV1MotionPaths } from "./motion-path-validation.js";

const PHASE_KEYS = new Set([
  "duration",
  "enabled",
  "id",
  "label",
  "locked",
  "sceneId",
  "start",
]);
const TRACK_KEYS = new Set([
  "enabled",
  "id",
  "keyframes",
  "label",
  "layerId",
  "phaseId",
  "property",
  "sceneId",
  "target",
]);
const KEYFRAME_KEYS = new Set([
  "easing",
  "enabled",
  "handles",
  "id",
  "phaseId",
  "sceneId",
  "time",
  "value",
]);
const HANDLE_KEYS = new Set(["x1", "x2", "y1", "y2"]);

export function validateEffectV1Timeline(
  value: unknown,
  layers: Map<string, Record<string, unknown>>,
  scenes: Map<string, Record<string, unknown>>,
  duration: number,
  report: EffectV1ValidationErrorReport,
): Set<string> {
  if (!isRecord(value)) {
    report.error("TIMELINE_TYPE", "$.timeline", "Expected a timeline object.");
    return new Set();
  }
  rejectUnknownKeys(
    value,
    new Set(["motionPaths", "phases", "tracks"]),
    "$.timeline",
    report,
  );
  const phaseIds = validatePhases(value.phases, scenes, duration, report);
  const trackIds = validateTracks(
    value.tracks,
    layers,
    scenes,
    phaseIds,
    duration,
    report,
  );
  validateEffectV1MotionPaths(value.motionPaths, value.tracks, layers, report);
  return trackIds;
}

function validatePhases(
  value: unknown,
  scenes: Map<string, Record<string, unknown>>,
  duration: number,
  report: EffectV1ValidationErrorReport,
): Set<string> {
  const ids = new Set<string>();
  if (!isUnknownArray(value)) {
    report.error("PHASES_TYPE", "$.timeline.phases", "Expected a phase array.");
    return ids;
  }
  value.forEach((phase, index) => {
    const path = `$.timeline.phases[${index}]`;
    if (!isRecord(phase)) {
      report.error("PHASE_TYPE", path, "Expected a phase object.");
      return;
    }
    rejectUnknownKeys(phase, PHASE_KEYS, path, report);
    if (requireIdentifier(phase.id, `${path}.id`, report)) {
      if (ids.has(phase.id)) {
        report.error("PHASE_ID_DUPLICATE", `${path}.id`, "Duplicate phase id.");
      }
      ids.add(phase.id);
    }
    if (
      phase.sceneId !== undefined &&
      !hasKnownIdentifier(phase.sceneId, scenes)
    ) {
      report.error("PHASE_SCENE_UNKNOWN", `${path}.sceneId`, "Unknown scene.");
    }
    validateRange(phase.start, phase.duration, duration, path, report);
    validateOptionalBoolean(phase.enabled, `${path}.enabled`, report);
    validateOptionalBoolean(phase.locked, `${path}.locked`, report);
  });
  return ids;
}

function validateTracks(
  value: unknown,
  layers: Map<string, Record<string, unknown>>,
  scenes: Map<string, Record<string, unknown>>,
  phaseIds: Set<string>,
  duration: number,
  report: EffectV1ValidationErrorReport,
): Set<string> {
  const ids = new Set<string>();
  if (!isUnknownArray(value)) {
    report.error("TRACKS_TYPE", "$.timeline.tracks", "Expected a track array.");
    return ids;
  }
  value.forEach((track, index) => {
    const path = `$.timeline.tracks[${index}]`;
    if (!isRecord(track)) {
      report.error("TRACK_TYPE", path, "Expected a track object.");
      return;
    }
    rejectUnknownKeys(track, TRACK_KEYS, path, report);
    if (requireIdentifier(track.id, `${path}.id`, report)) {
      if (ids.has(track.id)) {
        report.error("TRACK_ID_DUPLICATE", `${path}.id`, "Duplicate track id.");
      }
      ids.add(track.id);
    }
    for (const field of ["layerId", "target"] as const) {
      const layerId = track[field];
      if (layerId === undefined) continue;
      const layer = hasKnownIdentifier(layerId, layers)
        ? layers.get(layerId)
        : undefined;
      if (!layer) {
        report.error(
          "TRACK_LAYER_UNKNOWN",
          `${path}.${field}`,
          "Unknown layer target.",
        );
      } else if (layer.type === "group") {
        report.error(
          "GROUP_TRACK_FORBIDDEN",
          `${path}.${field}`,
          "Structural groups cannot own animation tracks.",
        );
      }
    }
    if (
      track.sceneId !== undefined &&
      !hasKnownIdentifier(track.sceneId, scenes)
    ) {
      report.error("TRACK_SCENE_UNKNOWN", `${path}.sceneId`, "Unknown scene.");
    }
    if (
      track.phaseId !== undefined &&
      !hasKnownIdentifier(track.phaseId, phaseIds)
    ) {
      report.error("TRACK_PHASE_UNKNOWN", `${path}.phaseId`, "Unknown phase.");
    }
    validateKeyframes(
      track.keyframes,
      path,
      scenes,
      phaseIds,
      duration,
      report,
    );
    validateOptionalBoolean(track.enabled, `${path}.enabled`, report);
  });
  return ids;
}

function validateKeyframes(
  value: unknown,
  trackPath: string,
  scenes: Map<string, Record<string, unknown>>,
  phaseIds: Set<string>,
  duration: number,
  report: EffectV1ValidationErrorReport,
): void {
  if (!isUnknownArray(value)) {
    report.error(
      "KEYFRAMES_TYPE",
      `${trackPath}.keyframes`,
      "Expected keyframes.",
    );
    return;
  }
  let previousTime = -Infinity;
  value.forEach((keyframe, index) => {
    const path = `${trackPath}.keyframes[${index}]`;
    if (!isRecord(keyframe)) {
      report.error("KEYFRAME_TYPE", path, "Expected a keyframe object.");
      return;
    }
    rejectUnknownKeys(keyframe, KEYFRAME_KEYS, path, report);
    requireIdentifier(keyframe.id, `${path}.id`, report);
    const time = keyframe.time;
    if (
      typeof time !== "number" ||
      !Number.isFinite(time) ||
      time < 0 ||
      time > duration
    ) {
      report.error(
        "KEYFRAME_TIME",
        `${path}.time`,
        "Keyframe time must be inside the effect duration.",
      );
    }
    if (typeof time === "number" && time < previousTime) {
      report.error(
        "KEYFRAME_ORDER",
        `${path}.time`,
        "Keyframes must be sorted by ascending time.",
        "Sort keyframes; v1 never silently reorders author data.",
      );
    }
    if (typeof time === "number" && Number.isFinite(time)) previousTime = time;
    if (
      keyframe.sceneId !== undefined &&
      !hasKnownIdentifier(keyframe.sceneId, scenes)
    ) {
      report.error(
        "KEYFRAME_SCENE_UNKNOWN",
        `${path}.sceneId`,
        "Unknown scene.",
      );
    }
    if (
      keyframe.phaseId !== undefined &&
      !hasKnownIdentifier(keyframe.phaseId, phaseIds)
    ) {
      report.error(
        "KEYFRAME_PHASE_UNKNOWN",
        `${path}.phaseId`,
        "Unknown phase.",
      );
    }
    validateOptionalBoolean(keyframe.enabled, `${path}.enabled`, report);
    validateHandles(keyframe.handles, `${path}.handles`, report);
  });
}

function validateHandles(
  value: unknown,
  path: string,
  report: EffectV1ValidationErrorReport,
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    report.error("KEYFRAME_HANDLES", path, "Expected a bezier handle object.");
    return;
  }
  rejectUnknownKeys(value, HANDLE_KEYS, path, report);
  for (const key of HANDLE_KEYS) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
      report.error(
        "KEYFRAME_HANDLE_NUMBER",
        `${path}.${key}`,
        "Expected a finite number.",
      );
    }
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
