import type { TimelineMotionPath } from "../../../shared/timeline/motion-path.js";

export function duplicateLayerMotionPaths(
  motionPaths: TimelineMotionPath[] | undefined,
  layerIdMap: Map<string, string>,
): TimelineMotionPath[] {
  const duplicates: TimelineMotionPath[] = [];
  for (const path of motionPaths ?? []) {
    const nextLayerId = layerIdMap.get(path.layerId);
    if (!nextLayerId) {
      continue;
    }
    duplicates.push({
      layerId: nextLayerId,
      points: path.points.map((point) => ({
        ...structuredClone(point),
        xKeyframeId: remapKeyframeId(
          point.xKeyframeId,
          path.layerId,
          nextLayerId,
        ),
        yKeyframeId: remapKeyframeId(
          point.yKeyframeId,
          path.layerId,
          nextLayerId,
        ),
      })),
    });
  }
  return duplicates;
}

export function removeLayerMotionPaths(
  motionPaths: TimelineMotionPath[] | undefined,
  removedLayerIds: Set<string>,
): TimelineMotionPath[] {
  return (motionPaths ?? []).filter(
    (path) => !removedLayerIds.has(path.layerId),
  );
}

function remapKeyframeId(
  keyframeId: string,
  sourceLayerId: string,
  nextLayerId: string,
): string {
  return String(keyframeId).replace(sourceLayerId, nextLayerId);
}
