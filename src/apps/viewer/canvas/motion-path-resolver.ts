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

export function resolveViewerMotionPathTrackValue(
  track,
  time,
  timeline,
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
        isViewerTrackEnabled(timeline, candidate)
          ? (candidate.keyframes ?? []).filter((keyframe) =>
              isViewerKeyframeEnabled(timeline, keyframe),
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

function isViewerTrackEnabled(timeline, track): boolean {
  return (
    track?.enabled !== false &&
    isViewerOwnerEnabled(timeline, track?.sceneId, track?.phaseId)
  );
}

function isViewerKeyframeEnabled(timeline, keyframe): boolean {
  return (
    keyframe?.enabled !== false &&
    isViewerOwnerEnabled(timeline, keyframe?.sceneId, keyframe?.phaseId)
  );
}

function isViewerOwnerEnabled(timeline, sceneId, phaseId): boolean {
  if (!isViewerSceneEnabled(timeline?.scenes, sceneId)) {
    return false;
  }
  if (!phaseId) {
    return true;
  }
  const phase = timeline?.phases?.find((entry) => entry.id === phaseId);
  return Boolean(
    phase &&
    phase.enabled !== false &&
    isViewerSceneEnabled(timeline?.scenes, phase.sceneId),
  );
}

function isViewerSceneEnabled(scenes, sceneId): boolean {
  if (!sceneId) {
    return true;
  }
  const scene = scenes?.find((entry) => entry.id === sceneId);
  return !scene || scene.enabled !== false;
}
