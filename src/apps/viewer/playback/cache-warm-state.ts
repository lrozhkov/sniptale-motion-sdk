export type PreviewCacheWarmStep = {
  finished: boolean;
  prepared: boolean;
  time: number;
};
export type PreviewCacheWarmState = {
  previewCacheWarmActive: boolean;
  previewCacheWarmAverageFrameMs: number;
  previewCacheWarmCapacityLimited: boolean;
  previewCacheWarmElapsedMs: number;
  previewCacheWarmPrepared: boolean;
  previewCacheWarmPublicTime: number;
  previewCacheWarmRangeEndFrame: number;
  previewCacheWarmRangeStartFrame: number;
  previewCacheWarmRenderTime: number;
  previewCacheWarmSampleCount: number;
  previewCacheWarmScale: number;
  previewCacheWarmStartTime: number;
  previewCacheWarmTargetFrames: number;
  previewCacheWarmUnsupportedResults: number;
  previewCacheWarmVisitedFrames: number;
};
export type CacheWarmHostState = PreviewCacheWarmState & {
  playing: boolean;
  previewFrameCacheComplete: boolean;
};
export function createPreviewCacheWarmState(): PreviewCacheWarmState {
  return {
    previewCacheWarmActive: false,
    previewCacheWarmAverageFrameMs: 0,
    previewCacheWarmCapacityLimited: false,
    previewCacheWarmElapsedMs: 0,
    previewCacheWarmPrepared: false,
    previewCacheWarmPublicTime: 0,
    previewCacheWarmRangeEndFrame: 0,
    previewCacheWarmRangeStartFrame: 0,
    previewCacheWarmRenderTime: 0,
    previewCacheWarmSampleCount: 0,
    previewCacheWarmScale: 0,
    previewCacheWarmStartTime: 0,
    previewCacheWarmTargetFrames: 0,
    previewCacheWarmUnsupportedResults: 0,
    previewCacheWarmVisitedFrames: 0,
  };
}
