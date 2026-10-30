import {
  resolvePreviewFrameCacheRequest,
  type PreviewFrameCacheRequest,
} from "./preview-frame-cache-key.js";
import {
  createPreviewFrameRetainer,
  type CacheBitmap,
  type PreviewFrameRetentionOptions,
  type RetainedPreviewFrame,
} from "./preview-frame-codec.js";

const DEFAULT_PREVIEW_FRAME_CACHE_BYTES = 320 * 1024 * 1024;
const PREVIEW_FRAME_DECODE_LOOKAHEAD = 4;

type CacheEntry = {
  bindingReads: Map<string, unknown>;
  frame: RetainedPreviewFrame;
  bytes: number;
  frameIndex: number;
  rawBytes: number;
  surfaceRevision: string;
};

export function createPreviewFrameCache(
  maxBytes = DEFAULT_PREVIEW_FRAME_CACHE_BYTES,
  retainFrame: (
    bitmap: CacheBitmap,
    options?: PreviewFrameRetentionOptions,
  ) => Promise<RetainedPreviewFrame> = createPreviewFrameRetainer(),
) {
  const byteBudget = Math.max(0, Number(maxBytes) || 0);
  const entries = new Map<string, CacheEntry>();
  const frameIndexesBySurface = new Map<string, Set<number>>();
  let activeContentRevision: string | null = null;
  let bytes = 0;
  let evictions = 0;
  let hits = 0;
  let misses = 0;
  let rawBytes = 0;

  function clear(): void {
    for (const entry of entries.values()) {
      entry.frame.release();
    }
    entries.clear();
    frameIndexesBySurface.clear();
    bytes = 0;
    evictions = 0;
    rawBytes = 0;
  }

  function prepare(
    message: Record<string, any>,
  ): PreviewFrameCacheRequest | null {
    const request = resolvePreviewFrameCacheRequest(message);
    if (!request) {
      return null;
    }
    if (activeContentRevision !== request.contentRevision) {
      clear();
      activeContentRevision = request.contentRevision;
    }
    return request;
  }

  async function get(
    request: PreviewFrameCacheRequest,
    options: { allowBorrow?: boolean } = {},
  ) {
    const entryKey = request.key;
    const entry = entries.get(entryKey);
    const bindingKey = request.bindingLayerId;
    const bindingReads = bindingKey
      ? (entry?.bindingReads.get(bindingKey) ??
        findNearestBindingReads(entries, request, bindingKey))
      : undefined;
    if (!entry || (bindingKey && bindingReads === undefined)) {
      misses += 1;
      return null;
    }
    let bitmap: CacheBitmap;
    let reusable = false;
    try {
      if (entry.frame.borrow && options.allowBorrow !== false) {
        bitmap = entry.frame.borrow();
        reusable = true;
      } else {
        const pending = entry.frame.restore();
        primeUpcomingFrames(entries, request);
        bitmap = await pending;
      }
    } catch {
      removeEntry(entryKey, entry);
      misses += 1;
      return null;
    }
    entries.delete(entryKey);
    entries.set(entryKey, entry);
    hits += 1;
    return {
      bindingReads,
      bitmap,
      ...(reusable ? { reusable: true } : {}),
    };
  }

  async function store(
    request: PreviewFrameCacheRequest,
    bitmap: CacheBitmap,
    bindingReads: unknown,
    options: { allowReusableBitmap?: boolean } = {},
  ): Promise<boolean> {
    const existing = entries.get(request.key);
    if (existing) {
      if (request.bindingLayerId && bindingReads !== undefined) {
        existing.bindingReads.set(request.bindingLayerId, bindingReads);
      }
      entries.delete(request.key);
      entries.set(request.key, existing);
      return false;
    }
    let retainedFrame: RetainedPreviewFrame;
    try {
      retainedFrame = await retainFrame(bitmap, {
        preferReusableBitmap:
          options.allowReusableBitmap !== false &&
          canRetainCompleteBitmapSequence(
            bitmap,
            request.totalFrames,
            byteBudget,
          ),
      });
    } catch {
      return false;
    }
    const entryBytes = Math.max(0, Number(retainedFrame.bytes) || 0);
    const entryRawBytes = Math.max(0, Number(retainedFrame.rawBytes) || 0);
    if (entryBytes <= 0 || entryBytes > byteBudget) {
      retainedFrame.release();
      return false;
    }
    while (bytes + entryBytes > byteBudget && entries.size > 0) {
      const oldestKey = entries.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = entries.get(oldestKey);
      if (!oldest) break;
      removeEntry(oldestKey, oldest);
      evictions += 1;
    }
    const entry: CacheEntry = {
      bindingReads: new Map(),
      frame: retainedFrame,
      bytes: entryBytes,
      frameIndex: request.frameIndex,
      rawBytes: entryRawBytes,
      surfaceRevision: request.surfaceRevision,
    };
    if (request.bindingLayerId && bindingReads !== undefined) {
      entry.bindingReads.set(request.bindingLayerId, bindingReads);
    }
    entries.set(request.key, entry);
    bytes += entryBytes;
    rawBytes += entryRawBytes;
    let surfaceFrames = frameIndexesBySurface.get(request.surfaceRevision);
    if (!surfaceFrames) {
      surfaceFrames = new Set();
      frameIndexesBySurface.set(request.surfaceRevision, surfaceFrames);
    }
    surfaceFrames.add(request.frameIndex);
    return true;
  }

  function removeEntry(key: string, entry: CacheEntry): void {
    entries.delete(key);
    bytes -= entry.bytes;
    rawBytes -= entry.rawBytes;
    entry.frame.release();
    const surfaceFrames = frameIndexesBySurface.get(entry.surfaceRevision);
    surfaceFrames?.delete(entry.frameIndex);
    if (surfaceFrames?.size === 0) {
      frameIndexesBySurface.delete(entry.surfaceRevision);
    }
  }

  return {
    clear,
    close() {
      clear();
      activeContentRevision = null;
    },
    get,
    getStats(request?: PreviewFrameCacheRequest) {
      const surfaceFrames = request
        ? countFramesInRange(
            frameIndexesBySurface.get(request.surfaceRevision),
            request.rangeStartFrame,
            request.rangeEndFrame,
          )
        : entries.size;
      const totalFrames = request?.totalFrames ?? 0;
      const storageKinds = new Set(
        Array.from(entries.values(), (entry) => entry.frame.storage),
      );
      return {
        bytes,
        complete: totalFrames > 0 && surfaceFrames >= totalFrames,
        entries: entries.size,
        evictions,
        frames: surfaceFrames,
        hits,
        misses,
        rawBytes,
        storage:
          storageKinds.size === 0
            ? "none"
            : storageKinds.size === 1
              ? storageKinds.values().next().value
              : "mixed",
        totalFrames,
      };
    },
    prepare,
    store,
  };
}

