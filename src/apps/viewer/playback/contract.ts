import type { EditorTemplateSource } from "../templates/model.js";
import type { PlaybackVideoCacheMode } from "./video-cache-state.js";
import type { PreviewCacheWarmStep } from "./cache-warm-state.js";

export type PreviewFrameCacheResult = {
  previewCacheHit?: unknown;
  previewCacheFrames?: unknown;
  previewCacheComplete?: unknown;
};
export type CacheWarmResultOptions = {
  currentTime: number;
  duration: number;
  fps: number;
  frameLatencyMs?: number;
  previousCacheFrames?: number;
};
export interface PlaybackActions {
  schedulePlaybackTick(): void;
  playbackTick(now: number): void;
  toggleLoopPlayback(): void;
  togglePlayback(): void;
  pausePlayback(options?: {
    preservePreparation?: boolean;
    renderCurrentFrame?: boolean;
  }): boolean;
  startPlayback(): void;
  beginPlaybackCacheWarm(force?: boolean): boolean;
  advancePlaybackCacheWarmResult(
    result: PreviewFrameCacheResult,
    options: CacheWarmResultOptions,
  ): PreviewCacheWarmStep | null;
  schedulePlaybackRenderContinuation(): boolean;
  stopPlaybackForRuntimeRecovery(): void;
}
export interface PreviewAudioActions {
  stopPreviewAudio(): void;
  syncPreviewAudio(time: number): void;
}
export type PlaybackVideoCacheCaptureResult = {
  captured?: boolean;
  cancelled?: boolean;
  deferred?: boolean;
  failed?: boolean;
  finished?: boolean;
  prepared?: boolean;
  time?: number;
};
export type PlaybackVideoCacheFrame = {
  bitmap?: ImageBitmap | null | undefined;
  presented?: unknown;
};
export interface PlaybackVideoCacheActions {
  beginPlaybackVideoCache(): Promise<PlaybackVideoCacheMode>;
  capturePlaybackVideoCacheFrame(options: {
    fps: number;
    result: PlaybackVideoCacheFrame;
    time: number;
  }): Promise<PlaybackVideoCacheCaptureResult | null>;
  hidePlaybackVideoCacheSurface(): void;
  invalidatePlaybackVideoCache(): Promise<void>;
  isPlaybackVideoCacheCurrent(): boolean;
  shouldPreferPlaybackVideoCache(
    template: EditorTemplateSource | null,
  ): boolean;
  stopPlaybackVideoCache(discardRecording?: boolean): void;
  syncPlaybackVideoCache(time: number, finished?: boolean): boolean;
}

export interface PlaybackCachePreferenceActions {
  initializePlaybackCachePreference(): void;
  setPlaybackCacheEnabled(enabled: boolean): void;
  syncPlaybackCacheButton(): void;
}
