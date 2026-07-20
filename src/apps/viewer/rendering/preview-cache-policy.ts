export type PreviewFrameCachePolicy = {
  requested: boolean;
  warming: boolean;
};

export function resolvePreviewFrameCachePolicy(
  state: {
    canvasTransformDragActive?: boolean;
    playing?: boolean;
    previewCacheEnabled?: boolean;
    previewVideoCache?: {
      finalizing?: boolean;
      preparing?: boolean;
      ready?: boolean;
      recording?: boolean;
    } | null;
  },
  preferVideoCache = false,
): PreviewFrameCachePolicy {
  const videoCacheOwnsStorage = Boolean(
    preferVideoCache ||
    state.previewVideoCache?.preparing ||
    state.previewVideoCache?.recording ||
    state.previewVideoCache?.finalizing ||
    state.previewVideoCache?.ready,
  );
  const requested =
    state.previewCacheEnabled !== false &&
    state.canvasTransformDragActive !== true &&
    !videoCacheOwnsStorage;
  return {
    requested,
    warming: requested && state.playing === true,
  };
}

export function shouldRecordPreviewFrameCacheResult(
  state: {
    previewVideoCache?: {
      finalizing?: boolean;
      preparing?: boolean;
      ready?: boolean;
      recording?: boolean;
    } | null;
  },
  videoCacheStep: unknown,
): boolean {
  return Boolean(
    !videoCacheStep &&
    !state.previewVideoCache?.preparing &&
    !state.previewVideoCache?.recording &&
    !state.previewVideoCache?.finalizing &&
    !state.previewVideoCache?.ready,
  );
}

export function shouldCapturePlaybackVideoCacheFrame(state: {
  playing?: boolean;
  previewVideoCache?: {
    recording?: boolean;
  } | null;
}): boolean {
  return Boolean(
    state.playing === true && state.previewVideoCache?.recording === true,
  );
}
