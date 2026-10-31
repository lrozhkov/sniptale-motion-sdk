import type { TimelineRangeEditMode } from "./move-plan-model.js";

export function getSegmentDragLimits(
  original: { fromTime: number; toTime: number },
  previous: { time: number } | null | undefined,
  next: { time: number } | null | undefined,
  minGap: number,
  duration: number,
  mode: TimelineRangeEditMode,
) {
  const previousLimit = previous ? previous.time + minGap : 0;
  const nextLimit = next ? next.time - minGap : duration;
  if (mode === "move") {
    const min = previousLimit - original.fromTime;
    const max = nextLimit - original.toTime;
    return {
      fromMax: original.fromTime + max,
      fromMin: original.fromTime + min,
      max,
      min,
      toMax: original.toTime + max,
      toMin: original.toTime + min,
    };
  }
  if (mode === "start") {
    return {
      fromMax: original.toTime - minGap,
      fromMin: previousLimit,
      max: original.toTime - minGap - original.fromTime,
      min: previousLimit - original.fromTime,
      toMax: original.toTime,
      toMin: original.toTime,
    };
  }
  return {
    fromMax: original.fromTime,
    fromMin: original.fromTime,
    max: nextLimit - original.toTime,
    min: original.fromTime + minGap - original.toTime,
    toMax: nextLimit,
    toMin: original.fromTime + minGap,
  };
}
