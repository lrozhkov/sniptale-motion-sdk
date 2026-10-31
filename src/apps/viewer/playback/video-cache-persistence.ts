import type { PlaybackVideoCacheRecordSegment } from "./video-cache-model.js";
import type { PlaybackVideoCacheState } from "./video-cache-state.js";
import type { ViewerAppContext } from "../app/context.js";
import {
  PLAYBACK_VIDEO_CACHE_MAX_BYTES,
  PLAYBACK_VIDEO_CACHE_SCHEMA_VERSION,
  normalizePlaybackVideoCacheRecord,
  type PlaybackVideoCacheCodec,
  type PlaybackVideoCacheRecord,
} from "./video-cache-model.js";
import {
  getPlaybackVideoCacheIdentityMismatch,
  type PlaybackVideoCacheIdentity,
} from "./video-cache-identity.js";
import { attachPlaybackVideoCacheSource } from "./video-cache-media-source.js";
import type {
  PlaybackVideoCacheSegment,
  PlaybackVideoCacheSegmentBlob,
} from "./video-cache-segments.js";
import { playbackVideoCacheStorage } from "./video-cache-storage.js";

export type PlaybackVideoCacheRestoreResult =
  | { mode: "complete" }
  | {
      mode: "partial";
      pendingSegmentIndexes: number[];
      preferredCodec: PlaybackVideoCacheCodec;
    }
  | { mode: "miss" };

const storage = playbackVideoCacheStorage;

export async function restorePersistentPlaybackVideoCache(
  ctx: ViewerAppContext,
  identity: PlaybackVideoCacheIdentity,
  generation: number,
): Promise<PlaybackVideoCacheRestoreResult> {
  const cache = ctx.state.previewVideoCache;
  cache.persistenceStatus = "restoring";
  cache.preparing = true;
  ctx.syncPlaybackButtons?.();
  ctx.syncPlaybackCacheButton?.();
  ctx.syncPreviewQualityBadge?.(1);
  try {
    const raw = await storage.get(identity.key);
    const record = normalizePlaybackVideoCacheRecord(raw, identity.key);
    const mismatch = record
      ? getPlaybackVideoCacheIdentityMismatch(record, identity)
      : raw === null
        ? "not-found"
        : "invalid-record";
    if (!record || mismatch) {
      if (raw !== null) {
        void storage.delete(identity.key).catch(() => undefined);
      }
      if (generation === cache.generation) {
        cache.persistenceMissReason = mismatch;
        cache.persistenceStatus = "idle";
        ctx.syncPlaybackCacheButton?.();
        ctx.syncPreviewQualityBadge?.(1);
      }
      return { mode: "miss" };
    }
    if (
      generation !== cache.generation ||
      ctx.state.currentTemplate?.id !== identity.templateId
    ) {
      return { mode: "miss" };
    }
    const reusable = identity.segments.map((segment, index) => {
      const stored = record.segments[index];
      return stored && recordSegmentMatches(stored, segment)
        ? stored.blob
        : null;
    });
    const pendingSegmentIndexes = reusable
      .map((blob, index) => (blob ? -1 : index))
      .filter((index) => index >= 0);
    if (pendingSegmentIndexes.length === identity.segments.length) {
      if (generation === cache.generation) {
        cache.persistenceStatus = "idle";
        ctx.syncPlaybackCacheButton?.();
        ctx.syncPreviewQualityBadge?.(1);
      }
      return { mode: "miss" };
    }
    if (pendingSegmentIndexes.length > 0) {
      if (generation === cache.generation) {
        Object.assign(cache, {
          codec: record.codec,
          key: identity.contentKey,
          mimeType: record.mimeType,
          persistenceMissReason: null,
          persistenceStatus: "partial",
          persistent: false,
          restoredSegmentCount:
            identity.segments.length - pendingSegmentIndexes.length,
          segmentBlobs: reusable,
          segmentPlan: identity.segments,
          storageKey: identity.key,
        } satisfies Partial<PlaybackVideoCacheState>);
        ctx.syncPlaybackCacheButton?.();
        ctx.syncPreviewQualityBadge?.(1);
      }
      return {
        mode: "partial",
        pendingSegmentIndexes,
        preferredCodec: record.codec,
      };
    }
    const blobs = reusable.filter((blob): blob is Blob => Boolean(blob));
    const source = await attachPlaybackVideoCacheSource(
      ctx,
      blobs,
      record.codec,
    );
    if (
      generation !== cache.generation ||
      ctx.state.currentTemplate?.id !== identity.templateId
    ) {
      ctx.refs.cachedPreviewVideo.removeAttribute("src");
      ctx.refs.cachedPreviewVideo.load();
      URL.revokeObjectURL(source.url);
      return { mode: "miss" };
    }
    Object.assign(cache, {
      bytes: record.bytes,
      codec: record.codec,
      duration: record.duration,
      error: null,
      fps: record.fps,
      key: identity.contentKey,
      mediaSource: source.mediaSource,
      mimeType: record.mimeType,
      persistenceMissReason: null,
      persistenceStatus: "ready",
      persistent: true,
      preparing: false,
      rangeEndFrame: record.rangeEndFrame,
      rangeEndTime: record.rangeEndTime,
      rangeStartFrame: record.rangeStartFrame,
      rangeStartTime: record.rangeStartTime,
      ready: true,
      recording: false,
      restoredSegmentCount: record.segments.length,
      segmentBlobs: blobs,
      segmentIndex: record.segments.length - 1,
      segmentPlan: record.segments.map(
        ({ endFrame, endTime, fingerprint, index, startFrame, startTime }) => ({
          endFrame,
          endTime,
          fingerprint,
          index,
          startFrame,
          startTime,
        }),
      ),
      storageKey: identity.key,
      url: source.url,
      width: record.width,
      height: record.height,
    } satisfies Partial<PlaybackVideoCacheState>);
    ctx.state.previewCacheWarmActive = false;
    ctx.state.previewCacheWarmPrepared = true;
    ctx.state.previewCacheWarmTargetFrames = 0;
    ctx.state.previewCacheWarmVisitedFrames = 0;
    ctx.state.previewFrameCacheBytes = record.bytes;
    ctx.state.previewFrameCacheComplete = true;
    ctx.state.previewFrameCacheEntries = record.segments.length;
    ctx.state.previewFrameCacheFrames = Math.max(
      1,
      record.rangeEndFrame - record.rangeStartFrame,
    );
    ctx.state.previewFrameCacheStorage = "video";
    ctx.state.previewFrameCacheTotalFrames = ctx.state.previewFrameCacheFrames;
    touchRecord(record);
    ctx.syncPlaybackButtons?.();
    ctx.syncPlaybackCacheButton?.();
    ctx.syncPreviewQualityBadge?.(1);
    return { mode: "complete" };
  } catch {
    if (generation === cache.generation) {
      cache.persistenceStatus = "unavailable";
      ctx.syncPlaybackCacheButton?.();
      ctx.syncPreviewQualityBadge?.(1);
    }
    return { mode: "miss" };
  }
}

