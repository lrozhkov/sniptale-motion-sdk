import type { CacheBitmap } from "./preview-frame-codec.js";

type PreviewCacheMessage = Record<string, unknown> & {
  requestId: string;
  sequenceId: number;
  directPresentation?: boolean;
};
type CacheMetricStats = {
  bytes: number;
  complete: boolean;
  evictions: number;
  frames: number;
  rawBytes: number;
  storage: string;
  totalFrames: number;
};
type CachePresenter = {
  present(bitmap: ImageBitmap, options?: { reusable?: boolean }): boolean;
  canPresentReusableBitmap?(): boolean;
};
type PreviewCacheSessionOptions<Request extends object> = {
  message: PreviewCacheMessage;
  postToParent: (message: unknown, transfer?: Transferable[]) => void;
  previewFrameCache: {
    prepare(message: PreviewCacheMessage): Request | null;
    get(
      request: NoInfer<Request>,
      options: { allowBorrow: boolean },
    ): Promise<{
      bitmap: CacheBitmap;
      bindingReads?: unknown;
      reusable?: boolean;
    } | null>;
    getStats(request: NoInfer<Request>): CacheMetricStats;
  };
  previewPresenter?: CachePresenter | null | undefined;
  startedAt: number;
};

export async function resolvePreviewCacheSessionFrame<Request extends object>({
  message,
  postToParent,
  previewFrameCache,
  previewPresenter,
  startedAt,
}: PreviewCacheSessionOptions<Request>) {
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
  if (!cachedFrame || cacheRequest === null) {
    return { cacheRequest, directPresentation, handled: false };
  }

  let presented = false;
  if (directPresentation && previewPresenter) {
    try {
      presented =
        previewPresenter.present(cachedFrame.bitmap, {
          reusable: cachedFrame.reusable === true,
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

export async function storePreviewCacheSessionFrame<Request extends object>({
  bitmap,
  bindingReads,
  cacheRequest,
  directPresentation,
  previewFrameCache,
  previewPresenter,
}: {
  bitmap: CacheBitmap;
  bindingReads: unknown;
  cacheRequest: Request | null;
  directPresentation: boolean;
  previewFrameCache: {
    store(
      request: Request,
      bitmap: CacheBitmap,
      bindingReads: unknown,
      options: { allowReusableBitmap: boolean },
    ): Promise<boolean>;
  };
  previewPresenter?: CachePresenter | null | undefined;
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

export function createPreviewCacheMetrics(cacheStats: CacheMetricStats) {
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
