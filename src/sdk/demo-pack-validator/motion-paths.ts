import type { DemoPackIssue } from "./common.js";
import { isRecord, push, records } from "./common.js";

const POINT_KINDS = new Set(["corner", "linear", "smooth"]);

export function validateTimelineMotionPaths(
  template: Record<string, unknown>,
  path: string,
  errors: DemoPackIssue[],
): void {
  const motionPaths = isRecord(template.timeline)
    ? template.timeline.motionPaths
    : undefined;
  if (motionPaths === undefined) {
    return;
  }
  if (!Array.isArray(motionPaths)) {
    push(errors, `${path}.timeline.motionPaths`, "Expected motion path list.");
    return;
  }
  const layers = new Map(
    records(template.layers).map((layer) => [layer.id, layer]),
  );
  const tracks = records(
    isRecord(template.timeline) ? template.timeline.tracks : undefined,
  );
  const seenLayers = new Set();
  motionPaths.forEach((motionPath, index) => {
    const motionPathPath = `${path}.timeline.motionPaths.${index}`;
    if (!isRecord(motionPath)) {
      push(errors, motionPathPath, "Expected motion path object.");
      return;
    }
    const layerId = motionPath.layerId;
    const layer = layers.get(layerId);
    if (typeof layerId !== "string" || !layerId) {
      push(errors, `${motionPathPath}.layerId`, "Expected layer id.");
    } else if (!layer) {
      push(errors, `${motionPathPath}.layerId`, `Unknown layer ${layerId}.`);
    } else if (layer.type === "group") {
      push(
        errors,
        `${motionPathPath}.layerId`,
        "Groups cannot own motion paths.",
      );
    } else if (seenLayers.has(layerId)) {
      push(
        errors,
        `${motionPathPath}.layerId`,
        `Duplicate motion path for ${layerId}.`,
      );
    }
    seenLayers.add(layerId);
    const xTrack = findSpatialTrack(tracks, layerId, "x");
    const yTrack = findSpatialTrack(tracks, layerId, "y");
    if (!xTrack || !yTrack) {
      push(
        errors,
        motionPathPath,
        "Motion path requires matching x and y tracks.",
      );
      return;
    }
    validateMotionPathPoints(
      motionPath.points,
      motionPathPath,
      xTrack,
      yTrack,
      errors,
    );
  });
}

function validateMotionPathPoints(
  points: unknown,
  path: string,
  xTrack: Record<string, unknown>,
  yTrack: Record<string, unknown>,
  errors: DemoPackIssue[],
): void {
  if (!Array.isArray(points) || points.length < 2) {
    push(errors, `${path}.points`, "Expected at least two motion path points.");
    return;
  }
  const xById = new Map(
    records(xTrack.keyframes).map((keyframe) => [keyframe.id, keyframe]),
  );
  const yById = new Map(
    records(yTrack.keyframes).map((keyframe) => [keyframe.id, keyframe]),
  );
  const seenRefs = new Set();
  const seenTimes = new Set();
  points.forEach((point, index) => {
    const pointPath = `${path}.points.${index}`;
    if (!isRecord(point)) {
      push(errors, pointPath, "Expected motion path point.");
      return;
    }
    if (
      point.kind !== undefined &&
      (typeof point.kind !== "string" || !POINT_KINDS.has(point.kind))
    ) {
      push(errors, `${pointPath}.kind`, "Expected linear, smooth, or corner.");
    }
    validateTangent(point.inTangent, `${pointPath}.inTangent`, errors);
    validateTangent(point.outTangent, `${pointPath}.outTangent`, errors);
    const xKeyframe = xById.get(point.xKeyframeId);
    const yKeyframe = yById.get(point.yKeyframeId);
    if (!xKeyframe) {
      push(
        errors,
        `${pointPath}.xKeyframeId`,
        "Expected keyframe from the layer x track.",
      );
    }
    if (!yKeyframe) {
      push(
        errors,
        `${pointPath}.yKeyframeId`,
        "Expected keyframe from the layer y track.",
      );
    }
    if (!xKeyframe || !yKeyframe) {
      return;
    }
    const refKey = `${point.xKeyframeId}:${point.yKeyframeId}`;
    if (seenRefs.has(refKey)) {
      push(errors, pointPath, "Duplicate motion path keyframe pair.");
    }
    seenRefs.add(refKey);
    if (
      typeof xKeyframe.value !== "number" ||
      typeof yKeyframe.value !== "number"
    ) {
      push(errors, pointPath, "Motion path keyframes must be numeric.");
    }
    if (Math.abs(Number(xKeyframe.time) - Number(yKeyframe.time)) > 0.0001) {
      push(
        errors,
        pointPath,
        "Motion path keyframes must share the same time.",
      );
    }
    const timeKey = Number(xKeyframe.time).toFixed(4);
    if (seenTimes.has(timeKey)) {
      push(errors, pointPath, "Motion path point times must be unique.");
    }
    seenTimes.add(timeKey);
    if (!temporalSettingsMatch(xKeyframe, yKeyframe)) {
      push(
        errors,
        pointPath,
        "Paired motion path keyframes must share temporal easing.",
      );
    }
  });
}

function findSpatialTrack(
  tracks: Record<string, unknown>[],
  layerId: unknown,
  property: string,
) {
  return tracks.find(
    (track) =>
      (track.layerId ?? track.target) === layerId &&
      (track.property ??
        (typeof track.id === "string"
          ? track.id.split(".").at(-1)
          : undefined)) === property,
  );
}

function validateTangent(
  value: unknown,
  path: string,
  errors: DemoPackIssue[],
): void {
  if (value === undefined) {
    return;
  }
  if (
    !isRecord(value) ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y)
  ) {
    push(errors, path, "Expected finite x/y tangent.");
  }
}

function temporalSettingsMatch(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  const easing = left.easing ?? "linear";
  if (easing !== (right.easing ?? "linear")) {
    return false;
  }
  if (easing !== "bezier") {
    return true;
  }
  const leftHandles = left.handles;
  const rightHandles = right.handles;
  if (!isRecord(leftHandles) || !isRecord(rightHandles)) {
    return false;
  }
  return ["x1", "y1", "x2", "y2"].every(
    (property) =>
      Math.abs(Number(leftHandles[property]) - Number(rightHandles[property])) <
      0.0001,
  );
}
