import type { EditorTimeline } from "../../editor/model-types.js";
import type { TimelineMotionPath } from "../../../../sdk/types.js";
import type { KeyframeSelectionRef } from "./selection-model.js";
import { keyframeRefKey } from "./keyframe-reference.js";
import {
  getMotionPathLayerProperty,
  type MotionPathTrack,
} from "../../../../shared/timeline/motion-path.js";

type MotionPathTimeline = Pick<EditorTimeline, "tracks" | "motionPaths">;

export type InsertedKeyframeMapping = {
  fromKeyframeId: string;
  toKeyframeId: string;
  trackId: string;
};

export function expandMotionPathKeyframeSelection(
  timeline: MotionPathTimeline,
  refs: readonly KeyframeSelectionRef[],
): KeyframeSelectionRef[] {
  const expanded = new Map(
    refs.map((ref) => [keyframeRefKey(ref), { ...ref }]),
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
        expanded.has(keyframeRefKey(xRef)) ||
        expanded.has(keyframeRefKey(yRef))
      ) {
        expanded.set(keyframeRefKey(xRef), xRef);
        expanded.set(keyframeRefKey(yRef), yRef);
      }
    }
  }
  return [...expanded.values()];
}

export function getPairedMotionPathKeyframeRef(
  timeline: MotionPathTimeline,
  trackId: string,
  keyframeId: string,
): KeyframeSelectionRef | null {
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
  timeline: MotionPathTimeline,
  selectedKeys: ReadonlySet<string>,
): TimelineMotionPath[] {
  return (timeline.motionPaths ?? [])
    .map((path) => {
      const tracks = getSpatialTracks(timeline, path.layerId);
      if (!tracks) {
        return null;
      }
      const points = path.points.filter(
        (point) =>
          !selectedKeys.has(
            keyframeRefKey({
              trackId: tracks.x.id,
              keyframeId: point.xKeyframeId,
            }),
          ) &&
          !selectedKeys.has(
            keyframeRefKey({
              trackId: tracks.y.id,
              keyframeId: point.yKeyframeId,
            }),
          ),
      );
      return points.length >= 2 ? { ...path, points } : null;
    })
    .filter((path): path is TimelineMotionPath => path !== null);
}

export function duplicateInsertedMotionPathPoints(
  timeline: MotionPathTimeline,
  mappings: readonly InsertedKeyframeMapping[],
): TimelineMotionPath[] {
  const insertedBySource = new Map(
    mappings.map((mapping) => [
      keyframeRefKey({
        trackId: mapping.trackId,
        keyframeId: mapping.fromKeyframeId,
      }),
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
        keyframeRefKey({ trackId: tracks.x.id, keyframeId: point.xKeyframeId }),
      );
      const yKeyframeId = insertedBySource.get(
        keyframeRefKey({ trackId: tracks.y.id, keyframeId: point.yKeyframeId }),
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

function getSpatialTracks(timeline: MotionPathTimeline, layerId: string) {
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

function getKeyframeTime(track: MotionPathTrack, keyframeId: string): number {
  return Number(
    track.keyframes?.find((keyframe) => keyframe.id === keyframeId)?.time,
  );
}
