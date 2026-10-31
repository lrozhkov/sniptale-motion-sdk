import type { EditorTimeline } from "../editor/model-types.js";
import type { TimelineKeyframe } from "../../../sdk/types.js";
import type { TimelineMotionPathPoint } from "../../../sdk/types.js";
import type { TimelineMotionPath } from "../../../sdk/types.js";

export function getTimelineMotionPath(
  timeline: EditorTimeline,
  layerId: string,
): TimelineMotionPath | null {
  return (
    (timeline.motionPaths ?? []).find((path) => path.layerId === layerId) ??
    null
  );
}

export function syncMotionPathPositionKeyframes(
  timeline: EditorTimeline,
  path: TimelineMotionPath,
  xKeyframe: TimelineKeyframe<unknown> | null | undefined,
  yKeyframe: TimelineKeyframe<unknown> | null | undefined,
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

function synchronizeTemporalSettings(
  xKeyframe: TimelineKeyframe<unknown>,
  yKeyframe: TimelineKeyframe<unknown>,
): void {
  yKeyframe.easing = xKeyframe.easing ?? "linear";
  if (xKeyframe.handles) {
    yKeyframe.handles = structuredClone(xKeyframe.handles);
  } else {
    delete yKeyframe.handles;
  }
}

function getPointTime(
  timeline: EditorTimeline,
  layerId: string,
  point: TimelineMotionPathPoint,
): number {
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
