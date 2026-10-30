import { resolveTimelineEase } from "../../sdk/timeline/easing.js";

export const MOTION_PATH_POINT_KINDS = ["corner", "linear", "smooth"] as const;

export type MotionPathPointKind = (typeof MOTION_PATH_POINT_KINDS)[number];

export type MotionPathTangent = {
  x: number;
  y: number;
};

export type TimelineMotionPathPoint = {
  inTangent: MotionPathTangent;
  kind: MotionPathPointKind;
  outTangent: MotionPathTangent;
  xKeyframeId: string;
  yKeyframeId: string;
};

export type TimelineMotionPath = {
  layerId: string;
  points: TimelineMotionPathPoint[];
};

export type ResolvedMotionPathPoint = TimelineMotionPathPoint & {
  time: number;
  x: number;
  xKeyframe: any;
  y: number;
  yKeyframe: any;
};

export type MotionPathGeometryResult =
  | {
      layerId: string;
      ok: true;
      points: ResolvedMotionPathPoint[];
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
        | "time-mismatch";
    };

export function normalizeMotionPaths(value: unknown): TimelineMotionPath[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry: any) => ({
      layerId: String(entry.layerId ?? ""),
      points: Array.isArray(entry.points)
        ? entry.points
            .filter((point) => point && typeof point === "object")
            .map(normalizeMotionPathPoint)
            .filter((point) => point.xKeyframeId && point.yKeyframeId)
        : [],
    }))
    .filter((entry) => entry.layerId && entry.points.length > 0);
}

export function createMotionPathGeometry(
  timeline,
  layerId: string,
  options: {
    getTrackKeyframes?: (track: any) => any[];
  } = {},
): MotionPathGeometryResult {
  const path = normalizeMotionPaths(timeline?.motionPaths).find(
    (entry) => entry.layerId === layerId,
  );
  if (!path) {
    return { layerId, ok: false, reason: "missing-path" };
  }
  const xTrack = findMotionPathTrack(timeline, layerId, "x");
  const yTrack = findMotionPathTrack(timeline, layerId, "y");
  if (!xTrack || !yTrack) {
    return { layerId, ok: false, reason: "missing-track" };
  }
  const getKeyframes =
    options.getTrackKeyframes ??
    ((track) => (Array.isArray(track?.keyframes) ? track.keyframes : []));
  const xById = new Map<string, any>(
    getKeyframes(xTrack).map((keyframe) => [keyframe.id, keyframe]),
  );
  const yById = new Map<string, any>(
    getKeyframes(yTrack).map((keyframe) => [keyframe.id, keyframe]),
  );
  const points: ResolvedMotionPathPoint[] = [];
  for (const point of path.points) {
    const xKeyframe = xById.get(point.xKeyframeId);
    const yKeyframe = yById.get(point.yKeyframeId);
    if (!xKeyframe || !yKeyframe) {
      return { layerId, ok: false, reason: "missing-keyframe" };
    }
    if (
      !Number.isFinite(xKeyframe.value) ||
      !Number.isFinite(yKeyframe.value)
    ) {
      return { layerId, ok: false, reason: "non-numeric" };
    }
    if (Math.abs(Number(xKeyframe.time) - Number(yKeyframe.time)) > 0.0001) {
      return { layerId, ok: false, reason: "time-mismatch" };
    }
    if (!motionPathTemporalKeyframesMatch(xKeyframe, yKeyframe)) {
      return { layerId, ok: false, reason: "temporal-mismatch" };
    }
    points.push({
      ...point,
      time: Number(xKeyframe.time) || 0,
      x: Number(xKeyframe.value),
      xKeyframe,
      y: Number(yKeyframe.value),
      yKeyframe,
    });
  }
  points.sort((left, right) => left.time - right.time);
  if (
    points.some(
      (point, index) =>
        index > 0 && Math.abs(point.time - points[index - 1].time) < 0.0001,
    )
  ) {
    return { layerId, ok: false, reason: "duplicate-time" };
  }
  return { layerId, ok: true, points, xTrack, yTrack };
}

