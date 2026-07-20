export type PreviewCachePlaybackRange =
  | { end?: number; start?: number }
  | null
  | undefined;

export type PreviewCacheFrameRange = {
  endFrame: number;
  fps: number;
  startFrame: number;
};

export function resolvePreviewCacheFrameRange(options: {
  duration: number;
  fps: number;
  range?: PreviewCachePlaybackRange;
}): PreviewCacheFrameRange {
  const duration = Math.max(0.001, Number(options.duration) || 1);
  const fps = Math.max(1, Number(options.fps) || 30);
  const rangeStart = Math.max(
    0,
    Math.min(duration, Number(options.range?.start) || 0),
  );
  const requestedRangeEnd = Number(options.range?.end);
  const rangeEnd = Math.max(
    rangeStart + 1 / fps,
    Math.min(
      duration,
      Number.isFinite(requestedRangeEnd) ? requestedRangeEnd : duration,
    ),
  );
  const startFrame = Math.max(0, Math.round(rangeStart * fps));
  const endFrame = Math.max(startFrame + 1, Math.round(rangeEnd * fps) + 1);
  return { endFrame, fps, startFrame };
}