export function persistPlaybackVideoCache(
  ctx: ViewerAppContext,
  segments: PlaybackVideoCacheSegmentBlob[],
): void {
  const templateId = ctx.state.currentTemplate?.id;
  const cache = ctx.state.previewVideoCache;
  const key = cache.key;
  const storageKey = cache.storageKey;
  const codec = cache.codec;
  const first = segments[0];
  const bytes = segments.reduce(
    (total, segment) => total + segment.blob.size,
    0,
  );
  if (
    !templateId ||
    !key ||
    !storageKey ||
    (codec !== "avc" && codec !== "vp8" && codec !== "vp9") ||
    !first ||
    bytes <= 0
  ) {
    return;
  }
  if (bytes > PLAYBACK_VIDEO_CACHE_MAX_BYTES) {
    cache.persistenceStatus = "skipped";
    cache.persistent = false;
    ctx.syncPlaybackCacheButton?.();
    return;
  }
  cache.persistenceMissReason = null;
  const generation = cache.generation;
  const now = Date.now();
  const rangeStartFrame = Math.max(0, Number(cache.rangeStartFrame) || 0);
  const rangeStartTime = Math.max(0, Number(cache.rangeStartTime) || 0);
  const record: PlaybackVideoCacheRecord = {
    accessedAt: now,
    bytes,
    codec,
    contentKey: key,
    createdAt: now,
    duration: Math.max(0.001, Number(cache.duration) || 1),
    fps: Math.max(1, Number(cache.fps) || 30),
    height: Math.max(1, Number(cache.height) || 1),
    key: storageKey,
    mimeType: first.blob.type || "video/mp4",
    rangeEndFrame: Math.max(
      rangeStartFrame + 1,
      Number(cache.rangeEndFrame) || rangeStartFrame + 1,
    ),
    rangeEndTime: Math.max(
      rangeStartTime + 1 / Math.max(1, Number(cache.fps) || 30),
      Number(cache.rangeEndTime) ||
        rangeStartTime + 1 / Math.max(1, Number(cache.fps) || 30),
    ),
    rangeStartFrame,
    rangeStartTime,
    schemaVersion: PLAYBACK_VIDEO_CACHE_SCHEMA_VERSION,
    segments: segments.map((segment) => ({
      blob: segment.blob,
      bytes: segment.blob.size,
      endFrame: segment.endFrame,
      endTime: segment.endTime,
      fingerprint: String(segment.fingerprint ?? ""),
      index: segment.index,
      startFrame: segment.startFrame,
      startTime: segment.startTime,
    })),
    templateId,
    width: Math.max(1, Number(cache.width) || 1),
  };
  cache.persistenceStatus = "persisting";
  cache.persistent = false;
  ctx.syncPlaybackCacheButton?.();
  void storage
    .put(record)
    .then(() => {
      if (generation === cache.generation && cache.key === key && cache.ready) {
        cache.persistenceStatus = "ready";
        cache.persistent = true;
        ctx.syncPlaybackCacheButton?.();
      }
      void storage.cleanup().catch(() => undefined);
    })
    .catch(() => {
      if (generation === cache.generation && cache.key === key) {
        cache.persistenceStatus = "error";
        cache.persistent = false;
        ctx.syncPlaybackCacheButton?.();
      }
    });
}

function recordSegmentMatches(
  record: PlaybackVideoCacheRecordSegment | undefined,
  expected: PlaybackVideoCacheSegment,
): boolean {
  return Boolean(
    record &&
    record.index === expected.index &&
    record.startFrame === expected.startFrame &&
    record.endFrame === expected.endFrame &&
    Math.abs(record.startTime - expected.startTime) < 0.0001 &&
    Math.abs(record.endTime - expected.endTime) < 0.0001 &&
    record.fingerprint === expected.fingerprint,
  );
}

function touchRecord(record: PlaybackVideoCacheRecord): void {
  void storage
    .put({ ...record, accessedAt: Date.now() })
    .then(() => storage.cleanup())
    .catch(() => undefined);
}
