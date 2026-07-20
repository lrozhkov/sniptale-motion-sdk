import {
  createMotionPathGeometry,
  getMotionPathLayerProperty,
  type MotionPathPointKind,
  type MotionPathTangent,
} from "../../../shared/timeline/motion-path.js";

const KEYFRAME_TIME_EPSILON = 0.0001;

export type CanvasMotionPathPoint = {
  enabled: boolean;
  inTangent: MotionPathTangent;
  kind: MotionPathPointKind;
  outTangent: MotionPathTangent;
  time: number;
  x: number;
  xKeyframe: any;
  xKeyframeId: string;
  y: number;
  yKeyframe: any;
  yKeyframeId: string;
};

export type CanvasMotionPathModel =
  | {
      layerId: string;
      ok: true;
      points: CanvasMotionPathPoint[];
      source: "legacy" | "spatial";
      xTrack: any;
      yTrack: any;
    }
  | {
      layerId: string;
      ok: false;
      reason:
        | "duplicate-time"
        | "missing-keyframe"
        | "missing-path"
        | "missing-track"
        | "non-numeric"
        | "temporal-mismatch"
        | "time-mismatch"
        | "unpaired-keyframes";
    };

export function createCanvasMotionPathModel(
  timeline,
  layerId: string,
): CanvasMotionPathModel {
  const configured = (timeline?.motionPaths ?? []).some(
    (path) => path?.layerId === layerId,
  );
  if (configured) {
    const geometry = createMotionPathGeometry(timeline, layerId);
    if ("reason" in geometry) {
      return {
        layerId: geometry.layerId,
        ok: false,
        reason: geometry.reason,
      };
    }
    return {
      layerId,
      ok: true,
      points: geometry.points.map((point) => ({
        ...point,
        enabled:
          isTimelineTrackEnabled(timeline, geometry.xTrack) &&
          isTimelineTrackEnabled(timeline, geometry.yTrack) &&
          isTimelineKeyframeEnabled(timeline, point.xKeyframe) &&
          isTimelineKeyframeEnabled(timeline, point.yKeyframe),
      })),
      source: "spatial",
      xTrack: geometry.xTrack,
      yTrack: geometry.yTrack,
    };
  }
  return createLegacyMotionPathModel(timeline, layerId);
}

export function getCanvasMotionPathPointRefs(
  model: Extract<CanvasMotionPathModel, { ok: true }>,
  point: CanvasMotionPathPoint,
) {
  return [
    { keyframeId: point.xKeyframeId, trackId: model.xTrack.id },
    { keyframeId: point.yKeyframeId, trackId: model.yTrack.id },
  ];
}

export function isCanvasMotionPathPointSelected(
  point: CanvasMotionPathPoint,
  refs,
  xTrackId: string,
  yTrackId: string,
): boolean {
  return (Array.isArray(refs) ? refs : []).some(
    (ref) =>
      (ref.trackId === xTrackId && ref.keyframeId === point.xKeyframeId) ||
      (ref.trackId === yTrackId && ref.keyframeId === point.yKeyframeId),
  );
}

export function findCanvasMotionPathPoint(
  model: CanvasMotionPathModel,
  xKeyframeId: string,
  yKeyframeId: string,
): CanvasMotionPathPoint | null {
  return model.ok
    ? (model.points.find(
        (point) =>
          point.xKeyframeId === xKeyframeId &&
          point.yKeyframeId === yKeyframeId,
      ) ?? null)
    : null;
}

function createLegacyMotionPathModel(
  timeline,
  layerId: string,
): CanvasMotionPathModel {
  const xTrack = findLayerPropertyTrack(timeline, layerId, "x");
  const yTrack = findLayerPropertyTrack(timeline, layerId, "y");
  if (!xTrack || !yTrack) {
    return { layerId, ok: false, reason: "missing-track" };
  }
  const xKeyframes = sortNumericKeyframes(xTrack);
  const yKeyframes = sortNumericKeyframes(yTrack);
  if (
    xKeyframes.length === 0 ||
    xKeyframes.length !== yKeyframes.length ||
    hasDuplicateTimes(xKeyframes) ||
    hasDuplicateTimes(yKeyframes)
  ) {
    return { layerId, ok: false, reason: "unpaired-keyframes" };
  }
  const points: CanvasMotionPathPoint[] = [];
  for (let index = 0; index < xKeyframes.length; index += 1) {
    const xKeyframe = xKeyframes[index];
    const yKeyframe = yKeyframes[index];
    if (
      Math.abs(Number(xKeyframe.time) - Number(yKeyframe.time)) >
      KEYFRAME_TIME_EPSILON
    ) {
      return { layerId, ok: false, reason: "unpaired-keyframes" };
    }
    points.push({
      enabled:
        isTimelineTrackEnabled(timeline, xTrack) &&
        isTimelineTrackEnabled(timeline, yTrack) &&
        isTimelineKeyframeEnabled(timeline, xKeyframe) &&
        isTimelineKeyframeEnabled(timeline, yKeyframe),
      inTangent: { x: 0, y: 0 },
      kind: "linear",
      outTangent: { x: 0, y: 0 },
      time: Number(xKeyframe.time),
      x: Number(xKeyframe.value),
      xKeyframe,
      xKeyframeId: String(xKeyframe.id),
      y: Number(yKeyframe.value),
      yKeyframe,
      yKeyframeId: String(yKeyframe.id),
    });
  }
  return {
    layerId,
    ok: true,
    points,
    source: "legacy",
    xTrack,
    yTrack,
  };
}

function findLayerPropertyTrack(timeline, layerId, property) {
  return (timeline?.tracks ?? []).find((track) => {
    const owner = getMotionPathLayerProperty(track);
    return owner?.layerId === layerId && owner.property === property;
  });
}

function sortNumericKeyframes(track) {
  const keyframes = (track?.keyframes ?? []).filter(
    (keyframe) =>
      keyframe?.id &&
      Number.isFinite(Number(keyframe.time)) &&
      Number.isFinite(Number(keyframe.value)),
  );
  if (keyframes.length !== (track?.keyframes ?? []).length) {
    return [];
  }
  return [...keyframes].sort((left, right) => left.time - right.time);
}

function hasDuplicateTimes(keyframes): boolean {
  return keyframes.some(
    (keyframe, index) =>
      index > 0 &&
      Math.abs(Number(keyframe.time) - Number(keyframes[index - 1].time)) <
        KEYFRAME_TIME_EPSILON,
  );
}

function isTimelineTrackEnabled(timeline, track): boolean {
  return (
    track?.enabled !== false &&
    isTimelineOwnerEnabled(timeline, track?.sceneId, track?.phaseId)
  );
}

function isTimelineKeyframeEnabled(timeline, keyframe): boolean {
  return (
    keyframe?.enabled !== false &&
    isTimelineOwnerEnabled(timeline, keyframe?.sceneId, keyframe?.phaseId)
  );
}

function isTimelineOwnerEnabled(timeline, sceneId, phaseId): boolean {
  const scene = sceneId
    ? timeline?.scenes?.find((entry) => entry.id === sceneId)
    : null;
  const phase = phaseId
    ? timeline?.phases?.find((entry) => entry.id === phaseId)
    : null;
  const phaseScene = phase?.sceneId
    ? timeline?.scenes?.find((entry) => entry.id === phase.sceneId)
    : null;
  return (
    scene?.enabled !== false &&
    phase?.enabled !== false &&
    phaseScene?.enabled !== false
  );
}
