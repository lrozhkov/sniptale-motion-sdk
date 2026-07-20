import {
  getMotionPathLayerProperty,
  type TimelineMotionPath,
} from "../../../../shared/timeline/motion-path.js";

export type InsertedKeyframeMapping = {
  fromKeyframeId: string;
  toKeyframeId: string;
  trackId: string;
};

export function expandMotionPathKeyframeSelection(timeline, refs): any[] {
  const expanded = new Map(
    refs.map((ref) => [`${ref.trackId}:${ref.keyframeId}`, { ...ref }]),
  );
  for (const path of timeline.motionPaths ?? []) {
    const tracks = getSpatialTracks(timeline, path.layerId);
    if (!tracks) {
      continue;
    }
    for (const point of path.points) {
      const xRef = {
        keyframeId: point.xKeyframeId,
        trackId: tracks.x.id,
      };
      const yRef = {
        keyframeId: point.yKeyframeId,
        trackId: tracks.y.id,
      };
      if (
        expanded.has(`${xRef.trackId}:${xRef.keyframeId}`) ||
        expanded.has(`${yRef.trackId}:${yRef.keyframeId}`)
      ) {
        expanded.set(`${xRef.trackId}:${xRef.keyframeId}`, xRef);
        expanded.set(`${yRef.trackId}:${yRef.keyframeId}`, yRef);
      }
    }
  }
  return [...expanded.values()];
}

export function getPairedMotionPathKeyframeRef(
  timeline,
  trackId: string,
  keyframeId: string,
) {
  for (const path of timeline.motionPaths ?? []) {
    const tracks = getSpatialTracks(timeline, path.layerId);
    if (!tracks) {
      continue;
    }
    for (const point of path.points) {
      if (trackId === tracks.x.id && keyframeId === point.xKeyframeId) {
        return { keyframeId: point.yKeyframeId, trackId: tracks.y.id };
      }
      if (trackId === tracks.y.id && keyframeId === point.yKeyframeId) {
        return { keyframeId: point.xKeyframeId, trackId: tracks.x.id };
      }
    }
  }
  return null;
}

export function removeDeletedMotionPathPoints(
  timeline,
  selectedKeys: Set<string>,
): TimelineMotionPath[] {
  return (timeline.motionPaths ?? [])
    .map((path) => {
      const tracks = getSpatialTracks(timeline, path.layerId);
      if (!tracks) {
        return null;
      }
      const points = path.points.filter(
        (point) =>
          !selectedKeys.has(`${tracks.x.id}:${point.xKeyframeId}`) &&
          !selectedKeys.has(`${tracks.y.id}:${point.yKeyframeId}`),
      );
      return points.length >= 2 ? { ...path, points } : null;
    })
    .filter((path): path is TimelineMotionPath => Boolean(path));
}

export function duplicateInsertedMotionPathPoints(
  timeline,
  mappings: InsertedKeyframeMapping[],
): TimelineMotionPath[] {
  const insertedBySource = new Map(
    mappings.map((mapping) => [
      `${mapping.trackId}:${mapping.fromKeyframeId}`,
      mapping.toKeyframeId,
    ]),
  );
  return (timeline.motionPaths ?? []).map((path) => {
    const tracks = getSpatialTracks(timeline, path.layerId);
    if (!tracks) {
      return path;
    }
    const inserted = path.points.flatMap((point) => {
      const xKeyframeId = insertedBySource.get(
        `${tracks.x.id}:${point.xKeyframeId}`,
      );
      const yKeyframeId = insertedBySource.get(
        `${tracks.y.id}:${point.yKeyframeId}`,
      );
      return xKeyframeId && yKeyframeId
        ? [
            {
              ...structuredClone(point),
              xKeyframeId,
              yKeyframeId,
            },
          ]
        : [];
    });
    if (inserted.length === 0) {
      return path;
    }
    return {
      ...path,
      points: [...path.points, ...inserted].sort(
        (left, right) =>
          getKeyframeTime(tracks.x, left.xKeyframeId) -
          getKeyframeTime(tracks.x, right.xKeyframeId),
      ),
    };
  });
}

function getSpatialTracks(timeline, layerId: string) {
  const x = (timeline.tracks ?? []).find(
    (track) =>
      getMotionPathLayerProperty(track)?.layerId === layerId &&
      getMotionPathLayerProperty(track)?.property === "x",
  );
  const y = (timeline.tracks ?? []).find(
    (track) =>
      getMotionPathLayerProperty(track)?.layerId === layerId &&
      getMotionPathLayerProperty(track)?.property === "y",
  );
  return x && y ? { x, y } : null;
}

function getKeyframeTime(track, keyframeId: string): number {
  return Number(
    track.keyframes?.find((keyframe) => keyframe.id === keyframeId)?.time,
  );
}