export function evaluateMotionPathGeometry(
  geometry: Extract<MotionPathGeometryResult, { ok: true }>,
  time: number,
): { x: number; y: number } | null {
  const points = geometry.points;
  if (points.length === 0) {
    return null;
  }
  if (time <= points[0].time) {
    return pickMotionPathPosition(points[0]);
  }
  const last = points.at(-1);
  if (time >= last.time) {
    return pickMotionPathPosition(last);
  }
  const index = findMotionPathSegmentIndex(points, time);
  const from = points[index];
  const to = points[index + 1];
  const raw = Math.min(
    1,
    Math.max(0, (time - from.time) / Math.max(0.0001, to.time - from.time)),
  );
  const progress = resolveTimelineEase(from.xKeyframe, raw);
  const linearSegment = from.kind === "linear";
  const firstControl = addMotionPathVector(
    from,
    linearSegment ? null : from.outTangent,
  );
  const secondControl = addMotionPathVector(
    to,
    linearSegment || to.kind === "linear" ? null : to.inTangent,
  );
  return {
    x: cubicBezierCoordinate(
      from.x,
      firstControl.x,
      secondControl.x,
      to.x,
      progress,
    ),
    y: cubicBezierCoordinate(
      from.y,
      firstControl.y,
      secondControl.y,
      to.y,
      progress,
    ),
  };
}

export function getMotionPathLayerProperty(track): {
  layerId: string;
  property: "x" | "y";
} | null {
  const property =
    track?.property ??
    (typeof track?.id === "string" && track.id.includes(".")
      ? track.id.split(".").at(-1)
      : null);
  if (property !== "x" && property !== "y") {
    return null;
  }
  const layerId =
    track?.layerId ??
    (typeof track?.target === "string" && track.target !== "scene"
      ? track.target
      : typeof track?.id === "string"
        ? track.id.split(".").slice(0, -1).join(".")
        : null);
  return layerId ? { layerId, property } : null;
}

function normalizeMotionPathPoint(point: any): TimelineMotionPathPoint {
  const kind = MOTION_PATH_POINT_KINDS.includes(point.kind)
    ? point.kind
    : "linear";
  return {
    inTangent: normalizeMotionPathTangent(point.inTangent),
    kind,
    outTangent: normalizeMotionPathTangent(point.outTangent),
    xKeyframeId: String(point.xKeyframeId ?? ""),
    yKeyframeId: String(point.yKeyframeId ?? ""),
  };
}

function normalizeMotionPathTangent(value): MotionPathTangent {
  return {
    x: Number.isFinite(Number(value?.x)) ? Number(value.x) : 0,
    y: Number.isFinite(Number(value?.y)) ? Number(value.y) : 0,
  };
}

function findMotionPathTrack(timeline, layerId, property) {
  return (timeline?.tracks ?? []).find(
    (track) =>
      getMotionPathLayerProperty(track)?.layerId === layerId &&
      getMotionPathLayerProperty(track)?.property === property,
  );
}

export function motionPathTemporalKeyframesMatch(left, right): boolean {
  const leftEasing = left.easing ?? "linear";
  const rightEasing = right.easing ?? "linear";
  if (leftEasing !== rightEasing) {
    return false;
  }
  if (leftEasing !== "bezier") {
    return true;
  }
  return ["x1", "y1", "x2", "y2"].every(
    (property) =>
      Math.abs(
        Number(left.handles?.[property]) - Number(right.handles?.[property]),
      ) < 0.0001,
  );
}

function findMotionPathSegmentIndex(
  points: ResolvedMotionPathPoint[],
  time: number,
): number {
  let low = 1;
  let high = points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) * 0.5);
    if (time <= points[middle].time) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }
  return low - 1;
}

function pickMotionPathPosition(point): { x: number; y: number } {
  return { x: point.x, y: point.y };
}

function addMotionPathVector(point, vector): { x: number; y: number } {
  return {
    x: point.x + (Number(vector?.x) || 0),
    y: point.y + (Number(vector?.y) || 0),
  };
}

function cubicBezierCoordinate(a, b, c, d, progress): number {
  const inverse = 1 - progress;
  return (
    inverse ** 3 * a +
    3 * inverse ** 2 * progress * b +
    3 * inverse * progress ** 2 * c +
    progress ** 3 * d
  );
}
