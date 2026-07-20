import type { PlaybackVideoCacheRecord } from "./video-cache-model.js";
import type { PlaybackVideoCacheSegment } from "./video-cache-segments.js";

export type PlaybackVideoCacheIdentity = {
  contentKey: string;
  duration: number;
  fps: number;
  height: number;
  key: string;
  rangeEndFrame: number;
  rangeEndTime: number;
  rangeStartFrame: number;
  rangeStartTime: number;
  segments: PlaybackVideoCacheSegment[];
  templateId: string;
  width: number;
};

export function getPlaybackVideoCacheIdentityMismatch(
  record: PlaybackVideoCacheRecord,
  identity: PlaybackVideoCacheIdentity,
): string | null {
  const checks: Array<[boolean, string]> = [
    [record.templateId === identity.templateId, "template"],
    [record.fps === identity.fps, "fps"],
    [nearlyEqual(record.duration, identity.duration), "duration"],
    [record.width === identity.width, "width"],
    [record.height === identity.height, "height"],
    [record.rangeStartFrame === identity.rangeStartFrame, "range-start-frame"],
    [record.rangeEndFrame === identity.rangeEndFrame, "range-end-frame"],
    [
      nearlyEqual(record.rangeStartTime, identity.rangeStartTime),
      "range-start-time",
    ],
    [nearlyEqual(record.rangeEndTime, identity.rangeEndTime), "range-end-time"],
  ];
  return checks.find(([matches]) => !matches)?.[1] ?? null;
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.0001;
}
