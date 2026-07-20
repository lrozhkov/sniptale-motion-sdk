import { beginPreviewCacheWarm } from "./cache-warm.js";
import type { PlaybackVideoCacheSegment } from "./video-cache-segments.js";

export function beginPlaybackVideoSegmentWarm(
  state: any,
  cache: any,
  options: {
    currentTime: number;
    duration: number;
    fps: number;
    pendingSegmentIndexes: number[];
    segments: PlaybackVideoCacheSegment[];
  },
): boolean {
  const pending = [...options.pendingSegmentIndexes];
  if (pending.length === 0) {
    return false;
  }
  beginPreviewCacheWarm(
    state,
    {
      currentTime: options.currentTime,
      duration: options.duration,
      fps: options.fps,
      range: {
        end: options.segments.at(-1)?.endTime,
        start: options.segments[0]?.startTime,
      },
    },
    true,
  );
  cache.pendingSegmentCursor = 0;
  cache.pendingSegmentIndexes = pending;
  cache.segmentIndex = pending[0];
  const first = options.segments[pending[0]];
  state.previewCacheWarmRenderTime = first.startFrame / options.fps;
  state.previewCacheWarmStartTime = state.previewCacheWarmRenderTime;
  state.previewCacheWarmTargetFrames = pending.reduce(
    (total, index) =>
      total +
      Math.max(
        0,
        options.segments[index].endFrame - options.segments[index].startFrame,
      ),
    0,
  );
  return true;
}

export function advancePlaybackVideoSegmentWarm(
  state: any,
  cache: any,
  options: {
    currentFrame: number;
    fps: number;
    segments: PlaybackVideoCacheSegment[];
  },
) {
  if (!state.previewCacheWarmActive) {
    return null;
  }
  const pending = Array.isArray(cache.pendingSegmentIndexes)
    ? (cache.pendingSegmentIndexes as number[])
    : options.segments.map((segment) => segment.index);
  cache.pendingSegmentIndexes = pending;
  const cursor = Math.max(0, Number(cache.pendingSegmentCursor) || 0);
  const segmentIndex = pending[cursor];
  const segment = options.segments[segmentIndex];
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
    state.previewCacheWarmRenderTime = state.previewCacheWarmStartTime;
    return {
      finished: true,
      prepared: true,
      time: state.previewCacheWarmStartTime,
    };
  }
  const nextSegment = options.segments[pending[nextCursor]];
  const time = nextSegment.startFrame / options.fps;
  state.previewCacheWarmRenderTime = time;
  return { finished: false, prepared: false, time };
}