function canRetainCompleteBitmapSequence(
  bitmap: CacheBitmap,
  totalFrames: number,
  byteBudget: number,
): boolean {
  const rawFrameBytes =
    Math.max(0, Math.round(Number(bitmap.width) || 0)) *
    Math.max(0, Math.round(Number(bitmap.height) || 0)) *
    4;
  const completeSequenceBytes = rawFrameBytes * Math.max(1, totalFrames);
  return (
    rawFrameBytes > 0 &&
    Number.isSafeInteger(completeSequenceBytes) &&
    completeSequenceBytes <= byteBudget
  );
}

function primeUpcomingFrames(
  entries: Map<string, CacheEntry>,
  request: PreviewFrameCacheRequest,
): void {
  const lookahead = Math.min(
    PREVIEW_FRAME_DECODE_LOOKAHEAD,
    Math.max(0, request.totalFrames - 1),
  );
  for (let offset = 1; offset <= lookahead; offset += 1) {
    const frameIndex =
      request.rangeStartFrame +
      ((request.frameIndex - request.rangeStartFrame + offset) %
        request.totalFrames);
    entries.get(`${request.surfaceRevision}:${frameIndex}`)?.frame.prime?.();
  }
}

function countFramesInRange(
  frameIndexes: Set<number> | undefined,
  startFrame: number,
  endFrame: number,
): number {
  if (!frameIndexes) {
    return 0;
  }
  let count = 0;
  for (const frameIndex of frameIndexes) {
    if (frameIndex >= startFrame && frameIndex < endFrame) {
      count += 1;
    }
  }
  return count;
}

function findNearestBindingReads(
  entries: Map<string, CacheEntry>,
  request: PreviewFrameCacheRequest,
  bindingLayerId: string,
): unknown {
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestReads: unknown;
  for (const entry of entries.values()) {
    if (entry.surfaceRevision !== request.surfaceRevision) {
      continue;
    }
    const reads = entry.bindingReads.get(bindingLayerId);
    const distance = Math.abs(entry.frameIndex - request.frameIndex);
    if (
      reads !== undefined &&
      distance <= request.maxBindingSampleDistance &&
      distance < nearestDistance
    ) {
      nearestDistance = distance;
      nearestReads = reads;
    }
  }
  return nearestReads;
}
