import { clamp } from "../../../sdk/protocol.js";

export type TimelineSnapMode = "free" | "tenths" | "frames" | string;

export type TimelineViewport = {
  end: number;
  maxStart: number;
  span: number;
  start: number;
  zoom: number;
};

export type TimelineRangeState = {
  center: number;
  offset: number;
  zoom: number;
};

export type TimelinePlaybackRange = {
  end: number;
  start: number;
};

export function calculateTimelineViewport(
  duration: number,
  zoomValue: number,
  offsetValue: number,
): TimelineViewport {
  const safeDuration = Math.max(0.001, Number(duration) || 1);
  const zoom = clamp(Number(zoomValue) || 1, 1, 8);
  const span = safeDuration / zoom;
  const maxStart = Math.max(0, safeDuration - span);
  const start = clamp(Number(offsetValue) || 0, 0, maxStart);
  return { end: start + span, maxStart, span, start, zoom };
}

export function timelinePercentForViewport(
  time: number,
  viewport: TimelineViewport,
): number {
  return ((time - viewport.start) / Math.max(0.001, viewport.span)) * 100;
}

export function timelineDurationPercentForViewport(
  timeSpan: number,
  viewport: TimelineViewport,
): number {
  return (timeSpan / Math.max(0.001, viewport.span)) * 100;
}

export function getTimelineTickStep(span: number): number {
  if (span <= 1.5) {
    return 0.1;
  }
  if (span <= 4) {
    return 0.25;
  }
  if (span <= 8) {
    return 0.5;
  }
  return Math.max(1, Math.ceil(span / 10));
}

export function snapTimelineTime(
  time: number,
  options: { duration: number; fps: number; snapMode: TimelineSnapMode },
): number {
  const duration = Math.max(0, Number(options.duration) || 0);
  const value = Number(time) || 0;
  if (options.snapMode === "free") {
    return clamp(value, 0, duration);
  }
  if (options.snapMode === "tenths") {
    return clamp(Math.round(value * 10) / 10, 0, duration);
  }
  const fps = Math.max(1, Number(options.fps) || 30);
  return clamp(Math.round(value * fps) / fps, 0, duration);
}

export function snapTimelineDuration(
  duration: number,
  options: { fps: number; minDuration?: number; snapMode: TimelineSnapMode },
): number {
  const minDuration = Number(options.minDuration) || 0.05;
  const value = Number(duration) || 0;
  if (options.snapMode === "free") {
    return Math.max(minDuration, value);
  }
  if (options.snapMode === "tenths") {
    return Math.max(minDuration, Math.round(value * 10) / 10);
  }
  const fps = Math.max(1, Number(options.fps) || 30);
  return Math.max(minDuration, Math.round(value * fps) / fps);
}

export function calculateTimelineZoomState(options: {
  anchorTime?: number | null;
  currentOffset: number;
  currentZoom: number;
  duration: number;
  nextZoom: number;
}): { offset: number; zoom: number } {
  const duration = Math.max(0.001, Number(options.duration) || 1);
  const before = calculateTimelineViewport(
    duration,
    options.currentZoom,
    options.currentOffset,
  );
  const zoom = clamp(Number(options.nextZoom) || 1, 1, 8);
  const anchor = options.anchorTime ?? before.start + before.span / 2;
  const anchorRatio = clamp(
    (anchor - before.start) / Math.max(0.001, before.span),
    0,
    1,
  );
  const nextSpan = duration / zoom;
  return {
    offset: clamp(
      anchor - anchorRatio * nextSpan,
      0,
      Math.max(0, duration - nextSpan),
    ),
    zoom,
  };
}

export function calculatePannedTimelineOffset(options: {
  currentOffset: number;
  currentZoom: number;
  deltaSeconds: number;
  duration: number;
}): number {
  const viewport = calculateTimelineViewport(
    options.duration,
    options.currentZoom,
    options.currentOffset,
  );
  return clamp(
    viewport.start + Number(options.deltaSeconds || 0),
    0,
    viewport.maxStart,
  );
}

export function calculateFrameTimelineRangeState(
  start: number,
  end: number,
  duration: number,
): TimelineRangeState {
  const safeDuration = Math.max(0.001, Number(duration) || 1);
  const rangeStart = clamp(Number(start) || 0, 0, safeDuration);
  const rangeEnd = clamp(Number(end) || rangeStart, rangeStart, safeDuration);
  const paddedSpan = Math.max(0.6, (rangeEnd - rangeStart) * 1.9);
  const span = clamp(paddedSpan, safeDuration / 8, safeDuration);
  const center = (rangeStart + rangeEnd) / 2;
  const zoom = clamp(safeDuration / span, 1, 8);
  const viewport = calculateTimelineViewport(safeDuration, zoom, 0);
  return {
    center,
    offset: clamp(
      center - viewport.span / 2,
      0,
      Math.max(0, safeDuration - viewport.span),
    ),
    zoom,
  };
}

export function normalizeTimelinePlaybackRange(
  range: Partial<TimelinePlaybackRange> | null | undefined,
  duration: number,
): TimelinePlaybackRange | null {
  if (!range) {
    return null;
  }
  const safeDuration = Math.max(0, Number(duration) || 0);
  const start = clamp(Number(range.start) || 0, 0, safeDuration);
  const end = clamp(Number(range.end) || 0, 0, safeDuration);
  if (Math.abs(end - start) < 0.001) {
    return null;
  }
  return { end: Math.max(start, end), start: Math.min(start, end) };
}

export function calculateTimelinePlaybackStep(options: {
  current: number;
  deltaSeconds: number;
  duration: number;
  loop: boolean;
  range?: Partial<TimelinePlaybackRange> | null;
}): { finished: boolean; range: TimelinePlaybackRange | null; time: number } {
  const safeDuration = Math.max(0.001, Number(options.duration) || 1);
  const range = normalizeTimelinePlaybackRange(options.range, safeDuration);
  const rangeStart = range?.start ?? 0;
  const rangeEnd = range?.end ?? safeDuration;
  const rangeSpan = Math.max(0.001, rangeEnd - rangeStart);
  const current = Number(options.current) || 0;
  const normalizedCurrent =
    range && (current < rangeStart || current > rangeEnd)
      ? rangeStart
      : clamp(current, 0, safeDuration);
  const rawNext =
    normalizedCurrent + Math.max(0, Number(options.deltaSeconds) || 0);
  const loopedOffset =
    (((rawNext - rangeStart) % rangeSpan) + rangeSpan) % rangeSpan;
  const next = options.loop
    ? rangeStart + loopedOffset
    : Math.min(rawNext, rangeEnd);
  return {
    finished: !options.loop && rawNext >= rangeEnd,
    range,
    time: clamp(next, 0, safeDuration),
  };
}
