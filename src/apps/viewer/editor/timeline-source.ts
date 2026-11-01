import {
  optional,
  finite,
  isString,
  isBoolean,
  nullableString,
  isList,
  isRecord,
} from "../../../shared/validation/values.js";
import type {
  TimelineKeyframe,
  TimelineMotionPath,
  TimelinePhase,
} from "../../../sdk/types.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import type { EditorTimeline } from "./model-types.js";

export type EditorTimelineSource = {
  id: string;
  timeline?: unknown;
};

/** Read a cloned timeline without normalizing timing, ordering or extensions. */
export function readEditorTimeline(
  value: unknown,
  duration: number,
): EditorTimeline {
  if (!isRecord(value) || !Number.isFinite(duration))
    throw new Error("Invalid editor timeline.");
  const phases: unknown = value.phases ?? [];
  const tracks: unknown = value.tracks ?? [];
  const motionPaths = readMotionPaths(value.motionPaths);
  if (
    !isList(phases) ||
    !phases.every(isPhase) ||
    !isList(tracks) ||
    !tracks.every(isTrack)
  ) {
    throw new Error("Invalid editor timeline structure.");
  }
  return {
    ...value,
    duration,
    phases,
    tracks,
    ...(motionPaths !== undefined ? { motionPaths } : {}),
  };
}

function isPhase(value: unknown): value is TimelinePhase {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    finite(value.start) &&
    finite(value.duration) &&
    optional(value, "label", isString) &&
    optional(value, "locked", isBoolean) &&
    optional(value, "enabled", isBoolean) &&
    optional(value, "sceneId", nullableString)
  );
}

function isTrack(value: unknown): value is MotionPathTrack {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isList(value.keyframes) &&
    value.keyframes.every(isKeyframe) &&
    optional(value, "enabled", isBoolean) &&
    optional(value, "label", isString) &&
    optional(value, "layerId", nullableString) &&
    optional(value, "phaseId", nullableString) &&
    optional(value, "sceneId", nullableString) &&
    optional(value, "property", isString) &&
    optional(value, "target", isString)
  );
}

function isKeyframe(value: unknown): value is TimelineKeyframe<unknown> {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Object.hasOwn(value, "value") &&
    finite(value.time) &&
    optional(value, "easing", isString) &&
    optional(value, "enabled", isBoolean) &&
    optional(value, "phaseId", nullableString) &&
    optional(value, "sceneId", nullableString) &&
    optional(value, "handles", isHandles)
  );
}

function readMotionPaths(value: unknown): TimelineMotionPath[] | undefined {
  if (value === undefined) return undefined;
  if (!isList(value) || !value.every(isMotionPath))
    throw new Error("Invalid editor motion paths.");
  return value;
}

function isMotionPath(value: unknown): value is TimelineMotionPath {
  return (
    isRecord(value) &&
    typeof value.layerId === "string" &&
    isList(value.points) &&
    value.points.every(
      (point) =>
        isRecord(point) &&
        typeof point.xKeyframeId === "string" &&
        typeof point.yKeyframeId === "string" &&
        optional(point, "inTangent", isPoint) &&
        optional(point, "outTangent", isPoint) &&
        optional(
          point,
          "kind",
          (kind) => kind === "corner" || kind === "linear" || kind === "smooth",
        ),
    )
  );
}

function isPoint(value: unknown): boolean {
  return isRecord(value) && finite(value.x) && finite(value.y);
}

function isHandles(value: unknown): boolean {
  return (
    isRecord(value) && [value.x1, value.x2, value.y1, value.y2].every(finite)
  );
}
