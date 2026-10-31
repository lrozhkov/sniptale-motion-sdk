import type { PreviewCacheWarmStep } from "./cache-warm.js";
import type { PlaybackVideoCacheState } from "./video-cache-state.js";
import { beginPreviewCacheWarm } from "./cache-warm.js";
import type { PlaybackVideoCacheSegment } from "./video-cache-segments.js";

type SegmentWarmState = {
  previewCacheWarmActive?: boolean;
  previewCacheWarmRenderTime?: number;
  previewCacheWarmStartTime?: number;
  previewCacheWarmTargetFrames?: number;
  previewCacheWarmVisitedFrames?: number;
  previewCacheWarmPrepared?: boolean;
  previewCacheWarmCapacityLimited?: boolean;
};
type SegmentWarmCache = Partial<
  Pick<
    PlaybackVideoCacheState,
    "pendingSegmentCursor" | "pendingSegmentIndexes" | "segmentIndex"
  >
>;

export function beginPlaybackVideoSegmentWarm(
  state: SegmentWarmState,
  cache: SegmentWarmCache,
  options: {
    currentTime: number;
    duration: number;
    fps: number;
    pendingSegmentIndexes: number[];
    segments: PlaybackVideoCacheSegment[];
  },
): boolean {
  const pending = [...options.pendingSegmentIndexes];
  const selected: PlaybackVideoCacheSegment[] = [];
  for (const index of pending) {
    const segment = Number.isInteger(index)
      ? options.segments[index]
      : undefined;
    if (!segment) return false;
    selected.push(segment);
  }
  const firstIndex = pending[0];
  const first = selected[0];
  const rangeStart = options.segments[0];
  const rangeEnd = options.segments.at(-1);
  if (firstIndex === undefined || !first || !rangeStart || !rangeEnd)
    return false;
  beginPreviewCacheWarm(
    state,
    {
      currentTime: options.currentTime,
      duration: options.duration,
      fps: options.fps,
      range: {
        end: rangeEnd.endTime,
        start: rangeStart.startTime,
      },
    },
    true,
  );
  cache.pendingSegmentCursor = 0;
  cache.pendingSegmentIndexes = pending;
  cache.segmentIndex = firstIndex;
  state.previewCacheWarmRenderTime = first.startFrame / options.fps;
  state.previewCacheWarmStartTime = state.previewCacheWarmRenderTime;
  state.previewCacheWarmTargetFrames = selected.reduce(
    (total, segment) =>
      total + Math.max(0, segment.endFrame - segment.startFrame),
    0,
  );
  return true;
}

export function advancePlaybackVideoSegmentWarm(
  state: SegmentWarmState,
  cache: SegmentWarmCache,
  options: {
    currentFrame: number;
    fps: number;
    segments: PlaybackVideoCacheSegment[];
  },
): PreviewCacheWarmStep | null {
  if (!state.previewCacheWarmActive) {
    return null;
  }
  const pending = Array.isArray(cache.pendingSegmentIndexes)
    ? cache.pendingSegmentIndexes
    : options.segments.map((segment) => segment.index);
  cache.pendingSegmentIndexes = pending;
  const cursor = Math.max(0, Number(cache.pendingSegmentCursor) || 0);
  const segmentIndex = pending[cursor];
  const segment =
    segmentIndex === undefined ? undefined : options.segments[segmentIndex];
  if (!segment) {
    state.previewCacheWarmActive = false;
    state.previewCacheWarmPrepared = false;
    return null;
  }
  const targetFrames = Math.max(
    1,
    Number(state.previewCacheWarmTargetFrames) || 1,
  );
  state.previewCacheWarmVisitedFrames = Math.min(
    targetFrames,
    Math.max(0, Number(state.previewCacheWarmVisitedFrames) || 0) + 1,
  );
  if (options.currentFrame + 1 < segment.endFrame) {
    const time = (options.currentFrame + 1) / options.fps;
    state.previewCacheWarmRenderTime = time;
    return { finished: false, prepared: false, time };
  }
  const nextCursor = cursor + 1;
  cache.pendingSegmentCursor = nextCursor;
  if (nextCursor >= pending.length) {
    state.previewCacheWarmActive = false;
    state.previewCacheWarmCapacityLimited = false;
    state.previewCacheWarmPrepared = true;
    const startTime = Number(state.previewCacheWarmStartTime) || 0;
    state.previewCacheWarmRenderTime = startTime;
    return { finished: true, prepared: true, time: startTime };
  }
  const nextIndex = pending[nextCursor];
  const nextSegment =
    nextIndex === undefined ? undefined : options.segments[nextIndex];
  if (!nextSegment) {
    state.previewCacheWarmActive = false;
    state.previewCacheWarmPrepared = false;
    return null;
  }
  const time = nextSegment.startFrame / options.fps;
  state.previewCacheWarmRenderTime = time;
  return { finished: false, prepared: false, time };
}
