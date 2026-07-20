import type { TimelineMotionPath } from "../../../shared/timeline/motion-path.js";

export function getTimelineMotionPath(
  timeline,
  layerId: string,
): TimelineMotionPath | null {
  return (
    (timeline.motionPaths ?? []).find((path) => path.layerId === layerId) ??
    null
  );
}

export function syncMotionPathPositionKeyframes(
  timeline,
  path: TimelineMotionPath,
  xKeyframe,
  yKeyframe,
): void {
  if (!xKeyframe || !yKeyframe) {
    return;
  }
  synchronizeTemporalSettings(xKeyframe, yKeyframe);
  const existing = path.points.find(
    (point) =>
      point.xKeyframeId === xKeyframe.id ||
      point.yKeyframeId === yKeyframe.id ||
      Math.abs(getPointTime(timeline, path.layerId, point) - xKeyframe.time) <
        0.0001,
  );
  if (existing) {
    existing.xKeyframeId = xKeyframe.id;
    existing.yKeyframeId = yKeyframe.id;
  } else {
    path.points.push({
      inTangent: { x: 0, y: 0 },
      kind: "linear",
      outTangent: { x: 0, y: 0 },
      xKeyframeId: xKeyframe.id,
      yKeyframeId: yKeyframe.id,
    });
  }
  path.points.sort(
    (left, right) =>
      getPointTime(timeline, path.layerId, left) -
      getPointTime(timeline, path.layerId, right),
  );
}

function synchronizeTemporalSettings(xKeyframe, yKeyframe): void {
  yKeyframe.easing = xKeyframe.easing ?? "linear";
  if (xKeyframe.handles) {
    yKeyframe.handles = structuredClone(xKeyframe.handles);
  } else {
    delete yKeyframe.handles;
  }
}

function getPointTime(timeline, layerId: string, point): number {
  const xTrack = (timeline.tracks ?? []).find(
    (track) =>
      (track.layerId ?? track.target) === layerId &&
      (track.property ?? track.id?.split(".").at(-1)) === "x",
  );
  return Number(
    xTrack?.keyframes?.find((keyframe) => keyframe.id === point.xKeyframeId)
      ?.time,
  );
}
