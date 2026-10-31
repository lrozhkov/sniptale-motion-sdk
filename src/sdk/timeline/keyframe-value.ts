import { resolveTimelineEase } from "./easing.js";

type KeyframeValue<T> = {
  time: number;
  value?: T;
  easing?: string;
  handles?: unknown;
};

export function evaluateTimelineKeyframes(
  keyframes: readonly KeyframeValue<number>[],
  time: number,
  fallback: number,
): number;
export function evaluateTimelineKeyframes(
  keyframes: readonly KeyframeValue<unknown>[],
  time: number,
  fallback: unknown,
): unknown;
/** Shared by canvas and DOM renderers; easing belongs to the outgoing key. */
export function evaluateTimelineKeyframes(
  keyframes: readonly KeyframeValue<unknown>[],
  time: number,
  fallback: unknown,
): unknown {
  const first = keyframes[0];
  const last = keyframes.at(-1);
  if (!first || !last) return fallback;
  if (time <= first.time) return first.value ?? fallback;
  if (time >= last.time) return last.value ?? fallback;
  let low = 1;
  let high = keyframes.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const keyframe = keyframes[middle];
    if (!keyframe) return fallback;
    if (time <= keyframe.time) high = middle;
    else low = middle + 1;
  }
  const from = keyframes[low - 1];
  const to = keyframes[low];
  if (!from || !to) return fallback;
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
    from.value ?? fallback,
    to.value ?? fallback,
    resolveTimelineEase(from, progress),
  );
}

export function interpolateTimelineValue(
  from: number,
  to: number,
  t: number,
): number;
export function interpolateTimelineValue(
  from: unknown,
  to: unknown,
  t: number,
): unknown;
export function interpolateTimelineValue(
  from: unknown,
  to: unknown,
  t: number,
): unknown {
  if (typeof from === "number" && typeof to === "number") {
    return from + (to - from) * Math.min(1, Math.max(0, t));
  }
  if (isArray(from) && isArray(to) && from.length === to.length) {
    return from.map((value, index) => {
      const next = to[index];
      return typeof value === "number" && typeof next === "number"
        ? interpolateTimelineValue(value, next, t)
        : t < 0.5
          ? value
          : next;
    });
  }
  if (isRecord(from) && isRecord(to)) {
    return {
      ...from,
      ...Object.fromEntries(
        Object.keys(to).map((key) => [
          key,
          interpolateTimelineValue(
            Object.hasOwn(from, key) ? from[key] : undefined,
            to[key],
            t,
          ),
        ]),
      ),
    };
  }
  return t < 0.5 ? from : to;
}
function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
