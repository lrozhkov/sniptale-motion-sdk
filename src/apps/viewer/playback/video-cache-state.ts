import type { VideoCodec } from "mediabunny";
import type { PlaybackVideoCacheEncoder } from "./video-cache-encoder.js";
import type { PlaybackVideoCacheSegment } from "./video-cache-segments.js";

export type PlaybackVideoCacheMode = "playback" | "recording" | "unavailable";
export type PlaybackVideoCacheState = {
  bytes: number;
  cancelPromise: Promise<unknown> | null;
  codec: VideoCodec | null;
  duration: number;
  encoder: PlaybackVideoCacheEncoder | null;
  error: string | null;
  fallbackKey: string | null;
  finalizing: boolean;
  fps: number;
  generation: number;
  key: string | null;
  lastPlaybackTime: number;
  mediaSource: MediaSource | null;
  mimeType: string | null;
  originalTime: number;
  pendingSegmentCursor: number;
  pendingSegmentIndexes: number[];
  preparePromise: Promise<PlaybackVideoCacheMode> | null;
  persistenceMissReason: string | null;
  persistenceStatus:
    | "idle"
    | "restoring"
    | "partial"
    | "ready"
    | "unavailable"
    | "skipped"
    | "persisting"
    | "error";
  persistent: boolean;
  playbackActive: boolean;
  preparing: boolean;
  rangeEndFrame: number;
  rangeEndTime: number;
  rangeStartFrame: number;
  rangeStartTime: number;
  ready: boolean;
  recording: boolean;
  restoredSegmentCount: number;
  segmentBlobs: (Blob | null)[];
  segmentIndex: number;
  segmentPlan: PlaybackVideoCacheSegment[];
  storageKey: string | null;
  url: string | null;
  width: number;
  height: number;
};

export function createPlaybackVideoCacheState(): {
  previewVideoCache: PlaybackVideoCacheState;
} {
  return {
    previewVideoCache: {
      bytes: 0,
      cancelPromise: null,
      codec: null,
      duration: 0,
      encoder: null,
      error: null,
      fallbackKey: null,
      finalizing: false,
      fps: 0,
      generation: 0,
      key: null,
      lastPlaybackTime: 0,
      mediaSource: null,
      mimeType: null,
      originalTime: 0,
      pendingSegmentCursor: 0,
      pendingSegmentIndexes: [],
      preparePromise: null,
      persistenceMissReason: null,
      persistenceStatus: "idle",
      persistent: false,
      playbackActive: false,
      preparing: false,
      rangeEndFrame: 0,
      rangeEndTime: 0,
      rangeStartFrame: 0,
      rangeStartTime: 0,
      ready: false,
      recording: false,
      restoredSegmentCount: 0,
      segmentBlobs: [],
      segmentIndex: 0,
      segmentPlan: [],
      storageKey: null,
      url: null,
      width: 0,
      height: 0,
    },
  };
}
