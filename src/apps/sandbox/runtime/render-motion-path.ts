import type { RuntimeTimeline } from "./render-normalization.js";
import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { MotionPathTrack } from "../../../shared/timeline/motion-path.js";
import {
  createMotionPathGeometry,
  evaluateMotionPathGeometry,
  getMotionPathLayerProperty,
  type MotionPathGeometryResult,
} from "../../../shared/timeline/motion-path.js";

const geometryCache = new WeakMap<
  object,
  Map<string, MotionPathGeometryResult>
>();

export function resolveRuntimeMotionPathTrackValue(
  timeline: RuntimeTimeline,
  track: MotionPathTrack,
  time: number,
): number | null {
  const owner = getMotionPathLayerProperty(track);
  if (!owner || !timeline?.motionPaths) {
    return null;
  }
  let byLayer = geometryCache.get(timeline);
  if (!byLayer) {
    byLayer = new Map();
    geometryCache.set(timeline, byLayer);
  }
  let geometry = byLayer.get(owner.layerId);
  if (!geometry) {
    geometry = createMotionPathGeometry(timeline, owner.layerId, {
      getTrackKeyframes: (candidate) =>
        isRuntimeTrackEnabled(timeline, candidate)
          ? (candidate.keyframes ?? []).filter((keyframe) =>
              isRuntimeKeyframeEnabled(timeline, keyframe),
            )
          : [],
    });
    byLayer.set(owner.layerId, geometry);
  }
  if (!geometry.ok) {
    return null;
  }
  const position = evaluateMotionPathGeometry(geometry, time);
  return position ? position[owner.property] : null;
}

function isRuntimeTrackEnabled(
  timeline: RuntimeTimeline,
  track: MotionPathTrack,
): boolean {
  return (
    track?.enabled !== false &&
    isRuntimeSceneEnabled(timeline, track?.sceneId) &&
    isRuntimePhaseEnabled(timeline, track?.phaseId)
  );
}

function isRuntimeKeyframeEnabled(
  timeline: RuntimeTimeline,
  keyframe: TimelineKeyframe<unknown>,
): boolean {
  return (
    keyframe?.enabled !== false &&
    isRuntimeSceneEnabled(timeline, keyframe?.sceneId) &&
    isRuntimePhaseEnabled(timeline, keyframe?.phaseId)
  );
}

function isRuntimePhaseEnabled(
  timeline: RuntimeTimeline,
  phaseId?: string | null,
): boolean {
  if (!phaseId) {
    return true;
  }
  const phase = timeline?.phases?.find((entry) => entry.id === phaseId);
  return Boolean(
    phase &&
    phase.enabled !== false &&
    isRuntimeSceneEnabled(timeline, phase.sceneId),
  );
}

function isRuntimeSceneEnabled(
  timeline: RuntimeTimeline,
  sceneId?: string | null,
): boolean {
  if (!sceneId) {
    return true;
  }
  const scene = timeline?.scenes?.find((entry) => entry.id === sceneId);
  return !scene || scene.enabled !== false;
}
