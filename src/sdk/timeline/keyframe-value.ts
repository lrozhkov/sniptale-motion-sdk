import { resolveTimelineEase } from "./easing.js";

/** Shared by canvas and DOM renderers; easing belongs to the outgoing key. */
export function evaluateTimelineKeyframes<T>(
  keyframes: readonly {
    time: number;
    value?: T;
    easing?: string;
    handles?: unknown;
  }[],
  time: number,
  fallback: T,
): T {
  if (keyframes.length === 0) return fallback;
  if (time <= keyframes[0].time) return keyframes[0].value ?? fallback;
  const last = keyframes[keyframes.length - 1];
  if (time >= last.time) return last.value ?? fallback;
  let low = 1;
  let high = keyframes.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (time <= keyframes[middle].time) high = middle;
    else low = middle + 1;
  }
  const from = keyframes[low - 1];
  const to = keyframes[low];
  const progress =
    time >= to.time
      ? 1
      : Math.max(
          0,
          Math.min(
            1,
            (time - from.time) / Math.max(0.0001, to.time - from.time),
          ),
        );
  return interpolateTimelineValue(
    from.value,
    to.value,
    resolveTimelineEase(from, progress),
  ) as T;
}

export function interpolateTimelineValue(from: any, to: any, t: number): any {
  if (typeof from === "number" && typeof to === "number") {
    return from + (to - from) * Math.min(1, Math.max(0, t));
  }
  if (Array.isArray(from) && Array.isArray(to) && from.length === to.length) {
    return from.map((value, index) =>
      typeof value === "number" && typeof to[index] === "number"
        ? interpolateTimelineValue(value, to[index], t)
        : t < 0.5
          ? value
          : to[index],
    );
  }
  if (
    from &&
    to &&
    typeof from === "object" &&
    typeof to === "object" &&
    !Array.isArray(from) &&
    !Array.isArray(to)
  ) {
    const result = { ...from };
    for (const key of Object.keys(to))
      result[key] = interpolateTimelineValue(from[key], to[key], t);
    return result;
  }
  return t < 0.5 ? from : to;
}
