type PreviewCacheSessionOptions = {
  message: Record<string, any>;
  postToParent: (message: Record<string, any>, transfer?: any[]) => void;
  previewFrameCache: any;
  previewPresenter?: any;
  startedAt: number;
};

export async function resolvePreviewCacheSessionFrame({
  message,
  postToParent,
  previewFrameCache,
  previewPresenter,
  startedAt,
}: PreviewCacheSessionOptions) {
  const cacheRequest = previewFrameCache.prepare(message);
  const directPresentation =
    message.directPresentation === true && Boolean(previewPresenter);
  const cachedFrame = cacheRequest
    ? await previewFrameCache.get(cacheRequest, {
        allowBorrow:
          directPresentation &&
          previewPresenter?.canPresentReusableBitmap?.() === true,
      })
    : null;
  if (!cachedFrame) {
    return { cacheRequest, directPresentation, handled: false };
  }

  let presented = false;
  if (directPresentation) {
    try {
      presented =
        previewPresenter.present(cachedFrame.bitmap, {
          reusable: cachedFrame.reusable,
        }) === true;
    } catch {
      presented = false;
    }
  }
  if (presented) {
    const presentedAtMs = performance.now();
    postToParent({
      ...(cachedFrame.bindingReads
        ? { bindingReads: cachedFrame.bindingReads }
        : {}),
      durationMs: presentedAtMs - startedAt,
      kind: "renderFrameResult",
      ok: true,
      presented: true,
      presentedAtEpochMs: performance.timeOrigin + presentedAtMs,
      presentedAtMs,
      ...createPreviewCacheMetrics(previewFrameCache.getStats(cacheRequest)),
      previewCacheHit: true,
      previewHeight: cachedFrame.bitmap.height,
      previewWidth: cachedFrame.bitmap.width,
      requestId: message.requestId,
      sequenceId: message.sequenceId,
    });
    return { cacheRequest, directPresentation, handled: true };
  }
  if (!directPresentation) {
    postToParent(
      {
        ...(cachedFrame.bindingReads
          ? { bindingReads: cachedFrame.bindingReads }
          : {}),
        bitmap: cachedFrame.bitmap,
        durationMs: performance.now() - startedAt,
        kind: "renderFrameResult",
        ok: true,
        ...createPreviewCacheMetrics(previewFrameCache.getStats(cacheRequest)),
        previewCacheHit: true,
        requestId: message.requestId,
        sequenceId: message.sequenceId,
      },
      [cachedFrame.bitmap],
    );
    return { cacheRequest, directPresentation, handled: true };
  }
  if (cachedFrame.reusable !== true) {
    cachedFrame.bitmap.close?.();
  }
  return { cacheRequest, directPresentation, handled: false };
}

export async function storePreviewCacheSessionFrame({
  bitmap,
  bindingReads,
  cacheRequest,
  directPresentation,
  previewFrameCache,
  previewPresenter,
}: {
  bitmap: any;
  bindingReads: unknown;
  cacheRequest: any;
  directPresentation: boolean;
  previewFrameCache: any;
  previewPresenter?: any;
}): Promise<number> {
  if (!cacheRequest) {
    return 0;
  }
  const startedAt = performance.now();
  await previewFrameCache.store(cacheRequest, bitmap, bindingReads, {
    allowReusableBitmap:
      directPresentation &&
      previewPresenter?.canPresentReusableBitmap?.() === true,
  });
  return performance.now() - startedAt;
}

export function createPreviewCacheMetrics(cacheStats: any) {
  return {
    previewCacheBytes: cacheStats.bytes,
    previewCacheComplete: cacheStats.complete,
    previewCacheEntries: cacheStats.frames,
    previewCacheEvictions: cacheStats.evictions,
    previewCacheFrames: cacheStats.frames,
    previewCacheRawBytes: cacheStats.rawBytes,
    previewCacheStorage: cacheStats.storage,
    previewCacheTotalFrames: cacheStats.totalFrames,
  };
}
