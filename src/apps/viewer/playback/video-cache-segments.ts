import type { PlaybackVideoCacheRange } from "./video-cache-key.js";

export const PLAYBACK_VIDEO_CACHE_SEGMENT_SECONDS = 2;

export type PlaybackVideoCacheSegment = {
  endFrame: number;
  endTime: number;
  fingerprint?: string;
  index: number;
  startFrame: number;
  startTime: number;
};

export type PlaybackVideoCacheSegmentBlob = PlaybackVideoCacheSegment & {
  blob: Blob;
};

export function createPlaybackVideoCacheSegmentPlan(
  range: PlaybackVideoCacheRange,
  fps: number,
  segmented = true,
): PlaybackVideoCacheSegment[] {
  const normalizedFps = Math.max(1, Number(fps) || 30);
  const framesPerSegment = segmented
    ? Math.max(
        1,
        Math.round(PLAYBACK_VIDEO_CACHE_SEGMENT_SECONDS * normalizedFps),
      )
    : Math.max(1, range.endFrame - range.startFrame);
  const segments: PlaybackVideoCacheSegment[] = [];
  for (
    let startFrame = range.startFrame;
    startFrame < range.endFrame;
    startFrame += framesPerSegment
  ) {
    const endFrame = Math.min(range.endFrame, startFrame + framesPerSegment);
    segments.push({
      endFrame,
      endTime: Math.min(range.endTime, endFrame / normalizedFps),
      index: segments.length,
      startFrame,
      startTime: Math.max(range.startTime, startFrame / normalizedFps),
    });
  }
  return segments;
}
