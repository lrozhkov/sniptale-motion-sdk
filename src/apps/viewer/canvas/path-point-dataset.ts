import type { MotionPathPointRef } from "./motion-path-reference.js";

export function readEditablePathPointDataset(
  dataset: Readonly<Record<string, unknown>>,
): { layerId: string; pointIndex: number } | null {
  const { layerId, pointIndex: rawIndex } = dataset;
  if (
    typeof layerId !== "string" ||
    !layerId ||
    typeof rawIndex !== "string" ||
    !/^(?:0|[1-9]\d*)$/.test(rawIndex)
  )
    return null;
  const pointIndex = Number(rawIndex);
  return Number.isSafeInteger(pointIndex) ? { layerId, pointIndex } : null;
}
export function readMotionPathPointDataset(
  dataset: Readonly<Record<string, unknown>>,
): MotionPathPointRef | null {
  const { layerId, xKeyframeId, yKeyframeId } = dataset;
  return typeof layerId === "string" &&
    layerId &&
    typeof xKeyframeId === "string" &&
    xKeyframeId &&
    typeof yKeyframeId === "string" &&
    yKeyframeId
    ? { layerId, xKeyframeId, yKeyframeId }
    : null;
}
