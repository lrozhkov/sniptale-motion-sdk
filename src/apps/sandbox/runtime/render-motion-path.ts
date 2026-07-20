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
  timeline,
  track,
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

function isRuntimeTrackEnabled(timeline, track): boolean {
  return (
    track?.enabled !== false &&
    isRuntimeSceneEnabled(timeline, track?.sceneId) &&
    isRuntimePhaseEnabled(timeline, track?.phaseId)
  );
}

function isRuntimeKeyframeEnabled(timeline, keyframe): boolean {
  return (
    keyframe?.enabled !== false &&
    isRuntimeSceneEnabled(timeline, keyframe?.sceneId) &&
    isRuntimePhaseEnabled(timeline, keyframe?.phaseId)
  );
}

function isRuntimePhaseEnabled(timeline, phaseId): boolean {
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

function isRuntimeSceneEnabled(timeline, sceneId): boolean {
  if (!sceneId) {
    return true;
  }
  const scene = timeline?.scenes?.find((entry) => entry.id === sceneId);
  return !scene || scene.enabled !== false;
}
